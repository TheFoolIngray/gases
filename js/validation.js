// Validación y lectura de números escritos por el usuario.

export class InputError extends Error {
  // `fields`: claves de los campos a resaltar en la interfaz.
  constructor(message, fields = []) {
    super(message);
    this.name = "InputError";
    this.fields = [...fields];
  }
}

const NUMBER_RE = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i;

export function parseNumber(text, label) {
  let cleaned = String(text ?? "").trim().replace(/\s+/g, "");
  if (!cleaned) throw new InputError(`El campo «${label}» está vacío.`);
  // Acepta "1,5" y "1.5"
  if ((cleaned.match(/,/g) || []).length === 1 && !cleaned.includes(".")) {
    cleaned = cleaned.replace(",", ".");
  }
  if (!NUMBER_RE.test(cleaned)) {
    throw new InputError(
      `«${label}» debe ser un número (ej. 2.5). Recibí: «${String(text).trim()}».`
    );
  }
  const value = Number(cleaned);
  if (!Number.isFinite(value)) {
    throw new InputError(`«${label}» debe ser un número finito.`);
  }
  return value;
}

export function checkPhysical(kind, baseValue, label) {
  if (kind === "temperature") {
    if (baseValue <= 0) {
      throw new InputError(
        `«${label}» es ${baseValue.toFixed(2)} K: la temperatura absoluta debe ` +
          "ser mayor que 0 K (−273.15 °C)."
      );
    }
  } else if (kind === "pressure" || kind === "volume" || kind === "moles") {
    const names = { pressure: "presión", volume: "volumen", moles: "cantidad de gas" };
    if (baseValue <= 0) {
      throw new InputError(`«${label}»: la ${names[kind]} debe ser mayor que cero.`);
    }
  } else if (kind === "vdw_a" || kind === "vdw_b") {
    if (baseValue < 0) throw new InputError(`«${label}» no puede ser negativa.`);
  }
}
