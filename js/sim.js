// Simulación interactiva de Van der Waals: isoterma de 1 mol de gas real contra gas ideal.
// El usuario mueve la temperatura y el volumen con deslizadores (o los anima) y ve cómo cambian
// la presión real, la ideal y el factor de compresibilidad Z. Todo se calcula con las mismas
// fórmulas de vdw.js; aquí solo se dibuja.

import { R, fmt } from "./units.js";
import { VDW_TABLE, VDW_GASES } from "./laws.js";
import { compressibility, criticalPoint, pressure } from "./vdw.js";
import { niceTicks } from "./chart.js";
import { h } from "./dom.js";

const NS = "http://www.w3.org/2000/svg";
const POINTS = 360; // puntos de la curva
const T_MIN = 50;
const T_MAX = 800;
const POS_MAX = 1000; // el deslizador de volumen va de 0 a 1000 y se reparte en escala logarítmica
const SWEEP_MS = 7000; // duración de un recorrido completo al animar
const N = 1; // mol: la simulación es por mol de gas

const svgEl = (tag, attrs = {}, text) => {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
};

// Marcas del eje logarítmico: 1, 2, 5 × 10^k que caen dentro del rango.
export function logTicks(lo, hi) {
  const out = [];
  for (let k = Math.floor(Math.log10(lo)) - 1; k <= Math.ceil(Math.log10(hi)); k++) {
    for (const m of [1, 2, 5]) {
      const t = m * Math.pow(10, k);
      if (t >= lo && t <= hi) out.push(Number(t.toPrecision(6)));
    }
  }
  return out;
}

export function createSimulation(initialGas = "CO₂") {
  let gas = VDW_GASES[initialGas] ? initialGas : "CO₂";
  let [a, b] = VDW_GASES[gas];
  let crit = criticalPoint(a, b);
  let pos = 500; // posición (flotante) del deslizador de volumen
  let raf = 0;
  let dir = -1;
  let lastTs = 0;

  // ---- geometría del dibujo (el ancho se adapta a la pantalla)
  const W = Math.round(Math.min(560, Math.max(280, window.innerWidth - 70)));
  const H = Math.round(W * 0.72);
  const m = { l: 50, r: 14, t: 12, b: 44 };
  const pw = W - m.l - m.r;
  const ph = H - m.t - m.b;

  // ---- controles
  const gasSelect = h("select", { class: "select select-wide", id: "sim-gas", "aria-label": "Gas de la simulación" },
    VDW_TABLE.map(({ group, rows }) =>
      h("optgroup", { label: group },
        rows.map(([f, name]) => h("option", { value: f, selected: f === gas }, `${f} · ${name}`)))));
  const tSlider = h("input", { type: "range", id: "sim-T", min: T_MIN, max: T_MAX, step: 1, value: 300, "aria-label": "Temperatura en kelvin" });
  const vSlider = h("input", { type: "range", id: "sim-V", min: 0, max: POS_MAX, step: 1, value: pos, "aria-label": "Volumen" });
  const tOut = h("b", { class: "sim-val", id: "sim-T-out" });
  const vOut = h("b", { class: "sim-val", id: "sim-V-out" });
  const playBtn = h("button", { class: "btn btn-blue", type: "button", id: "sim-play", "aria-pressed": "false" }, "▶ Animar volumen");
  const critBtn = h("button", { class: "btn", type: "button", id: "sim-crit" }, "Ir a T crítica");

  // ---- dibujo
  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", class: "chart", "aria-label": "Isoterma de Van der Waals comparada con el gas ideal" });
  const clipId = "sim-clip";
  const clip = svgEl("clipPath", { id: clipId });
  clip.append(svgEl("rect", { x: m.l, y: m.t, width: pw, height: ph }));
  svg.append(svgEl("defs"));
  svg.firstChild.append(clip);
  const gridG = svgEl("g");
  const curvesG = svgEl("g", { "clip-path": `url(#${clipId})` });
  const real = svgEl("path", { class: "curve curve-0" });
  const ideal = svgEl("path", { class: "curve curve-1 dashed" });
  curvesG.append(ideal, real);
  const vLine = svgEl("line", { class: "sim-vline" });
  const dotIdeal = svgEl("circle", { r: 5, class: "sim-dot sim-dot-ideal" });
  const dotReal = svgEl("circle", { r: 6, class: "state" });
  const critMark = svgEl("polygon", { class: "sim-crit" });
  const critText = svgEl("text", { class: "state-label" }, "C");
  svg.append(gridG, curvesG, vLine, dotIdeal, dotReal, critMark, critText);
  svg.append(svgEl("line", { x1: m.l, x2: m.l + pw, y1: m.t + ph, y2: m.t + ph, class: "axis" }));
  svg.append(svgEl("line", { x1: m.l, x2: m.l, y1: m.t, y2: m.t + ph, class: "axis" }));
  svg.append(svgEl("text", { x: m.l + pw / 2, y: H - 8, class: "axis-label", "text-anchor": "middle" }, "Volumen V (L, escala logarítmica)"));
  svg.append(svgEl("text", {
    x: 14, y: m.t + ph / 2, class: "axis-label", "text-anchor": "middle",
    transform: `rotate(-90 14 ${m.t + ph / 2})`,
  }, "Presión P (atm)"));

  // ---- lecturas
  const readout = h("div", { class: "lcd lcd-mini sim-readout", "data-testid": "sim-readout", "aria-live": "polite" });
  const critLine = h("p", { class: "muted small", id: "sim-critline" });
  const status = h("div", { class: "note", id: "sim-status" });

  const xLo = () => 1.08 * b;
  const xHi = () => 60 * b;
  const volumeAt = (p) => xLo() * Math.pow(xHi() / xLo(), p / POS_MAX);

  function draw() {
    const T = Number(tSlider.value);
    const V = volumeAt(Number(vSlider.value));
    const lo = xLo();
    const hi = xHi();
    // La escala vertical sigue a la temperatura para que siempre se vea la zona de interés.
    const yMax = Math.max(2 * crit.Pc, (1.4 * N * R * T) / (18 * b));
    const sx = (x) => m.l + (Math.log(x / lo) / Math.log(hi / lo)) * pw;
    const sy = (y) => m.t + ph - (y / yMax) * ph;

    // cuadrícula y marcas
    const grid = [];
    for (const t of niceTicks(0, yMax)) {
      grid.push(svgEl("line", { x1: m.l, x2: m.l + pw, y1: sy(t), y2: sy(t), class: "grid" }));
      grid.push(svgEl("text", { x: m.l - 8, y: sy(t) + 4, class: "tick", "text-anchor": "end" }, fmt(t, 3)));
    }
    for (const t of logTicks(lo, hi)) {
      grid.push(svgEl("line", { x1: sx(t), x2: sx(t), y1: m.t, y2: m.t + ph, class: "grid" }));
      grid.push(svgEl("text", { x: sx(t), y: m.t + ph + 18, class: "tick", "text-anchor": "middle" }, fmt(t, 2)));
    }
    gridG.replaceChildren(...grid);

    // curvas
    const clampY = (y) => Math.max(-50 * yMax, Math.min(50 * yMax, y));
    let dReal = "";
    let dIdeal = "";
    for (let i = 0; i <= POINTS; i++) {
      const x = lo * Math.pow(hi / lo, i / POINTS);
      const cmd = i ? "L" : "M";
      dReal += `${cmd}${sx(x).toFixed(1)},${sy(clampY(pressure(x, N, T, a, b))).toFixed(1)} `;
      dIdeal += `${cmd}${sx(x).toFixed(1)},${sy(clampY((N * R * T) / x)).toFixed(1)} `;
    }
    real.setAttribute("d", dReal);
    ideal.setAttribute("d", dIdeal);

    // estado actual
    const Pr = pressure(V, N, T, a, b);
    const Pi = (N * R * T) / V;
    const Z = compressibility(Pr, V, N, T);
    const cx = sx(V);
    vLine.setAttribute("x1", cx); vLine.setAttribute("x2", cx);
    vLine.setAttribute("y1", m.t); vLine.setAttribute("y2", m.t + ph);
    dotReal.setAttribute("cx", cx); dotReal.setAttribute("cy", sy(clampY(Pr)));
    dotIdeal.setAttribute("cx", cx); dotIdeal.setAttribute("cy", sy(clampY(Pi)));
    dotReal.style.display = Pr >= 0 && Pr <= yMax ? "" : "none";
    dotIdeal.style.display = Pi <= yMax ? "" : "none";

    // punto crítico (rombo)
    const px = sx(crit.Vc);
    const py = sy(crit.Pc);
    critMark.setAttribute("points", `${px},${py - 7} ${px + 7},${py} ${px},${py + 7} ${px - 7},${py}`);
    critText.setAttribute("x", px + 10); critText.setAttribute("y", py - 8);

    // lecturas
    tOut.textContent = `${T} K (${fmt(T - 273.15, 4)} °C)`;
    vOut.textContent = `${fmt(V, 4)} L`;
    const diff = Pi ? ((Pr - Pi) / Pi) * 100 : NaN;
    readout.replaceChildren(
      h("div", {}, `P real  = ${fmt(Pr, 5)} atm`),
      h("div", {}, `P ideal = ${fmt(Pi, 5)} atm`),
      h("div", {}, `Z = ${fmt(Z, 4)}   ·   dif. = ${Number.isFinite(diff) ? (diff >= 0 ? "+" : "") + diff.toFixed(1) : "—"} %`));
    critLine.textContent =
      `${gas}: Tc = ${fmt(crit.Tc, 4)} K · Pc = ${fmt(crit.Pc, 4)} atm · Vc = ${fmt(crit.Vc, 3)} L (rombo C)`;
    if (T < crit.Tc) {
      status.textContent = "T < Tc: la isoterma real tiene un lazo (zona de coexistencia líquido–vapor). " +
        "Ahí la ecuación de Van der Waals no describe un estado estable.";
    } else {
      status.textContent = "T ≥ Tc: el gas no se puede condensar; la curva real baja suavemente. " +
        "Z < 1 por atracción entre moléculas y Z > 1 por el volumen propio (a volúmenes pequeños).";
    }
    if (Pr < 0) status.textContent += " Con este volumen la presión real sale negativa: estado no físico.";
  }

  // ---- animación del volumen (ida y vuelta)
  const root = h("section", { class: "card sim", id: "sim" });
  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    lastTs = 0;
    playBtn.textContent = "▶ Animar volumen";
    playBtn.setAttribute("aria-pressed", "false");
  }
  function frame(ts) {
    if (!root.isConnected) { stop(); return; }
    const dt = lastTs ? Math.min(ts - lastTs, 64) : 16;
    lastTs = ts;
    pos += dir * dt * (POS_MAX / SWEEP_MS);
    if (pos <= 0) { pos = 0; dir = 1; }
    if (pos >= POS_MAX) { pos = POS_MAX; dir = -1; }
    vSlider.value = String(pos);
    draw();
    raf = requestAnimationFrame(frame);
  }
  playBtn.addEventListener("click", () => {
    if (raf) { stop(); return; }
    playBtn.textContent = "⏸ Pausar";
    playBtn.setAttribute("aria-pressed", "true");
    raf = requestAnimationFrame(frame);
  });

  tSlider.addEventListener("input", () => { stop(); draw(); });
  vSlider.addEventListener("input", () => { stop(); pos = Number(vSlider.value); draw(); });
  critBtn.addEventListener("click", () => {
    stop();
    tSlider.value = String(Math.min(T_MAX, Math.max(T_MIN, Math.round(crit.Tc))));
    draw();
  });

  function setGas(name) {
    if (!VDW_GASES[name] || name === gas) return;
    gas = name;
    [a, b] = VDW_GASES[gas];
    crit = criticalPoint(a, b);
    gasSelect.value = gas;
    draw();
  }
  gasSelect.addEventListener("change", () => setGas(gasSelect.value));

  root.append(
    h("h3", { class: "card-title" }, "Simulación interactiva · isoterma de Van der Waals"),
    h("div", { class: "card-body" },
      h("p", { class: "muted small" },
        "Por cada mol de gas. Mueve la temperatura y el volumen, o pulsa Animar para comprimir y expandir el gas. " +
        "La línea continua es el gas real (Van der Waals) y la discontinua, el gas ideal."),
      h("div", { class: "field" }, h("label", { for: "sim-gas" }, "Gas"), gasSelect),
      h("div", { class: "sim-row" },
        h("label", { for: "sim-T" }, h("b", { class: "sym" }, "T"), " Temperatura ", tOut), tSlider),
      h("div", { class: "sim-row" },
        h("label", { for: "sim-V" }, h("b", { class: "sym" }, "V"), " Volumen ", vOut), vSlider),
      h("div", { class: "actions" }, playBtn, critBtn),
      h("figure", { class: "chart-wrap" },
        svg,
        h("figcaption", { class: "chart-legend" },
          h("span", {}, h("i", { class: "swatch swatch-0" }), "Gas real (Van der Waals)"),
          h("span", {}, h("i", { class: "swatch swatch-1 dashed" }), "Gas ideal"),
          h("span", {}, h("i", { class: "swatch dot" }), "Estado actual"))),
      readout,
      critLine,
      status)
  );
  draw();
  return { el: root, setGas, stop };
}
