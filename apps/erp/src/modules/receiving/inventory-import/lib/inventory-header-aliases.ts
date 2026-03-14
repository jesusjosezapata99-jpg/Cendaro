/**
 * Cendaro — Inventory Import Header Aliases
 *
 * Maps spreadsheet header labels to standard field names.
 * Case-insensitive, accent-insensitive matching.
 *
 * PRD: FEATURE_PRD_INVENTORY_IMPORT.md Appendix A
 */

/** Standard field names used in the import process */
export type ImportField = "sku" | "barcode" | "quantity" | "notes";

/**
 * Header alias map — 43 aliases across 4 groups.
 *
 * IMPORTANT: Barcode is SEPARATE from SKU. Barcode aliases must NEVER
 * be mapped to 'sku'. Barcode is optional and used for cross-validation
 * only — product lookup is ALWAYS by SKU (Referencia).
 */
export const INVENTORY_HEADER_ALIASES: Record<string, ImportField> = {
  // ── SKU / Reference (17 aliases) ──────────────────
  sku: "sku",
  ref: "sku",
  referencia: "sku",
  reference: "sku",
  codigo: "sku",
  code: "sku",
  product_code: "sku",
  "product code": "sku",
  item: "sku",
  item_code: "sku",
  articulo: "sku",
  "item no": "sku",
  "item number": "sku",
  art: "sku",
  "\u7f16\u53f7": "sku",
  "\u8d27\u53f7": "sku",
  // Note: "código" and "artículo" are matched after NFD normalization strips accents

  // ── Barcode (9 aliases) — NOT used for SKU lookup ──
  barcode: "barcode",
  "bar code": "barcode",
  ean: "barcode",
  upc: "barcode",
  gtin: "barcode",
  "codigo de barras": "barcode",
  "\u6761\u7801": "barcode",
  "\u6761\u5f62\u7801": "barcode",
  // Note: "código de barras" matched after accent stripping

  // ── Quantity (17 aliases) ─────────────────────────
  quantity: "quantity",
  cantidad: "quantity",
  qty: "quantity",
  stock: "quantity",
  existencia: "quantity",
  existencias: "quantity",
  inventario: "quantity",
  unidades: "quantity",
  units: "quantity",
  count: "quantity",
  conteo: "quantity",
  cantidad_fisica: "quantity",
  physical_count: "quantity",
  pcs: "quantity",
  pieces: "quantity",
  "\u6570\u91cf": "quantity",
  "qty.": "quantity",

  // ── Notes (8 aliases) ────────────────────────────
  notes: "notes",
  notas: "notes",
  observaciones: "notes",
  comentarios: "notes",
  comments: "notes",
  nota: "notes",
  "\u5907\u6ce8": "notes",
  "\u8bf4\u660e": "notes",
};

/** Required fields that MUST be present for a valid import */
export const REQUIRED_IMPORT_FIELDS: ImportField[] = ["sku", "quantity"];

/** Optional fields */
export const OPTIONAL_IMPORT_FIELDS: ImportField[] = ["barcode", "notes"];

/**
 * Normalize a header string for matching against alias map.
 * - Trim whitespace
 * - Lowercase
 * - NFD normalize + strip diacritics (á→a, ñ→n, etc.)
 */
export function normalizeHeader(header: string): string {
  return String(header)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Auto-map detected headers to standard field names.
 *
 * @param headers - The first row of the spreadsheet (raw header values)
 * @returns Record<ImportField, number> — maps field name to column index
 */
export function autoMapHeaders(headers: string[]): {
  map: Record<string, number>;
  unmapped: string[];
} {
  const map: Record<string, number> = {};
  const unmapped: string[] = [];

  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    if (header === undefined) continue;
    const normalized = normalizeHeader(header);
    const field = INVENTORY_HEADER_ALIASES[normalized];

    if (field && !(field in map)) {
      // First match wins — don't overwrite if a field already mapped
      map[field] = i;
    } else if (!field) {
      unmapped.push(header);
    }
  }

  return { map, unmapped };
}
