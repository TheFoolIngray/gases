// Las seis leyes: variables, despejes, teoría y ejemplos.
// Todas las funciones `compute` reciben valores en UNIDADES BASE (atm, L, K, mol).

import * as vdw from "./vdw.js";
import { A_UNIT, B_UNIT, R } from "./units.js";

const v = (key, symbol, label, kind, defaultUnit, solvable = true) => ({
  key, symbol, label, kind, defaultUnit, solvable,
});

const sol = (isolated, template, compute) => ({ isolated, template, compute });

const BOYLE = {
  id: "boyle",
  name: "Ley de Boyle",
  icon: "⇅",
  accent: "#2f6fbf",
  tagline: "Presión ↔ Volumen a temperatura constante",
  equation: "P₁·V₁ = P₂·V₂",
  theory: [
    "Robert Boyle observó que, a temperatura y cantidad de gas constantes, la presión de un gas es inversamente proporcional a su volumen: si el volumen se reduce a la mitad, la presión se duplica.",
    "Proceso isotérmico: el producto P·V permanece constante entre el estado 1 y el 2.",
  ],
  constantsNote: "Constantes: T y n",
  variables: [
    v("P1", "P₁", "Presión inicial", "pressure", "atm"),
    v("V1", "V₁", "Volumen inicial", "volume", "L"),
    v("P2", "P₂", "Presión final", "pressure", "atm"),
    v("V2", "V₂", "Volumen final", "volume", "L"),
  ],
  solutions: {
    P1: sol("P₁ = P₂·V₂ / V₁", "{P2}·{V2} / {V1}", (x) => (x.P2 * x.V2) / x.V1),
    V1: sol("V₁ = P₂·V₂ / P₁", "{P2}·{V2} / {P1}", (x) => (x.P2 * x.V2) / x.P1),
    P2: sol("P₂ = P₁·V₁ / V₂", "{P1}·{V1} / {V2}", (x) => (x.P1 * x.V1) / x.V2),
    V2: sol("V₂ = P₁·V₁ / P₂", "{P1}·{V1} / {P2}", (x) => (x.P1 * x.V1) / x.P2),
  },
  example: {
    description: "Un gas ocupa 12 L a 1 atm. ¿Qué volumen ocupa si la presión sube a 3 atm sin cambiar la temperatura?",
    values: { P1: ["1", "atm"], V1: ["12", "L"], P2: ["3", "atm"] },
    unknown: "V2",
  },
};

const CHARLES = {
  id: "charles",
  name: "Ley de Charles",
  icon: "🌡",
  accent: "#d9831f",
  tagline: "Volumen ↔ Temperatura a presión constante",
  equation: "V₁ / T₁ = V₂ / T₂",
  theory: [
    "Jacques Charles mostró que, a presión y cantidad de gas constantes, el volumen es directamente proporcional a la temperatura ABSOLUTA: al calentar un gas, se expande.",
    "La temperatura debe estar en kelvin (K = °C + 273.15). La app convierte automáticamente desde °C o °F.",
  ],
  constantsNote: "Constantes: P y n",
  variables: [
    v("V1", "V₁", "Volumen inicial", "volume", "L"),
    v("T1", "T₁", "Temperatura inicial", "temperature", "°C"),
    v("V2", "V₂", "Volumen final", "volume", "L"),
    v("T2", "T₂", "Temperatura final", "temperature", "°C"),
  ],
  solutions: {
    V1: sol("V₁ = V₂·T₁ / T₂", "{V2}·{T1} / {T2}", (x) => (x.V2 * x.T1) / x.T2),
    T1: sol("T₁ = V₁·T₂ / V₂", "{V1}·{T2} / {V2}", (x) => (x.V1 * x.T2) / x.V2),
    V2: sol("V₂ = V₁·T₂ / T₁", "{V1}·{T2} / {T1}", (x) => (x.V1 * x.T2) / x.T1),
    T2: sol("T₂ = V₂·T₁ / V₁", "{V2}·{T1} / {V1}", (x) => (x.V2 * x.T1) / x.V1),
  },
  example: {
    description: "Un globo tiene 2 L a 25 °C. ¿Qué volumen tendrá al calentarlo a 100 °C a presión constante?",
    values: { V1: ["2", "L"], T1: ["25", "°C"], T2: ["100", "°C"] },
    unknown: "V2",
  },
};

const GAY_LUSSAC = {
  id: "gay_lussac",
  name: "Ley de Gay-Lussac",
  icon: "🔥",
  accent: "#c8473d",
  tagline: "Presión ↔ Temperatura a volumen constante",
  equation: "P₁ / T₁ = P₂ / T₂",
  theory: [
    "Joseph Gay-Lussac estableció que, a volumen y cantidad de gas constantes, la presión es directamente proporcional a la temperatura absoluta: calentar un recipiente rígido aumenta su presión.",
    "Es la razón por la que un envase cerrado puede reventar al calentarse.",
  ],
  constantsNote: "Constantes: V y n",
  variables: [
    v("P1", "P₁", "Presión inicial", "pressure", "kPa"),
    v("T1", "T₁", "Temperatura inicial", "temperature", "°C"),
    v("P2", "P₂", "Presión final", "pressure", "kPa"),
    v("T2", "T₂", "Temperatura final", "temperature", "°C"),
  ],
  solutions: {
    P1: sol("P₁ = P₂·T₁ / T₂", "{P2}·{T1} / {T2}", (x) => (x.P2 * x.T1) / x.T2),
    T1: sol("T₁ = P₁·T₂ / P₂", "{P1}·{T2} / {P2}", (x) => (x.P1 * x.T2) / x.P2),
    P2: sol("P₂ = P₁·T₂ / T₁", "{P1}·{T2} / {T1}", (x) => (x.P1 * x.T2) / x.T1),
    T2: sol("T₂ = P₂·T₁ / P₁", "{P2}·{T1} / {P1}", (x) => (x.P2 * x.T1) / x.P1),
  },
  example: {
    description: "Un tanque rígido contiene gas a 200 kPa y 20 °C. ¿Qué presión alcanza al calentarse a 80 °C?",
    values: { P1: ["200", "kPa"], T1: ["20", "°C"], T2: ["80", "°C"] },
    unknown: "P2",
  },
};

const COMBINED = {
  id: "combined",
  name: "Ley Combinada de los Gases",
  icon: "∞",
  accent: "#7b4fb3",
  tagline: "Presión, volumen y temperatura (n constante)",
  equation: "P₁·V₁ / T₁ = P₂·V₂ / T₂",
  theory: [
    "Reúne las leyes de Boyle, Charles y Gay-Lussac en una sola expresión: para una cantidad fija de gas, el cociente P·V/T se mantiene constante entre dos estados.",
    "Permite calcular cualquiera de las seis variables cuando cambian presión, volumen y temperatura a la vez.",
  ],
  constantsNote: "Constante: n",
  variables: [
    v("P1", "P₁", "Presión inicial", "pressure", "atm"),
    v("V1", "V₁", "Volumen inicial", "volume", "L"),
    v("T1", "T₁", "Temperatura inicial", "temperature", "°C"),
    v("P2", "P₂", "Presión final", "pressure", "atm"),
    v("V2", "V₂", "Volumen final", "volume", "L"),
    v("T2", "T₂", "Temperatura final", "temperature", "°C"),
  ],
  solutions: {
    P1: sol("P₁ = P₂·V₂·T₁ / (V₁·T₂)", "{P2}·{V2}·{T1} / ({V1}·{T2})", (x) => (x.P2 * x.V2 * x.T1) / (x.V1 * x.T2)),
    V1: sol("V₁ = P₂·V₂·T₁ / (P₁·T₂)", "{P2}·{V2}·{T1} / ({P1}·{T2})", (x) => (x.P2 * x.V2 * x.T1) / (x.P1 * x.T2)),
    T1: sol("T₁ = P₁·V₁·T₂ / (P₂·V₂)", "{P1}·{V1}·{T2} / ({P2}·{V2})", (x) => (x.P1 * x.V1 * x.T2) / (x.P2 * x.V2)),
    P2: sol("P₂ = P₁·V₁·T₂ / (V₂·T₁)", "{P1}·{V1}·{T2} / ({V2}·{T1})", (x) => (x.P1 * x.V1 * x.T2) / (x.V2 * x.T1)),
    V2: sol("V₂ = P₁·V₁·T₂ / (P₂·T₁)", "{P1}·{V1}·{T2} / ({P2}·{T1})", (x) => (x.P1 * x.V1 * x.T2) / (x.P2 * x.T1)),
    T2: sol("T₂ = P₂·V₂·T₁ / (P₁·V₁)", "{P2}·{V2}·{T1} / ({P1}·{V1})", (x) => (x.P2 * x.V2 * x.T1) / (x.P1 * x.V1)),
  },
  example: {
    description: "Un gas ocupa 10 L a 1 atm y 27 °C. ¿Qué volumen ocupará a 2 atm y 127 °C?",
    values: {
      P1: ["1", "atm"], V1: ["10", "L"], T1: ["27", "°C"],
      P2: ["2", "atm"], T2: ["127", "°C"],
    },
    unknown: "V2",
  },
};

const IDEAL = {
  id: "ideal",
  name: "Ley de los Gases Ideales",
  icon: "⚗",
  accent: "#1e8f8a",
  tagline: "PV = nRT",
  equation: "P·V = n·R·T",
  theory: [
    "Modelo que describe un gas cuyas partículas no interactúan y tienen volumen despreciable. Relaciona las cuatro variables de estado: presión, volumen, cantidad de sustancia y temperatura.",
    "R = 0.082057 L·atm/(mol·K). Funciona bien a presiones bajas y temperaturas altas; para condiciones extremas usa Van der Waals.",
  ],
  constantsNote: "R = 0.082057 L·atm/(mol·K)",
  variables: [
    v("P", "P", "Presión", "pressure", "atm"),
    v("V", "V", "Volumen", "volume", "L"),
    v("n", "n", "Cantidad de gas", "moles", "mol"),
    v("T", "T", "Temperatura", "temperature", "K"),
  ],
  solutions: {
    P: sol("P = n·R·T / V", "{n}·{R}·{T} / {V}", (x) => (x.n * R * x.T) / x.V),
    V: sol("V = n·R·T / P", "{n}·{R}·{T} / {P}", (x) => (x.n * R * x.T) / x.P),
    n: sol("n = P·V / (R·T)", "{P}·{V} / ({R}·{T})", (x) => (x.P * x.V) / (R * x.T)),
    T: sol("T = P·V / (n·R)", "{P}·{V} / ({n}·{R})", (x) => (x.P * x.V) / (x.n * R)),
  },
  example: {
    description: "¿Qué presión ejercen 2 mol de gas ideal en un recipiente de 10 L a 25 °C?",
    values: { V: ["10", "L"], n: ["2", "mol"], T: ["25", "°C"] },
    unknown: "P",
  },
};

// (a [L²·atm/mol²], b [L/mol]) — valores típicos de tablas
export const VDW_GASES = {
  "He": [0.0346, 0.0238],
  "H₂": [0.2476, 0.02661],
  "N₂": [1.37, 0.0387],
  "O₂": [1.382, 0.03186],
  "Ar": [1.355, 0.03201],
  "CO₂": [3.64, 0.04267],
  "CH₄": [2.283, 0.04278],
  "NH₃": [4.225, 0.0371],
  "H₂O": [5.536, 0.03049],
};

const VAN_DER_WAALS = {
  id: "vdw",
  name: "Ecuación de Van der Waals",
  icon: "◍",
  accent: "#4c8f3a",
  tagline: "Gases reales: corrige volumen e interacciones",
  equation: "(P + a·n²/V²)(V − n·b) = n·R·T",
  theory: [
    "Mejora el modelo ideal con dos correcciones: «b» descuenta el volumen propio de las moléculas y «a» considera las fuerzas de atracción entre ellas (reducen la presión medida).",
    "Las constantes a y b dependen de cada gas. Elige un gas de la lista o escribe tus propios valores. P y T se despejan directamente; V y n requieren resolver una ecuación cúbica (la app lo hace numéricamente).",
  ],
  constantsNote: "a en L²·atm/mol², b en L/mol",
  variables: [
    v("P", "P", "Presión", "pressure", "atm"),
    v("V", "V", "Volumen", "volume", "L"),
    v("n", "n", "Cantidad de gas", "moles", "mol"),
    v("T", "T", "Temperatura", "temperature", "K"),
    v("a", "a", "Constante a", "vdw_a", A_UNIT, false),
    v("b", "b", "Constante b", "vdw_b", B_UNIT, false),
  ],
  solutions: {
    P: sol("P = n·R·T / (V − n·b) − a·n² / V²",
      "{n}·{R}·{T} / ({V} − {n}·{b}) − {a}·{n}² / {V}²",
      (x) => vdw.pressure(x.V, x.n, x.T, x.a, x.b)),
    T: sol("T = (P + a·n²/V²)·(V − n·b) / (n·R)",
      "({P} + {a}·{n}² / {V}²)·({V} − {n}·{b}) / ({n}·{R})",
      (x) => vdw.temperature(x.P, x.V, x.n, x.a, x.b)),
    V: sol("V: raíz de la cúbica  P·V³ − (n·b·P + n·R·T)·V² + a·n²·V − a·b·n³ = 0",
      null, (x) => vdw.solveVolume(x.P, x.n, x.T, x.a, x.b)),
    n: sol("n: raíz de la cúbica  a·b·n³ − a·V·n² + (P·b + R·T)·V²·n − P·V³ = 0",
      null, (x) => vdw.solveMoles(x.P, x.V, x.T, x.a, x.b)),
  },
  example: {
    description: "Presión de 1 mol de CO₂ en 0.5 L a 300 K. Compárala con el resultado del gas ideal.",
    values: { V: ["0.5", "L"], n: ["1", "mol"], T: ["300", "K"] },
    unknown: "P",
    gas: "CO₂",
  },
  gasPresets: VDW_GASES,
};

export const ALL_LAWS = [BOYLE, CHARLES, GAY_LUSSAC, COMBINED, IDEAL, VAN_DER_WAALS];
export const LAWS_BY_ID = Object.fromEntries(ALL_LAWS.map((l) => [l.id, l]));
