// Van der Waals:  (P + a·n²/V²)(V − n·b) = n·R·T
// P y T se despejan en forma cerrada. V y n llevan a cúbicas que se resuelven
// numéricamente (barrido de signo + bisección).

import { R, fmt } from "./units.js";
import { InputError } from "./validation.js";

const GRID_POINTS = 6000;

export function residual(P, V, n, T, a, b) {
  return (P + (a * n * n) / (V * V)) * (V - n * b) - n * R * T;
}

function requireFreeVolume(V, n, b) {
  if (V <= n * b) {
    throw new InputError(
      `Volumen imposible: V = ${fmt(V)} L debe ser mayor que n·b = ` +
        `${fmt(n * b)} L (volumen propio de las moléculas).`
    );
  }
}

export function pressure(V, n, T, a, b) {
  requireFreeVolume(V, n, b);
  return (n * R * T) / (V - n * b) - (a * n * n) / (V * V);
}

export function temperature(P, V, n, a, b) {
  requireFreeVolume(V, n, b);
  return ((P + (a * n * n) / (V * V)) * (V - n * b)) / (n * R);
}

function bisect(f, lo, hi, fLo) {
  for (let i = 0; i < 300; i++) {
    const mid = 0.5 * (lo + hi);
    const fMid = f(mid);
    if (fMid === 0) return mid;
    if (fMid > 0 === fLo > 0) {
      lo = mid;
      fLo = fMid;
    } else {
      hi = mid;
    }
    if (hi - lo <= 1e-15 * Math.max(1, Math.abs(hi))) break;
  }
  return 0.5 * (lo + hi);
}

function rootsOnGrid(f, grid) {
  const roots = [];
  let prevX = grid[0];
  let prevF = f(prevX);
  for (let i = 1; i < grid.length; i++) {
    const x = grid[i];
    const fx = f(x);
    if (prevF === 0) roots.push(prevX);
    else if (prevF * fx < 0) roots.push(bisect(f, prevX, x, prevF));
    prevX = x;
    prevF = fx;
  }
  if (prevF === 0) roots.push(prevX);
  return roots;
}

function logGrid(top, decades) {
  const out = new Array(GRID_POINTS + 1);
  for (let k = 0; k <= GRID_POINTS; k++) {
    out[k] = top * Math.pow(10, -decades + (decades * k) / GRID_POINTS);
  }
  return out;
}

// Resuelve V. Con varias raíces devuelve la de la fase gaseosa (mayor V).
export function solveVolume(P, n, T, a, b) {
  const nb = n * b;
  const xTop = (10 * n * R * T) / P; // V = n·b + x; garantiza f(xTop) > 0
  const roots = rootsOnGrid((x) => residual(P, nb + x, n, T, a, b), logGrid(xTop, 9));
  if (!roots.length) {
    throw new InputError("No se encontró un volumen físico que cumpla la ecuación.");
  }
  const V = nb + Math.max(...roots);
  const c3 = P;
  const c2 = -(n * b * P + n * R * T);
  const c1 = a * n * n;
  const c0 = -a * b * n ** 3;
  const lines = [
    "La ecuación es cúbica en V; se reordena como:",
    "  P·V³ − (n·b·P + n·R·T)·V² + a·n²·V − a·b·n³ = 0",
    "Coeficientes con los datos (en unidades base):",
    `  ${fmt(c3)}·V³ + (${fmt(c2)})·V² + ${fmt(c1)}·V + (${fmt(c0)}) = 0`,
    "Se resuelve numéricamente (barrido de signo + bisección).",
    `Raíz encontrada: V = ${fmt(V)} L`,
  ];
  const warnings = [];
  if (roots.length > 1) {
    warnings.push(
      "La ecuación tiene varias raíces reales (zona de coexistencia " +
        "líquido–vapor). Se reporta la de mayor volumen (fase gaseosa)."
    );
  }
  return { value: V, lines, warnings };
}

// Resuelve n. Con varias raíces devuelve la menor (gas menos denso).
export function solveMoles(P, V, T, a, b) {
  const nTop = b > 0 ? (V / b) * (1 - 1e-12) : (1e3 * P * V) / (R * T);
  const roots = rootsOnGrid((n) => residual(P, V, n, T, a, b), logGrid(nTop, 12));
  if (!roots.length) {
    throw new InputError(
      "No existe una cantidad de gas real que cumpla la ecuación con " +
        "estos datos (revisa a, b y las condiciones)."
    );
  }
  const n = Math.min(...roots);
  const c3 = a * b;
  const c2 = -a * V;
  const c1 = (P * b + R * T) * V * V;
  const c0 = -P * V ** 3;
  const lines = [
    "La ecuación es cúbica en n; se reordena como:",
    "  a·b·n³ − a·V·n² + (P·b + R·T)·V²·n − P·V³ = 0",
    "Coeficientes con los datos (en unidades base):",
    `  ${fmt(c3)}·n³ + (${fmt(c2)})·n² + ${fmt(c1)}·n + (${fmt(c0)}) = 0`,
    "Se resuelve numéricamente (barrido de signo + bisección).",
    `Raíz encontrada: n = ${fmt(n)} mol`,
  ];
  const warnings = [];
  if (roots.length > 1) {
    warnings.push(
      "La ecuación tiene varias raíces reales positivas. Se reporta la " +
        "menor (gas menos denso)."
    );
  }
  return { value: n, lines, warnings };
}

// Valor que daría el gas ideal para la misma incógnita.
export function idealValue(unknown, v) {
  switch (unknown) {
    case "P":
      return (v.n * R * v.T) / v.V;
    case "V":
      return (v.n * R * v.T) / v.P;
    case "n":
      return (v.P * v.V) / (R * v.T);
    case "T":
      return (v.P * v.V) / (v.n * R);
    default:
      return null;
  }
}

export function percentDifference(real, ideal) {
  return ideal ? ((real - ideal) / ideal) * 100 : NaN;
}

// Punto crítico de Van der Waals: por encima de Tc el gas no se puede condensar.
export function criticalPoint(a, b) {
  return { Tc: (8 * a) / (27 * R * b), Pc: a / (27 * b * b), Vc: 3 * b };
}

// Factor de compresibilidad Z = P·V / (n·R·T). Z = 1 para el gas ideal.
export function compressibility(P, V, n, T) {
  return (P * V) / (n * R * T);
}
