/**
 * Cendaro — Inventory Import Header Aliases
 *
 * Maps spreadsheet header labels to standard field names.
 * Case-insensitive, accent-insensitive matching.
 *
 * PRD: FEATURE_PRD_INVENTORY_IMPORT.md Appendix A
 */

/**
 * Standard field names used in the import process.
 *
 * - sku, bultos, cajasPerBulk, presentacion: Import fields
 * - marca, producto: Info-only for Replace/Adjust, REQUIRED for Initialize
 * - unidPerCaja, stockTotal: Info fields (recognized but not required)
 */
export type ImportField =
  | "sku"
  | "bultos"
  | "cajasPerBulk"
  | "presentacion"
  | "marca"
  | "producto"
  | "unidPerCaja"
  | "stockTotal";

/** Fields that drive the import calculation (Replace/Adjust) */
export const REQUIRED_IMPORT_FIELDS: ImportField[] = ["sku", "bultos"];

/** Returns the required fields for a given import mode */
export function getRequiredFieldsForMode(
  mode: "replace" | "adjust" | "initialize",
): ImportField[] {
  if (mode === "initialize") {
    return ["sku", "bultos", "marca", "producto"];
  }
  return ["sku", "bultos"];
}

/** Fields recognized by the parser but not required */
export const OPTIONAL_IMPORT_FIELDS: ImportField[] = [
  "cajasPerBulk",
  "presentacion",
  "marca",
  "producto",
  "unidPerCaja",
  "stockTotal",
];

/**
 * Header alias map — maps normalized header strings to field names.
 *
 * Green fields (editable): bultos, cajasPerBulk, presentacion
 * Blue fields (reference): sku, marca, producto, unidPerCaja, stockTotal
 */
export const INVENTORY_HEADER_ALIASES: Record<string, ImportField> = {
  // ── SKU / Reference ────────────────────────────
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
  "\u7f16\u53f7": "sku", // 编号
  "\u8d27\u53f7": "sku", // 货号

  // ── Bultos ─────────────────────────────────────
  bultos: "bultos",
  bulto: "bultos",
  bales: "bultos",
  packages: "bultos",
  paquetes: "bultos",
  fardos: "bultos",
  cajas_grandes: "bultos",

  // ── Cajas per Bulto ────────────────────────────
  "cajas/bulto": "cajasPerBulk",
  cajas_por_bulto: "cajasPerBulk",
  "cajas por bulto": "cajasPerBulk",
  "cases/bulk": "cajasPerBulk",
  boxes_per_bulk: "cajasPerBulk",

  // ── Presentación ───────────────────────────────
  presentacion: "presentacion",
  presentation: "presentacion",
  "pack size": "presentacion",
  pack_size: "presentacion",
  display: "presentacion",
  empaque: "presentacion",

  // ── Marca (info — ignored by import engine) ────
  marca: "marca",
  brand: "marca",
  "\u54c1\u724c": "marca", // 品牌

  // ── Producto (info — ignored by import engine) ─
  producto: "producto",
  product: "producto",
  nombre: "producto",
  name: "producto",
  "\u4ea7\u54c1": "producto", // 产品

  // ── Unid/Caja (info — read-only) ───────────────
  "unid/caja": "unidPerCaja",
  unidades_por_caja: "unidPerCaja",
  "unidades por caja": "unidPerCaja",
  units_per_box: "unidPerCaja",
  "units per box": "unidPerCaja",

  // ── Stock Total (info — read-only, adjust mode) ─
  "stock total": "stockTotal",
  stock_total: "stockTotal",
  "total stock": "stockTotal",
  existencias: "stockTotal",
  inventario: "stockTotal",
};

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
