/**
 * Cendaro — Inventory Import Header Aliases (Zero-Template Ready)
 *
 * Maps spreadsheet header labels to standard field names across Spanish,
 * English, and Mandarin Chinese, supporting both packaging breakdowns
 * (`bultos × cajas × unid`) and direct unit counts (`quantity` / `barcode`).
 */

export type ImportField =
  | "sku"
  | "bultos"
  | "quantity"
  | "barcode"
  | "cajasPerBulk"
  | "presentacion"
  | "marca"
  | "producto"
  | "unidPerCaja"
  | "stockTotal";

/** Classic template fields (kept for backwards compatibility) */
export const REQUIRED_IMPORT_FIELDS: ImportField[] = ["sku", "bultos"];

/** Returns primary display required fields for a given import mode */
export function getRequiredFieldsForMode(
  mode: "replace" | "adjust" | "initialize",
): ImportField[] {
  if (mode === "initialize") {
    return ["producto", "bultos"];
  }
  return ["sku", "bultos"];
}

/**
 * Checks whether a header mapping has sufficient columns to proceed in Zero-Template mode:
 * - Replace/Adjust: needs an identifier (`sku`, `producto`, or `barcode`) AND a count (`bultos`, `quantity`, or `stockTotal`).
 * - Initialize: needs `producto` (or `sku`) AND a count (`bultos` or `quantity`).
 */
export function canConfirmInventoryHeaderMap(
  headerMap: Record<string, number>,
  mode: "replace" | "adjust" | "initialize",
): { ok: boolean; missingSummary: string[] } {
  const missing: string[] = [];
  const hasCount =
    "bultos" in headerMap ||
    "quantity" in headerMap ||
    "stockTotal" in headerMap;

  if (mode === "initialize") {
    if (!("producto" in headerMap) && !("sku" in headerMap)) {
      missing.push("Producto / Nombre");
    }
    if (!hasCount) {
      missing.push("Bultos o Cantidad");
    }
  } else {
    const hasIdentifier =
      "sku" in headerMap || "producto" in headerMap || "barcode" in headerMap;
    if (!hasIdentifier) {
      missing.push("SKU, Producto o Código de barras");
    }
    if (!hasCount) {
      missing.push("Bultos o Cantidad");
    }
  }

  return { ok: missing.length === 0, missingSummary: missing };
}

export const OPTIONAL_IMPORT_FIELDS: ImportField[] = [
  "quantity",
  "barcode",
  "cajasPerBulk",
  "presentacion",
  "marca",
  "producto",
  "unidPerCaja",
  "stockTotal",
];

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

  // ── Barcode / EAN ──────────────────────────────
  barcode: "barcode",
  ean: "barcode",
  ean13: "barcode",
  upc: "barcode",
  gtin: "barcode",
  "codigo de barras": "barcode",
  codigo_barras: "barcode",
  "\u6761\u7801": "barcode", // 条码
  "\u6761\u5f62\u7801": "barcode", // 条形码

  // ── Bultos ─────────────────────────────────────
  bultos: "bultos",
  bulto: "bultos",
  bales: "bultos",
  packages: "bultos",
  paquetes: "bultos",
  fardos: "bultos",
  cajas_grandes: "bultos",
  ctns: "bultos",
  cartons: "bultos",
  "\u4ef6\u6570": "bultos", // 件数
  "\u7bb1\u6570": "bultos", // 箱数

  // ── Direct Quantity (Unidades / Conteo físico) ─
  cantidad: "quantity",
  cant: "quantity",
  qty: "quantity",
  quantity: "quantity",
  unidades: "quantity",
  units: "quantity",
  pcs: "quantity",
  pieces: "quantity",
  conteo: "quantity",
  fisico: "quantity",
  "conteo fisico": "quantity",
  "\u6570\u91cf": "quantity", // 数量

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

  // ── Marca ──────────────────────────────────────
  marca: "marca",
  brand: "marca",
  fabricante: "marca",
  "\u54c1\u724c": "marca", // 品牌

  // ── Producto ───────────────────────────────────
  producto: "producto",
  product: "producto",
  nombre: "producto",
  name: "producto",
  descripcion: "producto",
  description: "producto",
  "\u4ea7\u54c1": "producto", // 产品
  "\u54c1\u540d": "producto", // 品名
  "\u4ea7\u54c1\u540d\u79f0": "producto", // 产品名称

  // ── Unid/Caja ──────────────────────────────────
  "unid/caja": "unidPerCaja",
  unidades_por_caja: "unidPerCaja",
  "unidades por caja": "unidPerCaja",
  units_per_box: "unidPerCaja",
  "units per box": "unidPerCaja",

  // ── Stock Total ────────────────────────────────
  "stock total": "stockTotal",
  stock_total: "stockTotal",
  "total stock": "stockTotal",
  existencias: "stockTotal",
  existencia: "stockTotal",
  inventario: "stockTotal",
  stock: "stockTotal",
};

export function normalizeHeader(header: string): string {
  return String(header)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

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
      map[field] = i;
    } else if (!field && header.trim().length > 0) {
      unmapped.push(header);
    }
  }

  return { map, unmapped };
}
