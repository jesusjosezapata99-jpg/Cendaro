/**
 * Cendaro — Inventory Import Normalizers
 *
 * Value transformation functions for import row data.
 *
 * PRD: FEATURE_PRD_INVENTORY_IMPORT.md §12
 */

import type { ImportMode } from "@cendaro/api";

/** Result of quantity normalization with optional warning */
export interface NormalizedQuantity {
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
 * Normalize a quantity value.
 * - Trim whitespace
 * - Parse as integer
 * - Detect and warn on float truncation
 * - Mode-specific validation
 *
 * @example "150" → { value: 150, isValid: true }
 * @example "12.5" → { value: 12, isValid: true, warning: "Valor truncado de 12.5 a entero: 12" }
 * @example "abc" → { value: NaN, isValid: false }
 */
export function normalizeQuantity(
  value: string | number | null | undefined,
  mode: ImportMode,
): NormalizedQuantity {
  const raw = String(value ?? "").trim();

  if (raw === "") {
    return { value: NaN, isValid: false, raw };
  }

  const parsed = parseInt(raw, 10);

  if (isNaN(parsed)) {
    return { value: NaN, isValid: false, raw };
  }

  // Detect float truncation (PRD §21.13)
  const floatParsed = parseFloat(raw);
  let warning: string | undefined;
  if (!isNaN(floatParsed) && floatParsed !== parsed) {
    warning = `Valor truncado de ${raw} a entero: ${parsed}`;
  }

  // Mode-specific validation
  if (mode === "replace" && parsed < 0) {
    return {
      value: parsed,
      isValid: false,
      raw,
    };
  }

  return { value: parsed, isValid: true, warning, raw };
}

/**
 * Normalize a notes value.
 * - Trim whitespace
 * - Limit to 512 characters
 *
 * @example "  recount  " → "recount"
 */
export function normalizeNotes(
  value: string | number | null | undefined,
): string | undefined {
  const trimmed = String(value ?? "").trim();
  if (trimmed === "") return undefined;
  return trimmed.slice(0, 512);
}
