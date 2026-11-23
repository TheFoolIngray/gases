// Interfaz: menú, pantalla de cada ley, tema y registro de la PWA.

import { ALL_LAWS, LAWS_BY_ID } from "./laws.js";
import { solve } from "./solver.js";
import { InputError } from "./validation.js";
import { UNITS_BY_KIND, fmt } from "./units.js";
import { chartSpec, renderChart } from "./chart.js";

const app = document.getElementById("app");
const CUSTOM_GAS = "Personalizado";

// ------------------------------------------------------------ utilidades DOM
function h(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "style") node.style.cssText = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2).toLowerCase(), v);
    else node.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* opcional */ } },
};

// ------------------------------------------------------------------- tema
function applyTheme(mode) {
  const root = document.documentElement;
  if (mode === "dark" || mode === "light") root.setAttribute("data-theme", mode);
  else root.removeAttribute("data-theme");
  const dark = isDark();
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", dark ? "#12171d" : "#2b5c8a");
}

function isDark() {
  const forced = document.documentElement.getAttribute("data-theme");
  if (forced) return forced === "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function themeButton() {
  const btn = h("button", { class: "icon-btn", type: "button", "aria-label": "Cambiar tema claro u oscuro", title: "Cambiar tema" });
  const paint = () => { btn.textContent = isDark() ? "☀" : "☾"; };
  btn.addEventListener("click", () => {
    const next = isDark() ? "light" : "dark";
    store.set("gaslab.theme", next);
    applyTheme(next);
    document.querySelectorAll(".theme-btn").forEach((b) => (b.textContent = isDark() ? "☀" : "☾"));
  });
  btn.classList.add("theme-btn");
  paint();
  return btn;
}

// ------------------------------------------------------- instalación (PWA)
let installEvent = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  installEvent = e;
  document.querySelectorAll(".install-btn").forEach((b) => (b.hidden = false));
});
window.addEventListener("appinstalled", () => {
  installEvent = null;
  document.querySelectorAll(".install-btn").forEach((b) => (b.hidden = true));
});

function installButton() {
  const btn = h("button", {
    class: "btn btn-small install-btn", type: "button", hidden: !installEvent,
    onClick: async () => {
      if (!installEvent) return;
      installEvent.prompt();
      try { await installEvent.userChoice; } catch { /* sin acción */ }
      installEvent = null;
      btn.hidden = true;
    },
  }, "⬇ Instalar app");
  return btn;
}

// ------------------------------------------------------------- encabezado
function topbar(title, withBack) {
  return h("header", { class: "topbar" },
    withBack
      ? h("a", { class: "icon-btn", href: "#/", "aria-label": "Volver al menú principal", title: "Menú principal" }, "←")
      : h("span", { class: "logo", "aria-hidden": "true" }, "⚗"),
    h("h1", { class: "topbar-title" }, title),
    installButton(),
    themeButton()
  );
}

// ---------------------------------------------------------------- inicio
function renderHome() {
  const tiles = ALL_LAWS.map((law) =>
    h("a", { class: "tile", href: `#/law/${law.id}`, style: `--accent:${law.accent}` },
      h("div", { class: "tile-head" },
        h("span", { class: "tile-icon", "aria-hidden": "true" }, law.icon),
        h("span", { class: "tile-arrow", "aria-hidden": "true" }, "→")),
      h("h2", {}, law.name),
      h("p", { class: "muted" }, law.tagline),
      h("code", { class: "tile-eq" }, law.equation))
  );
  return h("div", {},
    topbar("Laboratorio de Gases", false),
    h("main", { class: "page" },
      h("p", { class: "eyebrow" }, "Termodinámica"),
      h("h2", { class: "hero" }, "Laboratorio de Gases"),
      h("p", { class: "muted lead" },
        "Seis leyes de los gases con despeje automático, conversión de unidades y procedimiento paso a paso."),
      h("div", { class: "grid" }, tiles),
      h("p", { class: "muted small foot" },
        "R = 0.082057 L·atm/(mol·K) · Las temperaturas se calculan en kelvin · Resultados con 6 cifras significativas"))
  );
}

// ----------------------------------------------------- campo con unidad
function createField(variable, onEdit, onSubmit) {
  const id = `f-${variable.key}`;
  const input = h("input", {
    id, class: "input", type: "text", autocomplete: "off", autocapitalize: "off", spellcheck: "false",
    // El teclado decimal de Android no siempre trae el signo menos; en temperaturas (°C) se usa el normal.
    inputmode: variable.kind === "temperature" ? "text" : "decimal",
    enterkeyhint: "done", placeholder: "—",
  });
  const units = UNITS_BY_KIND[variable.kind];
  let select = null;
  let unitEl;
  if (units.length > 1) {
    select = h("select", { class: "select", "aria-label": `Unidad de ${variable.label}` },
      units.map((u) => h("option", { value: u, selected: u === variable.defaultUnit }, u)));
    unitEl = select;
  } else {
    unitEl = h("span", { class: "unit-static" }, variable.defaultUnit);
  }
  const hint = h("div", { class: "hint", id: `${id}-hint`, "aria-live": "polite" });
  const wrap = h("div", { class: "field" },
    h("label", { for: id }, h("b", {}, variable.symbol), ` · ${variable.label}`),
    h("div", { class: "field-row" }, input, unitEl),
    hint);

  input.addEventListener("input", () => { api.clearError(); onEdit(variable.key); });
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); input.blur(); onSubmit(); } });

  const api = {
    el: wrap, input, select,
    raw: () => [input.value, select ? select.value : variable.defaultUnit],
    isBlank: () => !input.value.trim(),
    set(text, unit) { input.value = text; if (unit && select) select.value = unit; api.clearError(); },
    clear() { input.value = ""; if (select) select.value = variable.defaultUnit; api.clearError(); api.setUnknown(false); },
    setError(msg) { wrap.classList.add("has-error"); hint.textContent = msg; input.setAttribute("aria-invalid", "true"); },
    clearError() { wrap.classList.remove("has-error"); input.removeAttribute("aria-invalid"); if (!wrap.classList.contains("is-unknown")) hint.textContent = ""; },
    setUnknown(flag) {
      wrap.classList.toggle("is-unknown", flag);
      if (flag && !wrap.classList.contains("has-error")) hint.textContent = "Incógnita · se calculará";
      else if (!flag && !wrap.classList.contains("has-error")) hint.textContent = "";
    },
  };
  return api;
}

// ------------------------------------------------------ pantalla de una ley
function renderLaw(law) {
  const fields = {};
  const results = h("div", { class: "results", "aria-live": "polite" });
  let gasSelect = null;
  const exampleNote = h("div", { class: "note", hidden: true });
  let chartCounter = 0;

  function refreshUnknown() {
    const blanks = law.variables.filter((v) => fields[v.key].isBlank());
    const target = blanks.length === 1 && blanks[0].solvable ? blanks[0].key : null;
    for (const [k, f] of Object.entries(fields)) f.setUnknown(k === target);
  }

  function showEmpty() {
    results.replaceChildren(
      h("div", { class: "card empty" },
        h("div", { class: "empty-icon", "aria-hidden": "true" }, "🧮"),
        h("h3", {}, "Listo para calcular"),
        h("p", { class: "muted" },
          "Llena los datos que conoces y deja en blanco la incógnita. Luego pulsa «Calcular», o usa «Cargar ejemplo»."))
    );
  }

  function showError(message) {
    results.replaceChildren(
      h("div", { class: "card error", role: "alert" },
        h("h3", {}, "⚠ No se pudo calcular"),
        h("ul", {}, message.split("\n").filter((m) => m.trim()).map((m) => h("li", {}, m))))
    );
  }

  async function copy(text, btn) {
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = "✓ Copiado";
    } catch {
      btn.textContent = "No se pudo copiar";
    }
    setTimeout(() => (btn.textContent = "Copiar"), 1800);
  }

  function showResult(r) {
    const headline = `${r.symbol} = ${fmt(r.value)} ${r.unit}`;
    const copyBtn = h("button", { class: "btn btn-small btn-ghost", type: "button", onClick: () => copy(headline, copyBtn) }, "Copiar");
    const nodes = [
      h("section", { class: "card result", id: "result-card" },
        h("div", { class: "result-top" }, h("span", { class: "result-label" }, `Resultado · ${r.label}`), copyBtn),
        h("div", { class: "result-value", "data-testid": "result" }, headline)),
      ...r.warnings.map((w) => h("div", { class: "card warn", role: "status" }, "⚠ " + w)),
    ];

    const spec = chartSpec(law, r.state);
    if (spec) {
      nodes.push(h("section", { class: "card" },
        h("h3", { class: "section-title" }, "Gráfica"),
        h("p", { class: "muted small" }, spec.title),
        renderChart(spec, ++chartCounter)));
    }

    nodes.push(h("h3", { class: "section-title steps-title" }, "Procedimiento paso a paso"));
    for (const step of r.steps) {
      nodes.push(h("section", { class: "card step" },
        h("h4", {}, step.title),
        h("pre", {}, step.lines.join("\n"))));
    }
    results.replaceChildren(...nodes);
  }

  function calculate() {
    const raw = Object.fromEntries(Object.entries(fields).map(([k, f]) => [k, f.raw()]));
    Object.values(fields).forEach((f) => f.clearError());
    try {
      showResult(solve(law, raw));
    } catch (err) {
      if (err instanceof InputError) {
        for (const k of err.fields) fields[k]?.setError("Revisa este campo");
        showError(err.message);
      } else {
        console.error(err);
        showError("Ocurrió un error inesperado. Revisa los datos e inténtalo de nuevo.");
      }
    }
    refreshUnknown();
    // En pantallas angostas el resultado queda debajo de los datos: se baja hasta él.
    if (window.innerWidth < 980) {
      const top = results.getBoundingClientRect().top + window.scrollY - 70;
      window.scrollTo({ top, behavior: "smooth" });
    }
  }

  function applyGas(name) {
    const [a, b] = law.gasPresets[name];
    fields.a.set(String(a));
    fields.b.set(String(b));
    if (gasSelect) gasSelect.value = name;
  }

  function loadExample() {
    const ex = law.example;
    for (const v of law.variables) {
      if (ex.values[v.key]) fields[v.key].set(...ex.values[v.key]);
      else if (v.key === ex.unknown) fields[v.key].clear();
    }
    if (ex.gas) applyGas(ex.gas);
    exampleNote.textContent = `💡 Ejemplo: ${ex.description}`;
    exampleNote.hidden = false;
    calculate();
  }

  function clearAll() {
    Object.values(fields).forEach((f) => f.clear());
    if (gasSelect) gasSelect.value = CUSTOM_GAS;
    exampleNote.hidden = true;
    showEmpty();
  }

  const onEdit = (key) => {
    if (gasSelect && (key === "a" || key === "b")) gasSelect.value = CUSTOM_GAS;
    refreshUnknown();
  };
  for (const v of law.variables) fields[v.key] = createField(v, onEdit, calculate);

  if (law.gasPresets) {
    gasSelect = h("select", { class: "select select-wide", id: "gas-select", "aria-label": "Gas" },
      [CUSTOM_GAS, ...Object.keys(law.gasPresets)].map((g) => h("option", { value: g }, g)));
    gasSelect.addEventListener("change", () => {
      if (gasSelect.value !== CUSTOM_GAS) applyGas(gasSelect.value);
      refreshUnknown();
    });
  }

  const soft = `--accent:${law.accent}`;
  const theory = h("section", { class: "card", style: soft },
    h("div", { class: "law-head" },
      h("span", { class: "tile-icon", "aria-hidden": "true" }, law.icon),
      h("div", {}, h("h2", {}, law.name), h("p", { class: "muted" }, law.tagline))),
    h("div", { class: "equation", "data-testid": "equation" }, law.equation),
    law.theory.map((p) => h("p", {}, p)),
    h("p", { class: "muted small" }, law.constantsNote));

  const inputs = h("section", { class: "card" },
    h("h3", { class: "section-title" }, "Datos"),
    h("p", { class: "muted small" }, "Deja en blanco el campo que quieres calcular."),
    gasSelect && h("div", { class: "field" }, h("label", { for: "gas-select" }, "Gas (rellena a y b)"), gasSelect),
    law.variables.map((v) => fields[v.key].el),
    exampleNote,
    h("div", { class: "actions" },
      h("button", { class: "btn btn-primary", type: "button", id: "btn-calc", onClick: calculate }, "▶ Calcular"),
      h("button", { class: "btn", type: "button", id: "btn-example", onClick: loadExample }, "💡 Cargar ejemplo"),
      h("button", { class: "btn btn-ghost", type: "button", id: "btn-clear", onClick: clearAll }, "Limpiar")));

  showEmpty();
  return h("div", {},
    topbar(law.name, true),
    h("main", { class: "page law-page" },
      h("div", { class: "law-left" }, theory, inputs),
      h("div", { class: "law-right" }, results)));
}

// ------------------------------------------------------------- navegación
function route() {
  const hash = location.hash.replace(/^#/, "") || "/";
  const m = hash.match(/^\/law\/([\w-]+)$/);
  const law = m && LAWS_BY_ID[m[1]];
  const view = law ? renderLaw(law) : renderHome();
  document.title = law ? `${law.name} · Laboratorio de Gases` : "Laboratorio de Gases";
  app.replaceChildren(view);
  window.scrollTo(0, 0);
}

window.addEventListener("hashchange", route);

applyTheme(store.get("gaslab.theme"));
route();

// ----------------------------------------------------- service worker (offline)
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((e) => console.warn("SW no registrado:", e));
  });
}
