/**
 * Cendaro — Inventory Import Normalizers
 *
 * Value transformation functions for import row data.
 *
 * PRD: FEATURE_PRD_INVENTORY_IMPORT.md §12
 */

/** Result of integer normalization with optional warning */
export interface NormalizedInteger {
  value: number;
  isValid: boolean;
  warning?: string;
  /** Original string representation */
  raw: string;
}

/**
 * Normalize a SKU value.
 * - Trim whitespace
 * - Convert to uppercase
 *
 * @example " abc-123 " → "ABC-123"
 */
export function normalizeSku(
  value: string | number | null | undefined,
): string {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

/**
 * Normalize a bultos value (integer ≥ 0).
 *
 * @example "5" → { value: 5, isValid: true }
 * @example "2.7" → { value: 2, isValid: true, warning: "Truncado a entero: 2" }
 * @example "" → { value: 0, isValid: true }  — empty = 0 bultos
 * @example "abc" → { value: NaN, isValid: false }
 */
export function normalizeBultos(
  value: string | number | null | undefined,
): NormalizedInteger {
  const raw = String(value ?? "").trim();

  // Empty cell = 0 bultos
  if (raw === "") {
    return { value: 0, isValid: true, raw };
  }

  return normalizePositiveInteger(raw);
}

/**
 * Normalize a cajas/bulto value.
 * "—" means no inner boxes (valid scenario B).
 *
 * @example "5" → { value: 5, isValid: true }
 * @example "—" → { value: 0, isValid: true }  — scenario B (no inner boxes)
 * @example "-" → { value: 0, isValid: true }  — alt dash accepted
 */
export function normalizeCajasPerBulk(
  value: string | number | null | undefined,
): NormalizedInteger {
  const raw = String(value ?? "").trim();

  // "—" or "-" or empty = no inner boxes (scenario B)
  if (raw === "" || raw === "—" || raw === "-" || raw === "–") {
    return { value: 0, isValid: true, raw };
  }

  return normalizePositiveInteger(raw);
}

/**
 * Normalize a presentación value.
 * Valid values: 1, 3, 6, 12, 24.
 *
 * @example "12" → { value: 12, isValid: true }
 * @example "7" → { value: 7, isValid: false }
 * @example "" → { value: 1, isValid: true }  — default to unitario
 */
export function normalizePresentacion(
  value: string | number | null | undefined,
): NormalizedInteger {
  const raw = String(value ?? "").trim();

  // Empty = default to unitario (1)
  if (raw === "") {
    return { value: 1, isValid: true, raw };
  }

  const parsed = parseInt(raw, 10);

  if (isNaN(parsed)) {
    return { value: NaN, isValid: false, raw };
  }

  const validValues = [1, 3, 6, 12, 24];
  if (!validValues.includes(parsed)) {
    return {
      value: parsed,
      isValid: false,
      warning: `Presentación inválida: ${parsed}. Valores válidos: 1, 3, 6, 12, 24`,
      raw,
    };
  }

  return { value: parsed, isValid: true, raw };
}

// ── Internal Helper ───────────────────────────────

function normalizePositiveInteger(raw: string): NormalizedInteger {
  const parsed = parseInt(raw, 10);

  if (isNaN(parsed)) {
    return { value: NaN, isValid: false, raw };
  }

  if (parsed < 0) {
    return { value: parsed, isValid: false, raw };
  }

  // Detect float truncation
  const floatParsed = parseFloat(raw);
  let warning: string | undefined;
  if (!isNaN(floatParsed) && floatParsed !== parsed) {
    warning = `Valor truncado de ${raw} a entero: ${parsed}`;
  }

  return { value: parsed, isValid: true, warning, raw };
}

// ── Initialize Mode Normalizers ──────────────────

/**
 * Normalize a brand name.
 * - Trim whitespace
 * - Title-case (first letter of each word capitalized)
 *
 * @example " samsung electronics " → "Samsung Electronics"
 * @example "" → ""  (empty = invalid, but caller decides)
 */
export function normalizeBrandName(
  value: string | number | null | undefined,
): string {
  const trimmed = String(value ?? "").trim();
  if (trimmed === "") return "";
  return trimmed.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Normalize a product name.
 * - Trim whitespace only (preserve original casing)
 *
 * @example " Cargador USB-C 65W " → "Cargador USB-C 65W"
 */
export function normalizeProductName(
  value: string | number | null | undefined,
): string {
  return String(value ?? "").trim();
}

/**
 * Normalize a unid/caja (units per box) value.
 * Same logic as cajasPerBulk — "—" means N/A.
 */
export function normalizeUnidPerCaja(
  value: string | number | null | undefined,
): NormalizedInteger {
  const raw = String(value ?? "").trim();
  if (raw === "" || raw === "—" || raw === "-" || raw === "–") {
    return { value: 0, isValid: true, raw };
  }
  return normalizePositiveInteger(raw);
}
