// Orquesta el cálculo: valida, convierte, despeja, sustituye y arma el procedimiento.

import * as vdw from "./vdw.js";
import { BASE_UNIT_BY_KIND, R, fmt, fromBase, toBase } from "./units.js";
import { InputError, checkPhysical, parseNumber } from "./validation.js";

const isBlank = (t) => !String(t ?? "").trim();

function findUnknown(law, raw) {
  const blanks = law.variables.filter((x) => isBlank(raw[x.key][0]));
  const fixedBlank = blanks.filter((x) => !x.solvable);
  if (fixedBlank.length) {
    throw new InputError(
      `Falta el dato obligatorio: ${fixedBlank.map((x) => x.symbol).join(", ")}. ` +
        "Elige un gas de la lista o escribe el valor.",
      fixedBlank.map((x) => x.key)
    );
  }
  if (!blanks.length) {
    throw new InputError("Todos los campos tienen valor. Deja en blanco el que quieres calcular.");
  }
  if (blanks.length > 1) {
    throw new InputError(
      `Hay ${blanks.length} campos vacíos (${blanks.map((x) => x.symbol).join(", ")}). ` +
        "Deja vacío solo uno: la incógnita; llena los demás.",
      blanks.map((x) => x.key)
    );
  }
  return blanks[0];
}

function readKnown(law, raw, unknown) {
  const originals = {};
  const base = {};
  const problems = [];
  for (const variable of law.variables) {
    if (variable.key === unknown.key) continue;
    const [text, unit] = raw[variable.key];
    const label = `${variable.symbol} (${variable.label})`;
    try {
      const value = parseNumber(text, label);
      const b = toBase(value, unit, variable.kind);
      checkPhysical(variable.kind, b, label);
      originals[variable.key] = value;
      base[variable.key] = b;
    } catch (err) {
      if (!(err instanceof InputError)) throw err;
      problems.push([variable.key, err.message]);
    }
  }
  if (problems.length) {
    throw new InputError(problems.map((p) => p[1]).join("\n"), problems.map((p) => p[0]));
  }
  return { originals, base };
}

function conversionLine(variable, value, unit, b) {
  const baseUnit = BASE_UNIT_BY_KIND[variable.kind];
  if (unit === baseUnit) return null;
  if (variable.kind === "temperature") {
    if (unit === "°C") return `${variable.symbol} = ${fmt(value)} + 273.15 = ${fmt(b)} K`;
    return `${variable.symbol} = (${fmt(value)} − 32)·5/9 + 273.15 = ${fmt(b)} K`;
  }
  return `${variable.symbol} = ${fmt(value)} ${unit} = ${fmt(b)} ${baseUnit}`;
}

function withUnits(law, base) {
  const out = {};
  for (const variable of law.variables) {
    if (variable.key in base) {
      out[variable.key] = `(${fmt(base[variable.key])} ${BASE_UNIT_BY_KIND[variable.kind]})`;
    }
  }
  out.R = `(${fmt(R)} L·atm/(mol·K))`;
  return out;
}

// raw: { clave: [textoEscrito, unidadElegida] }
export function solve(law, raw) {
  const unknown = findUnknown(law, raw);
  const { originals, base } = readKnown(law, raw, unknown);
  const solution = law.solutions[unknown.key];
  const warnings = [];

  // 1. Datos
  const dataLines = law.variables.map((x) =>
    x.key === unknown.key
      ? `${x.symbol} = ?   ← incógnita (${x.label})`
      : `${x.symbol} = ${fmt(originals[x.key])} ${raw[x.key][1]}`
  );
  const steps = [{ title: "1. Datos e incógnita", lines: dataLines }];

  // 2. Conversión
  const conv = [];
  for (const x of law.variables) {
    if (x.key === unknown.key) continue;
    const line = conversionLine(x, originals[x.key], raw[x.key][1], base[x.key]);
    if (line) conv.push(line);
  }
  if (!conv.length) conv.push("Todos los datos ya están en unidades base (atm, L, K, mol).");
  else conv.push("(Las temperaturas siempre se trabajan en kelvin.)");
  steps.push({ title: "2. Conversión a unidades base", lines: conv });

  // 3. Despeje
  steps.push({
    title: "3. Despeje",
    lines: [`Ecuación:  ${law.equation}`, `Despejando:  ${solution.isolated}`],
  });

  // 4. Sustitución o resolución numérica
  const outcome = solution.compute(base);
  let valueBase;
  if (typeof outcome === "object" && outcome !== null) {
    valueBase = outcome.value;
    warnings.push(...outcome.warnings);
    steps.push({ title: "4. Resolución numérica", lines: outcome.lines });
  } else {
    valueBase = outcome;
    const units = withUnits(law, base);
    const sub = solution.template.replace(/\{(\w+)\}/g, (_, k) => units[k]);
    steps.push({
      title: "4. Sustitución",
      lines: [
        `${unknown.symbol} = ${sub}`,
        `${unknown.symbol} = ${fmt(valueBase)} ${BASE_UNIT_BY_KIND[unknown.kind]}`,
      ],
    });
  }

  if (!Number.isFinite(valueBase) || valueBase <= 0) {
    throw new InputError(
      `El resultado (${fmt(valueBase)}) no es físicamente válido para ` +
        `${unknown.label.toLowerCase()}. Revisa los datos y las constantes.`,
      law.variables.filter((x) => x.key !== unknown.key).map((x) => x.key)
    );
  }

  // 5. Resultado en la unidad elegida
  const targetUnit = raw[unknown.key][1];
  const value = fromBase(valueBase, targetUnit, unknown.kind);
  const baseUnit = BASE_UNIT_BY_KIND[unknown.kind];
  const resLines = [`${unknown.symbol} = ${fmt(valueBase)} ${baseUnit}`];
  if (targetUnit !== baseUnit) {
    resLines.push(
      unknown.kind === "temperature"
        ? `${unknown.symbol} = ${fmt(value)} ${targetUnit}`
        : `Convertido: ${unknown.symbol} = ${fmt(value)} ${targetUnit}`
    );
  }
  steps.push({ title: "5. Resultado", lines: resLines });

  // Estado completo en unidades base (lo usan las gráficas)
  const state = { ...base, [unknown.key]: valueBase };

  // Verificación y comparación con gas ideal (Van der Waals)
  if (law.id === "vdw") {
    const res = vdw.residual(state.P, state.V, state.n, state.T, state.a, state.b);
    steps.push({
      title: "6. Verificación",
      lines: [
        "Al sustituir el resultado en (P + a·n²/V²)(V − n·b) − n·R·T:",
        `residuo = ${res.toExponential(3)}  (≈ 0 ⇒ la ecuación se cumple)`,
      ],
    });
    const ideal = vdw.idealValue(unknown.key, state);
    if (ideal !== null && Number.isFinite(ideal) && ideal > 0) {
      const diff = vdw.percentDifference(valueBase, ideal);
      steps.push({
        title: "7. Comparación con gas ideal",
        lines: [
          `Gas ideal:      ${unknown.symbol} = ${fmt(ideal)} ${baseUnit}`,
          `Van der Waals:  ${unknown.symbol} = ${fmt(valueBase)} ${baseUnit}`,
          `Diferencia: ${diff >= 0 ? "+" : ""}${diff.toFixed(2)} %`,
        ],
      });
    }
  }

  return {
    unknownKey: unknown.key,
    symbol: unknown.symbol,
    label: unknown.label,
    value,
    unit: targetUnit,
    baseValue: valueBase,
    steps,
    warnings,
    state,
  };
}
