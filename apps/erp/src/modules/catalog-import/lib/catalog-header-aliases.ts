/**
 * Cendaro — Catalog Import Header Aliases
 *
 * Maps spreadsheet header labels to standard field names.
 * Case-insensitive, accent-insensitive matching.
 *
 * PRD: FEATURE_PRD_CATALOG_IMPORT.md Appendix A
 */

/**
 * Standard field names for catalog import.
 */
export type CatalogImportField =
  | "sku"
  | "name"
  | "category"
  | "brand"
  | "cost"
  | "quantity"
  | "barcode"
  | "weight"
  | "volume"
  | "description";

/** Required fields — import cannot proceed without both */
export const REQUIRED_CATALOG_FIELDS: CatalogImportField[] = ["sku", "name"];

/** Optional fields — recognized but not required */
export const OPTIONAL_CATALOG_FIELDS: CatalogImportField[] = [
  "category",
  "brand",
  "cost",
  "quantity",
  "barcode",
  "weight",
  "volume",
  "description",
];

/**
 * Header alias map — maps normalized header strings to field names.
 *
 * Sourced from PRD Appendix A with full bilingual + CJK support.
 */
export const CATALOG_HEADER_ALIASES: Record<string, CatalogImportField> = {
  // ── SKU / Reference ────────────────────────────
  sku: "sku",
  ref: "sku",
  referencia: "sku",
  reference: "sku",
  codigo: "sku",
  code: "sku",
  "internal code": "sku",
  "codigo interno": "sku",
  "item code": "sku",
  "item no": "sku",
  "item number": "sku",
  art: "sku",
  articulo: "sku",
  "\u7f16\u53f7": "sku", // 编号
  "\u8d27\u53f7": "sku", // 货号

  // ── Product Name ───────────────────────────────
  name: "name",
  nombre: "name",
  "product name": "name",
  product: "name",
  "nombre del producto": "name",
  "nombre producto": "name",
  item: "name",
  "item name": "name",
  description: "name",
  descripcion: "name",
  "\u54c1\u540d": "name", // 品名
  "\u4ea7\u54c1\u540d\u79f0": "name", // 产品名称
  "\u5546\u54c1\u540d": "name", // 商品名

  // ── Category ───────────────────────────────────
  category: "category",
  categoria: "category",
  cat: "category",
  "product category": "category",
  "\u7c7b\u522b": "category", // 类别
  "\u5206\u7c7b": "category", // 分类
  "\u7c7b\u76ee": "category", // 类目
  rubro: "category",
  linea: "category",

  // ── Brand ──────────────────────────────────────
  brand: "brand",
  marca: "brand",
  "brand name": "brand",
  "\u54c1\u724c": "brand", // 品牌

  // ── Cost ───────────────────────────────────────
  cost: "cost",
  costo: "cost",
  "unit cost": "cost",
  precio: "cost",
  "precio unitario": "cost",
  "costo unitario": "cost",
  "unit price": "cost",
  price: "cost",
  fob: "cost",
  "fob price": "cost",
  "\u5355\u4ef7": "cost", // 单价
  "\u4ef7\u683c": "cost", // 价格

  // ── Quantity ────────────────────────────────────
  quantity: "quantity",
  qty: "quantity",
  cantidad: "quantity",
  cant: "quantity",
  units: "quantity",
  unidades: "quantity",
  pcs: "quantity",
  pieces: "quantity",
  "\u6570\u91cf": "quantity", // 数量

  // ── Barcode ────────────────────────────────────
  barcode: "barcode",
  "bar code": "barcode",
  ean: "barcode",
  upc: "barcode",
  gtin: "barcode",
  "codigo de barras": "barcode",
  "\u6761\u7801": "barcode", // 条码
  "\u6761\u5f62\u7801": "barcode", // 条形码

  // ── Weight ─────────────────────────────────────
  weight: "weight",
  peso: "weight",
  "weight kg": "weight",
  "peso kg": "weight",
  "gross weight": "weight",
  "net weight": "weight",
  "\u91cd\u91cf": "weight", // 重量

  // ── Volume ─────────────────────────────────────
  volume: "volume",
  volumen: "volume",
  cbm: "volume",
  "cubic meters": "volume",
  "\u4f53\u79ef": "volume", // 体积

  // ── Description / Notes ────────────────────────
  notes: "description",
  notas: "description",
  observaciones: "description",
  comentarios: "description",
  comments: "description",
  details: "description",
  detalle: "description",
  detalles: "description",
  "\u5907\u6ce8": "description", // 备注
  "\u8bf4\u660e": "description", // 说明
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
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/[*]+/g, "") // strip * markers
    .replace(/\s+/g, " ") // collapse whitespace
    .trim(); // trim trailing spaces from * removal
}

/**
 * Auto-map detected headers to standard field names.
 *
 * @param headers - The first row of the spreadsheet (raw header values)
 * @returns map of field → column index, and unmapped header names
 */
export function autoMapCatalogHeaders(headers: string[]): {
  map: Record<string, number>;
  unmapped: string[];
} {
  const map: Record<string, number> = {};
  const unmapped: string[] = [];

  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    if (header === undefined) continue;
    const normalized = normalizeHeader(header);
    const field = CATALOG_HEADER_ALIASES[normalized];

    if (field && !(field in map)) {
      map[field] = i;
    } else if (!field) {
      unmapped.push(header);
    }
  }

  return { map, unmapped };
}
