/**
 * Cendaro — Catalog Import Normalizers
 *
 * Value transformation functions for catalog import row data.
 * Handles comma decimals, currency symbols, and text cleanup.
 *
 * PRD: FEATURE_PRD_CATALOG_IMPORT.md §12, §22 (edge cases #9, #10)
 */

/**
 * Parse a decimal value from a string, handling:
 * - Comma as decimal separator: "12,50" → 12.50
 * - Currency symbols: "$12.50" → 12.50
 * - Thousands separators: "1.234,56" → 1234.56
 *
 * Returns null if unparseable.
 */
export function parseDecimal(
  value: string | number | null | undefined,
): number | null {
  if (value === null || value === undefined) return null;

  if (typeof value === "number") return isNaN(value) ? null : value;

  let str = String(value).trim();
  if (str === "") return null;

  // Strip currency symbols and whitespace
  str = str.replace(/[$€¥£₿￥\s]/g, "");

  // Detect format: if both . and , present, determine which is decimal
  const lastComma = str.lastIndexOf(",");
  const lastDot = str.lastIndexOf(".");

  if (lastComma > -1 && lastDot > -1) {
    if (lastComma > lastDot) {
      // Format: 1.234,56 (European) → strip dots, replace comma
      str = str.replace(/\./g, "").replace(",", ".");
    } else {
      // Format: 1,234.56 (US) → strip commas
      str = str.replace(/,/g, "");
    }
  } else if (lastComma > -1 && lastDot === -1) {
    // Only comma: "12,50" → "12.50"
    str = str.replace(",", ".");
  }

  const parsed = parseFloat(str);
  return isNaN(parsed) ? null : parsed;
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
 * Normalize a product name.
 * - Trim whitespace only (preserve original casing)
 *
 * @example " Cable HDMI 2.0 4K " → "Cable HDMI 2.0 4K"
 */
export function normalizeName(
  value: string | number | null | undefined,
): string {
  return String(value ?? "").trim();
}

/**
 * Normalize a category string.
 * - Trim whitespace
 * - Preserve original casing (for fuzzy matching display)
 */
export function normalizeCategory(
  value: string | number | null | undefined,
): string {
  return String(value ?? "").trim();
}

/**
 * Normalize a brand string.
 * - Trim whitespace
 * - Title-case for consistency
 */
export function normalizeBrand(
  value: string | number | null | undefined,
): string {
  const trimmed = String(value ?? "").trim();
  if (trimmed === "") return "";
  return trimmed.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Normalize a barcode string.
 * - Trim whitespace
 * - Remove dashes and spaces
 */
export function normalizeBarcode(
  value: string | number | null | undefined,
): string {
  return String(value ?? "")
    .trim()
    .replace(/[-\s]/g, "");
}

/**
 * Normalize a quantity value (integer ≥ 0).
 * Returns null if unparseable.
 */
export function normalizeQuantity(
  value: string | number | null | undefined,
): number | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  if (str === "") return null;

  const parsed = parseInt(str, 10);
  return isNaN(parsed) || parsed < 0 ? null : parsed;
}

/**
 * Truncate a string to max length, returning whether it was truncated.
 */
export function truncateString(
  value: string,
  maxLength: number,
): { value: string; truncated: boolean } {
  if (value.length <= maxLength) {
    return { value, truncated: false };
  }
  return { value: value.slice(0, maxLength), truncated: true };
}
