// Unidades y conversiones.
// Unidades base internas: presión atm, volumen L, temperatura K, cantidad mol.

export const R = 0.082057; // L·atm/(mol·K)

export const PRESSURE_TO_ATM = {
  atm: 1,
  kPa: 1 / 101.325,
  mmHg: 1 / 760,
  Pa: 1 / 101325,
  bar: 1 / 1.01325,
  psi: 1 / 14.6959487755,
};

export const VOLUME_TO_L = { L: 1, mL: 1e-3, "m³": 1000 };

export const A_UNIT = "L²·atm/mol²";
export const B_UNIT = "L/mol";

export const UNITS_BY_KIND = {
  pressure: Object.keys(PRESSURE_TO_ATM),
  volume: Object.keys(VOLUME_TO_L),
  temperature: ["K", "°C", "°F"],
  moles: ["mol"],
  vdw_a: [A_UNIT],
  vdw_b: [B_UNIT],
};

export const BASE_UNIT_BY_KIND = {
  pressure: "atm",
  volume: "L",
  temperature: "K",
  moles: "mol",
  vdw_a: A_UNIT,
  vdw_b: B_UNIT,
};

export function toBase(value, unit, kind) {
  switch (kind) {
    case "pressure":
      return value * PRESSURE_TO_ATM[unit];
    case "volume":
      return value * VOLUME_TO_L[unit];
    case "temperature":
      if (unit === "K") return value;
      if (unit === "°C") return value + 273.15;
      if (unit === "°F") return ((value - 32) * 5) / 9 + 273.15;
      throw new Error(`Unidad de temperatura desconocida: ${unit}`);
    case "moles":
    case "vdw_a":
    case "vdw_b":
      return value;
    default:
      throw new Error(`Magnitud desconocida: ${kind}`);
  }
}

export function fromBase(value, unit, kind) {
  switch (kind) {
    case "pressure":
      return value / PRESSURE_TO_ATM[unit];
    case "volume":
      return value / VOLUME_TO_L[unit];
    case "temperature":
      if (unit === "K") return value;
      if (unit === "°C") return value - 273.15;
      if (unit === "°F") return ((value - 273.15) * 9) / 5 + 32;
      throw new Error(`Unidad de temperatura desconocida: ${unit}`);
    case "moles":
    case "vdw_a":
    case "vdw_b":
      return value;
    default:
      throw new Error(`Magnitud desconocida: ${kind}`);
  }
}

// Número con cifras significativas, sin ceros sobrantes.
export function fmt(x, sig = 6) {
  if (x === 0) return "0";
  if (!Number.isFinite(x)) return String(x);
  const ax = Math.abs(x);
  if (ax >= 1e6 || ax < 1e-3) {
    return x.toExponential(sig - 1).replace("e+", "e+").replace(/e([+-])0*(\d)/, "e$1$2");
  }
  return String(Number(x.toPrecision(sig)));
}
