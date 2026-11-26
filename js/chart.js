// Gráficas SVG sin librerías: muestra la curva de la ley y los estados calculados.

import { R, fmt } from "./units.js";
import * as vdw from "./vdw.js";

const NS = "http://www.w3.org/2000/svg";

export function niceTicks(lo, hi, target = 5) {
  const span = hi - lo || 1;
  const raw = span / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const ticks = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi + step * 1e-9; t += step) {
    ticks.push(Number(t.toPrecision(10)));
  }
  return ticks;
}

function linspace(a, b, n) {
  return Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));
}

// Define qué se dibuja para cada ley. `s` = estado completo en unidades base.
export function chartSpec(law, s) {
  switch (law.id) {
    case "boyle": {
      const k = s.P1 * s.V1;
      const xs = linspace(Math.min(s.V1, s.V2) * 0.5, Math.max(s.V1, s.V2) * 1.5, 80);
      return {
        title: "Isoterma P–V (T constante)",
        xLabel: "V (L)", yLabel: "P (atm)",
        curves: [{ label: "P·V = constante", pts: xs.map((x) => [x, k / x]) }],
        points: [
          { x: s.V1, y: s.P1, label: "1" },
          { x: s.V2, y: s.P2, label: "2" },
        ],
      };
    }
    case "charles": {
      const m = s.V1 / s.T1;
      const xs = linspace(0, Math.max(s.T1, s.T2) * 1.25, 40);
      return {
        title: "V contra T (P constante)",
        xLabel: "T (K)", yLabel: "V (L)",
        curves: [{ label: "V/T = constante", pts: xs.map((x) => [x, m * x]) }],
        points: [
          { x: s.T1, y: s.V1, label: "1" },
          { x: s.T2, y: s.V2, label: "2" },
        ],
      };
    }
    case "gay_lussac": {
      const m = s.P1 / s.T1;
      const xs = linspace(0, Math.max(s.T1, s.T2) * 1.25, 40);
      return {
        title: "P contra T (V constante)",
        xLabel: "T (K)", yLabel: "P (atm)",
        curves: [{ label: "P/T = constante", pts: xs.map((x) => [x, m * x]) }],
        points: [
          { x: s.T1, y: s.P1, label: "1" },
          { x: s.T2, y: s.P2, label: "2" },
        ],
      };
    }
    case "combined": {
      const c = (s.P1 * s.V1) / s.T1; // = n·R
      const xs = linspace(Math.min(s.V1, s.V2) * 0.5, Math.max(s.V1, s.V2) * 1.5, 80);
      return {
        title: "Isotermas P–V de los dos estados",
        xLabel: "V (L)", yLabel: "P (atm)",
        curves: [
          { label: `T₁ = ${fmt(s.T1, 4)} K`, pts: xs.map((x) => [x, (c * s.T1) / x]) },
          { label: `T₂ = ${fmt(s.T2, 4)} K`, pts: xs.map((x) => [x, (c * s.T2) / x]), dash: true },
        ],
        points: [
          { x: s.V1, y: s.P1, label: "1" },
          { x: s.V2, y: s.P2, label: "2" },
        ],
      };
    }
    case "ideal": {
      const xs = linspace(s.V * 0.4, s.V * 2.2, 80);
      return {
        title: `Isoterma P–V del gas ideal (T = ${fmt(s.T, 4)} K)`,
        xLabel: "V (L)", yLabel: "P (atm)",
        curves: [{ label: "P = nRT/V", pts: xs.map((x) => [x, (s.n * R * s.T) / x]) }],
        points: [{ x: s.V, y: s.P, label: "●" }],
      };
    }
    case "vdw": {
      const nb = s.n * s.b;
      const xs = linspace(nb + (s.V - nb) * 0.4, nb + (s.V - nb) * 2.5, 100);
      return {
        title: `Gas real vs. ideal (T = ${fmt(s.T, 4)} K)`,
        xLabel: "V (L)", yLabel: "P (atm)",
        curves: [
          { label: "Van der Waals", pts: xs.map((x) => [x, vdw.pressure(x, s.n, s.T, s.a, s.b)]) },
          { label: "Gas ideal", pts: xs.map((x) => [x, (s.n * R * s.T) / x]), dash: true },
        ],
        points: [{ x: s.V, y: s.P, label: "●" }],
      };
    }
    default:
      return null;
  }
}

function el(tag, attrs = {}, text) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
}

export function renderChart(spec, uid) {
  // El ancho se ajusta a la pantalla para que los textos se vean a tamaño real (≈1 px por unidad).
  const W = Math.round(Math.min(560, Math.max(280, window.innerWidth - 70)));
  const H = Math.round(W * 0.64);
  const m = { l: 50, r: 14, t: 12, b: 44 };
  const pw = W - m.l - m.r, ph = H - m.t - m.b;

  const allX = spec.curves.flatMap((c) => c.pts.map((p) => p[0]));
  const xMin = Math.min(...allX), xMax = Math.max(...allX);
  const finiteY = spec.curves.flatMap((c) => c.pts.map((p) => p[1])).filter(Number.isFinite);
  const yMax = Math.max(...finiteY, ...spec.points.map((p) => p.y)) * 1.08;
  const yMin = 0;

  const sx = (x) => m.l + ((x - xMin) / (xMax - xMin)) * pw;
  const sy = (y) => m.t + ph - ((y - yMin) / (yMax - yMin)) * ph;

  const svg = el("svg", {
    viewBox: `0 0 ${W} ${H}`, role: "img", class: "chart",
    "aria-label": `Gráfica: ${spec.title}`,
  });
  const clipId = `clip-${uid}`;
  const defs = el("defs");
  const clip = el("clipPath", { id: clipId });
  clip.append(el("rect", { x: m.l, y: m.t, width: pw, height: ph }));
  defs.append(clip);
  svg.append(defs);

  // Cuadrícula y ejes
  for (const t of niceTicks(yMin, yMax)) {
    const y = sy(t);
    svg.append(el("line", { x1: m.l, x2: m.l + pw, y1: y, y2: y, class: "grid" }));
    svg.append(el("text", { x: m.l - 8, y: y + 4, class: "tick", "text-anchor": "end" }, fmt(t, 3)));
  }
  for (const t of niceTicks(xMin, xMax)) {
    const x = sx(t);
    svg.append(el("line", { x1: x, x2: x, y1: m.t, y2: m.t + ph, class: "grid" }));
    svg.append(el("text", { x, y: m.t + ph + 18, class: "tick", "text-anchor": "middle" }, fmt(t, 3)));
  }
  svg.append(el("line", { x1: m.l, x2: m.l + pw, y1: m.t + ph, y2: m.t + ph, class: "axis" }));
  svg.append(el("line", { x1: m.l, x2: m.l, y1: m.t, y2: m.t + ph, class: "axis" }));
  svg.append(el("text", { x: m.l + pw / 2, y: H - 8, class: "axis-label", "text-anchor": "middle" }, spec.xLabel));
  svg.append(el("text", {
    x: 14, y: m.t + ph / 2, class: "axis-label", "text-anchor": "middle",
    transform: `rotate(-90 14 ${m.t + ph / 2})`,
  }, spec.yLabel));

  // Curvas (recortadas al área de trazado)
  const g = el("g", { "clip-path": `url(#${clipId})` });
  spec.curves.forEach((c, i) => {
    const d = c.pts
      .filter((p) => Number.isFinite(p[1]))
      .map((p, j) => `${j ? "L" : "M"}${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`)
      .join(" ");
    g.append(el("path", { d, class: `curve curve-${i}${c.dash ? " dashed" : ""}` }));
  });
  svg.append(g);

  // Puntos de estado
  for (const p of spec.points) {
    svg.append(el("circle", { cx: sx(p.x), cy: sy(p.y), r: 6, class: "state" }));
    if (p.label !== "●") {
      svg.append(el("text", { x: sx(p.x) + 10, y: sy(p.y) - 8, class: "state-label" }, p.label));
    }
  }

  // Leyenda
  const wrap = document.createElement("figure");
  wrap.className = "chart-wrap";
  const cap = document.createElement("figcaption");
  cap.className = "chart-legend";
  spec.curves.forEach((c, i) => {
    const item = document.createElement("span");
    item.innerHTML = `<i class="swatch swatch-${i}${c.dash ? " dashed" : ""}"></i>`;
    item.append(document.createTextNode(c.label));
    cap.append(item);
  });
  const dot = document.createElement("span");
  dot.innerHTML = '<i class="swatch dot"></i>';
  dot.append(document.createTextNode(spec.points.length > 1 ? "Estados 1 y 2" : "Estado calculado"));
  cap.append(dot);
  wrap.append(svg, cap);
  return wrap;
}
