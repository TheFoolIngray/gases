// Interfaz: cabecera institucional, menú, pantalla de cada ley, tema y registro de la PWA.

import { ALL_LAWS, LAWS_BY_ID, VDW_TABLE } from "./laws.js";
import { solve } from "./solver.js";
import { InputError } from "./validation.js";
import { UNITS_BY_KIND, fmt } from "./units.js";
import { chartSpec, renderChart } from "./chart.js";
import { h } from "./dom.js";
import { createSimulation } from "./sim.js";

const app = document.getElementById("app");
const CUSTOM_GAS = "Personalizado";

// ------------------------------------------------------------ utilidades DOM
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* opcional */ } },
};

// ------------------------------------------------------------------- tema
function isDark() {
  const forced = document.documentElement.getAttribute("data-theme");
  if (forced) return forced === "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(mode) {
  const root = document.documentElement;
  if (mode === "dark" || mode === "light") root.setAttribute("data-theme", mode);
  else root.removeAttribute("data-theme");
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", isDark() ? "#0c3d73" : "#0a58a8");
  document.querySelectorAll(".theme-btn").forEach((b) => (b.textContent = isDark() ? "Modo claro" : "Modo oscuro"));
}

function themeButton() {
  const btn = h("button", {
    class: "bar-btn theme-btn", type: "button", title: "Cambiar entre tema claro y oscuro",
    onClick: () => {
      const next = isDark() ? "light" : "dark";
      store.set("gaslab.theme", next);
      applyTheme(next);
    },
  }, isDark() ? "Modo claro" : "Modo oscuro");
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
    class: "bar-btn install-btn", type: "button", hidden: !installEvent,
    onClick: async () => {
      if (!installEvent) return;
      installEvent.prompt();
      try { await installEvent.userChoice; } catch { /* sin acción */ }
      installEvent = null;
      btn.hidden = true;
    },
  }, "Instalar app");
  return btn;
}

// ------------------------------------------------------------- encabezados
const hideBroken = (e) => { e.target.style.display = "none"; };

function institutionalHeader() {
  return h("header", { class: "inst" },
    h("img", { class: "logo-uv", src: "img/logo-uv.png", alt: "Universidad Veracruzana", onError: hideBroken }),
    h("div", { class: "inst-text" },
      h("strong", {}, "Universidad Veracruzana"),
      h("span", {}, "Facultad de Ciencias Químicas · Orizaba")),
    h("img", { class: "logo-fcq", src: "img/logo-fcq.png", alt: "Facultad de Ciencias Químicas, Orizaba", onError: hideBroken })
  );
}

function appbar(title, withBack) {
  return h("div", { class: "appbar" },
    withBack && h("a", { class: "bar-btn", href: "#/", "aria-label": "Volver al menú principal" }, "‹ Menú"),
    h("h1", { class: "appbar-title" }, title),
    installButton(),
    themeButton()
  );
}

// ---------------------------------------------------------------- inicio
function renderHome() {
  const items = ALL_LAWS.map((law, i) =>
    h("li", {},
      h("a", { class: "tile", href: `#/law/${law.id}` },
        h("span", { class: "key-num", "aria-hidden": "true" }, String(i + 1)),
        h("span", { class: "tile-main" }, h("b", {}, law.name), h("small", {}, law.tagline)),
        h("code", { class: "tile-eq" }, law.equation)))
  );
  return h("div", {},
    institutionalHeader(),
    appbar("Laboratorio de Gases", false),
    h("main", { class: "page" },
      h("h2", { class: "page-title" }, "Calculadora de las leyes de los gases"),
      h("p", { class: "page-intro muted" },
        "Elige una función. En cada una, llena los datos que conoces y deja en blanco el que quieres calcular: la app despeja, convierte unidades y muestra el procedimiento."),
      h("ol", { class: "menu" }, items),
      h("ul", { class: "menu menu-info" },
        h("li", {},
          h("a", { class: "tile", href: "#/about" },
            h("span", { class: "key-num", "aria-hidden": "true" }, "i"),
            h("span", { class: "tile-main" },
              h("b", {}, "Acerca de la aplicación"),
              h("small", {}, "Materia, equipo, docente y fecha"))))),
      h("div", { class: "lcd lcd-mini", style: "margin-top:16px" },
        h("div", {}, "R = 0.082057 L·atm/(mol·K)"),
        h("div", {}, "T en kelvin · resultados a 6 cifras significativas")),
      h("p", { class: "foot muted small" },
        "Termodinámica · Universidad Veracruzana, Facultad de Ciencias Químicas, Orizaba"))
  );
}

// ----------------------------------------------------- campo con unidad
function createField(variable, onEdit, onSubmit) {
  const id = `f-${variable.key}`;
  const input = h("input", {
    id, class: "input", type: "text", autocomplete: "off", autocapitalize: "off", spellcheck: "false",
    // El teclado decimal de Android no siempre trae el signo menos; en temperaturas (°C) se usa el normal.
    inputmode: variable.kind === "temperature" ? "text" : "decimal",
    enterkeyhint: "done",
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
    h("label", { for: id }, h("b", { class: "sym" }, variable.symbol), ` ${variable.label}`),
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
    clearError() {
      wrap.classList.remove("has-error");
      input.removeAttribute("aria-invalid");
      hint.textContent = wrap.classList.contains("is-unknown") ? "Incógnita · se calculará" : "";
    },
    setUnknown(flag) {
      wrap.classList.toggle("is-unknown", flag);
      input.placeholder = flag ? "?" : "";
      if (!wrap.classList.contains("has-error")) hint.textContent = flag ? "Incógnita · se calculará" : "";
    },
  };
  return api;
}

// ------------------------------------------------------ pantalla de una ley
function panel(title, ...body) {
  return h("section", { class: "card" }, h("h3", { class: "card-title" }, title), h("div", { class: "card-body" }, body));
}

function renderLaw(law) {
  const fields = {};
  const results = h("div", { class: "results", "aria-live": "polite" });
  let gasSelect = null;
  const sim = law.gasPresets ? createSimulation("CO₂") : null;
  const exampleNote = h("div", { class: "note", hidden: true });
  let chartCounter = 0;

  function refreshUnknown() {
    const blanks = law.variables.filter((v) => fields[v.key].isBlank());
    const target = blanks.length === 1 && blanks[0].solvable ? blanks[0].key : null;
    for (const [k, f] of Object.entries(fields)) f.setUnknown(k === target);
  }

  const lcdIdle = () =>
    h("section", { class: "lcd" },
      h("div", { class: "lcd-top" }, h("span", { class: "lcd-label" }, "Listo para calcular")),
      h("div", { class: "lcd-value dim" }, "0"));

  function showEmpty() {
    results.replaceChildren(
      lcdIdle(),
      panel("Cómo usarla",
        h("p", {}, "Llena los datos que conoces y deja en blanco la incógnita. Después pulsa «Calcular», o usa «Cargar ejemplo» para ver un caso resuelto.")));
  }

  function showError(message) {
    results.replaceChildren(
      h("section", { class: "lcd" },
        h("div", { class: "lcd-top" }, h("span", { class: "lcd-label" }, "Revisa los datos")),
        h("div", { class: "lcd-value" }, "Error")),
      h("section", { class: "card error", role: "alert" },
        h("h3", { class: "card-title" }, "No se pudo calcular"),
        h("div", { class: "card-body" },
          h("ul", {}, message.split("\n").filter((m) => m.trim()).map((m) => h("li", {}, m)))))
    );
  }

  async function copy(text, btn) {
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = "Copiado";
    } catch {
      btn.textContent = "No se pudo";
    }
    setTimeout(() => (btn.textContent = "Copiar"), 1800);
  }

  function showResult(r) {
    const headline = `${r.symbol} = ${fmt(r.value)} ${r.unit}`;
    const copyBtn = h("button", { class: "lcd-copy", type: "button", onClick: () => copy(headline, copyBtn) }, "Copiar");
    const nodes = [
      h("section", { class: "lcd", id: "result-card" },
        h("div", { class: "lcd-top" }, h("span", { class: "lcd-label" }, `Resultado · ${r.label}`), copyBtn),
        h("div", { class: "lcd-value", "data-testid": "result" },
          h("span", { class: "sym" }, `${r.symbol} =`), " ", fmt(r.value), " ", h("span", { class: "unit" }, r.unit))),
      ...r.warnings.map((w) => h("section", { class: "card warn", role: "status" }, h("div", { class: "card-body" }, w))),
    ];

    const spec = chartSpec(law, r.state);
    if (spec) {
      nodes.push(panel("Gráfica", h("p", { class: "muted small" }, spec.title), renderChart(spec, ++chartCounter)));
    }

    nodes.push(
      h("section", { class: "card tape" },
        h("h3", { class: "card-title" }, "Procedimiento paso a paso"),
        h("div", { class: "card-body" },
          r.steps.map((step) =>
            h("div", { class: "step" }, h("h4", {}, step.title), h("pre", {}, step.lines.join("\n"))))))
    );
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
      const bar = document.querySelector(".appbar");
      const offset = (bar ? bar.offsetHeight : 52) + 8;
      const top = results.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: "smooth" });
    }
  }

  function applyGas(name) {
    const [a, b] = law.gasPresets[name];
    fields.a.set(String(a));
    fields.b.set(String(b));
    if (gasSelect) gasSelect.value = name;
    if (sim) sim.setGas(name); // la simulación sigue al gas elegido
  }

  function loadExample() {
    const ex = law.example;
    for (const v of law.variables) {
      if (ex.values[v.key]) fields[v.key].set(...ex.values[v.key]);
      else if (v.key === ex.unknown) fields[v.key].clear();
    }
    if (ex.gas) applyGas(ex.gas);
    exampleNote.textContent = `Ejemplo: ${ex.description}`;
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
      h("option", { value: CUSTOM_GAS }, CUSTOM_GAS),
      VDW_TABLE.map(({ group, rows }) =>
        h("optgroup", { label: group },
          rows.map(([formula, name]) => h("option", { value: formula }, `${formula} · ${name}`)))));
    gasSelect.addEventListener("change", () => {
      if (gasSelect.value !== CUSTOM_GAS) applyGas(gasSelect.value);
      refreshUnknown();
    });
  }

  // Tabla de consulta de constantes a y b (solo Van der Waals): se filtra y al tocar una fila se carga.
  function constantsTable() {
    const status = h("div", { class: "hint ref-status", "aria-live": "polite" }, "Toca una fila para usar ese gas.");
    const search = h("input", {
      class: "input ref-search", type: "search", placeholder: "Buscar por nombre o fórmula",
      "aria-label": "Buscar gas en la tabla", autocomplete: "off", spellcheck: "false",
    });
    const groups = VDW_TABLE.map(({ group, rows }) => {
      const head = h("tr", { class: "group" }, h("td", { colspan: 4 }, group));
      const items = rows.map(([formula, name, aBar, b]) => {
        const [a] = law.gasPresets[formula];
        const pick = () => {
          applyGas(formula);
          refreshUnknown();
          status.textContent = `Cargado: ${formula} (${name}) · a = ${a} L²·atm/mol², b = ${b} L/mol`;
        };
        const tr = h("tr", { class: "pick", tabindex: "0", role: "button", "aria-label": `Usar ${name}`, onClick: pick },
          h("td", {}, h("b", {}, formula)),
          h("td", {}, name),
          h("td", { class: "num" }, String(a)),
          h("td", { class: "num" }, String(b)));
        tr.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } });
        return { tr, text: `${formula} ${name}`.toLowerCase() };
      });
      return { head, items };
    });
    const tbody = h("tbody", {}, groups.map((g) => [g.head, g.items.map((i) => i.tr)]));
    const empty = h("div", { class: "muted small ref-empty", hidden: true }, "Ningún gas coincide. Escribe tus propios valores de a y b.");
    search.addEventListener("input", () => {
      const q = search.value.trim().toLowerCase();
      let any = false;
      for (const g of groups) {
        let shown = 0;
        for (const i of g.items) {
          const ok = !q || i.text.includes(q);
          i.tr.hidden = !ok;
          if (ok) shown++;
        }
        g.head.hidden = shown === 0;
        if (shown) any = true;
      }
      empty.hidden = any;
    });
    const total = groups.reduce((n, g) => n + g.items.length, 0);
    return h("details", { class: "ref", id: "vdw-table" },
      h("summary", {}, `Tabla de constantes a y b (${total} sustancias)`),
      h("div", { class: "ref-body" },
        search,
        h("p", { class: "muted small" }, "a en L²·atm/mol² · b en L/mol"),
        h("div", { class: "ref-scroll" },
          h("table", { class: "ref-table" },
            h("thead", {}, h("tr", {},
              h("th", {}, "Fórmula"), h("th", {}, "Sustancia"),
              h("th", { class: "num" }, "a"), h("th", { class: "num" }, "b"))),
            tbody)),
        empty,
        status,
        h("p", { class: "muted small" },
          "Fuente: LibreTexts, tabla A8 (valores en L²·bar/mol², convertidos a atm con 1 bar = 0.986923 atm). ",
          "Cambian un poco de una fuente a otra; si tu libro usa otros, escríbelos en los campos.")));
  }

  const number = ALL_LAWS.indexOf(law) + 1;
  const theory = panel(`Función ${number} · Fundamento`,
    h("h2", { class: "law-name", "data-testid": "law-name" }, law.name),
    h("p", { class: "muted" }, law.tagline),
    h("div", { class: "equation", "data-testid": "equation" }, law.equation),
    law.theory.map((p) => h("p", {}, p)),
    h("p", { class: "muted small" }, law.constantsNote));

  const inputs = panel("Datos de entrada",
    h("p", { class: "muted small" }, "Deja en blanco el campo que quieres calcular."),
    gasSelect && h("div", { class: "field" }, h("label", { for: "gas-select" }, "Gas (rellena a y b)"), gasSelect),
    law.variables.map((v) => fields[v.key].el),
    exampleNote,
    h("div", { class: "actions" },
      h("button", { class: "btn btn-go", type: "button", id: "btn-calc", onClick: calculate }, "Calcular"),
      h("button", { class: "btn btn-blue", type: "button", id: "btn-example", onClick: loadExample }, "Cargar ejemplo"),
      h("button", { class: "btn", type: "button", id: "btn-clear", onClick: clearAll }, "Limpiar")));

  showEmpty();
  return h("div", {},
    institutionalHeader(),
    appbar(law.name, true),
    h("main", { class: "page law-page", "data-law": law.id },
      h("div", { class: "law-left" }, theory, inputs, law.gasPresets && constantsTable()),
      h("div", { class: "law-right" }, results, sim && sim.el)));
}

// ------------------------------------------------------------ acerca de
const ABOUT = {
  app: "Laboratorio de Gases",
  course: "Termodinámica",
  teacher: "Carlos Alberto Martínez Carmona",
  group: "IBIO",
  date: "27/11/2026",
  members: ["Omar Díaz Montalvo", "Abisai Herrera Velasco", "Jesús Serafín Castillo Torres", "Emanuel Tiburcio Romero"],
};

function renderAbout() {
  const row = (label, value) => [h("dt", {}, label), h("dd", {}, value)];
  return h("div", {},
    institutionalHeader(),
    appbar("Acerca de", true),
    h("main", { class: "page about", "data-page": "about" },
      h("div", { class: "about-grid" },
        panel("Datos de la actividad",
          h("dl", { class: "about-dl" },
            row("Aplicación", ABOUT.app),
            row("Experiencia educativa", ABOUT.course),
            row("Docente", ABOUT.teacher),
            row("Grupo", ABOUT.group),
            row("Fecha de creación", ABOUT.date),
            row("Institución", "Universidad Veracruzana · Facultad de Ciencias Químicas, Orizaba"))),
        panel("Integrantes del equipo",
          h("ol", { class: "about-members" }, ABOUT.members.map((n) => h("li", {}, n)))),
        panel("Sobre la aplicación",
          h("p", {}, "Resuelve y simula las leyes de Boyle, Charles, Gay-Lussac, la ley combinada, los gases ideales y la ecuación de Van der Waals. " +
            "Despeja la incógnita que dejes en blanco, convierte unidades y muestra el procedimiento paso a paso."),
          h("p", {}, "Está hecha con HTML, CSS y JavaScript como aplicación web instalable (PWA): funciona en Android, iOS y escritorio, y sin conexión una vez instalada."),
          h("p", { class: "muted small" },
            "Constante R = 0.082057 L·atm/(mol·K). Constantes a y b de Van der Waals: LibreTexts, tabla A8 (convertidas a atm)."))))
  );
}

// ------------------------------------------------------------- navegación
function route() {
  const hash = location.hash.replace(/^#/, "") || "/";
  const m = hash.match(/^\/law\/([\w-]+)$/);
  const law = m && LAWS_BY_ID[m[1]];
  const view = law ? renderLaw(law) : hash === "/about" ? renderAbout() : renderHome();
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
