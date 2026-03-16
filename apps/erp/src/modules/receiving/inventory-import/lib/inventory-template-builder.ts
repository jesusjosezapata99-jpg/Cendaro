"use client";

/**
 * Cendaro — Inventory Import Template Builder
 *
 * Generates professional, multi-sheet XLSX templates for inventory import.
 * Two modes: Replace (fresh count) and Adjust (modify existing stock).
 *
 * Features:
 * - Legend block (rows 1–6) with color-coded field guide
 * - Frozen panes (legend + header always visible)
 * - Blue cells = read-only reference, Green cells = employee fills
 * - "—" for products with no inner boxes (not 0)
 * - Numeric Presentación (1, 3, 6, 12, 24)
 *
 * PRD: FEATURE_PRD_INVENTORY_IMPORT.md §15, Appendix A
 */
import type { CellObject, WorkSheet } from "xlsx";
import { utils, writeFile } from "xlsx";

// ── Types ─────────────────────────────────────────

/** Product data from getWarehouseProducts tRPC query */
export interface WarehouseProduct {
  id: string;
  sku: string;
  name: string;
  brandName: string;
  unitsPerBox: number | null;
  boxesPerBulk: number | null;
  presentationQty: number;
  quantity: number;
  isLocked: boolean;
}

// ── Constants ─────────────────────────────────────

/** Blue (reference) background — read-only cells */
const BLUE_FILL = { patternType: "solid", fgColor: { rgb: "D6EAF8" } } as const;

/** Green (editable) background — employee fills */
const GREEN_FILL = {
  patternType: "solid",
  fgColor: { rgb: "D5F5E3" },
} as const;

/** Gray (config) background — product config */
const HEADER_FILL = {
  patternType: "solid",
  fgColor: { rgb: "2C3E50" },
} as const;

const HEADER_FONT = { bold: true, color: { rgb: "FFFFFF" }, sz: 11 } as const;

const LEGEND_TITLE_FONT = { bold: true, sz: 13 } as const;

const LEGEND_FONT = { sz: 10 } as const;

const BOLD_FONT = { bold: true, sz: 10 } as const;

// ── Replace Mode Headers ──────────────────────────

const REPLACE_HEADERS = [
  "Marca",
  "Referencia",
  "Producto",
  "Bultos",
  "Cajas/Bulto",
  "Unid/Caja",
  "Presentación",
];

// ── Adjust Mode Headers ───────────────────────────

const ADJUST_HEADERS = [
  "Marca",
  "Referencia",
  "Producto",
  "Bultos",
  "Cajas/Bulto",
  "Unid/Caja",
  "Presentación",
  "Stock Total",
];

// ── Initialize Mode Headers ────────────────────

const INITIALIZE_HEADERS = [
  "Marca",
  "Referencia",
  "Producto",
  "Bultos",
  "Cajas/Bulto",
  "Unid/Caja",
  "Presentación",
];
// ── Column Widths ─────────────────────────────────

const COL_WIDTHS: Record<string, number> = {
  Marca: 18,
  Referencia: 16,
  Producto: 36,
  Bultos: 12,
  "Cajas/Bulto": 14,
  "Unid/Caja": 13,
  Presentación: 16,
  "Stock Total": 14,
};

// ── Builder ───────────────────────────────────────

/**
 * Build and download a professional inventory import template.
 *
 * @param mode - "replace" = fresh count, "adjust" = modify existing stock, "initialize" = create from scratch
 * @param products - warehouse product data (optional for initialize mode)
 */
export function downloadInventoryTemplate(
  mode: "replace" | "adjust" | "initialize",
  products?: WarehouseProduct[],
): void {
  const wb = utils.book_new();

  // ── Sheet 1: Plantilla (Data) ───────────────
  let headers: string[];
  if (mode === "initialize") {
    headers = INITIALIZE_HEADERS;
  } else if (mode === "adjust") {
    headers = ADJUST_HEADERS;
  } else {
    headers = REPLACE_HEADERS;
  }
  const ws = buildDataSheet(mode, headers, products ?? []);
  utils.book_append_sheet(wb, ws, "Plantilla");

  // ── Sheet 2: Instrucciones ────────────────
  const instrSheet = buildInstructionsSheet(mode);
  utils.book_append_sheet(wb, instrSheet, "Instrucciones");

  // ── Sheet 3: Reglas ─────────────────────
  const rulesSheet = buildRulesSheet();
  utils.book_append_sheet(wb, rulesSheet, "Reglas");

  // ── Download ──────────────────────────
  const modeLabels: Record<string, string> = {
    replace: "reemplazar",
    adjust: "ajustar",
    initialize: "inicializar",
  };
  writeFile(wb, `plantilla-inventario-${modeLabels[mode]}.xlsx`);
}

// ── Data Sheet Builder ────────────────────────────

function buildDataSheet(
  mode: "replace" | "adjust" | "initialize",
  headers: string[],
  products: WarehouseProduct[],
): WorkSheet {
  const ws: WorkSheet = {};
  const LEGEND_ROWS = 7; // rows 1–6 legend + 1 separator
  const HEADER_ROW = LEGEND_ROWS + 1; // row 8
  const DATA_START = HEADER_ROW + 1; // row 9

  // ── Legend Block (rows 1–6) ────────────────
  const modeLabelMap: Record<string, string> = {
    replace: "Reemplazar (Conteo Nuevo)",
    adjust: "Ajustar (Sobre Stock Existente)",
    initialize: "Inicializar (Catálogo + Stock desde Cero)",
  };
  const modeLabel = modeLabelMap[mode] ?? mode;

  writeLegendCell(
    ws,
    0,
    0,
    `CENDARO — Plantilla de Inventario: ${modeLabel}`,
    LEGEND_TITLE_FONT,
  );
  writeLegendCell(
    ws,
    1,
    0,
    "─────────────────────────────────────────────",
    LEGEND_FONT,
  );
  writeLegendCell(
    ws,
    2,
    0,
    "🟦  Azul   =  Campo de referencia (NO modificar)",
    BOLD_FONT,
  );
  writeLegendCell(
    ws,
    3,
    0,
    "🟩  Verde  =  Campo a llenar por el empleado",
    BOLD_FONT,
  );
  writeLegendCell(
    ws,
    4,
    0,
    "Presentación:  1 = Unitario  ·  3 = Tripack  ·  6 = ½ Docena  ·  12 = Docena  ·  24 = Set",
    LEGEND_FONT,
  );
  writeLegendCell(
    ws,
    5,
    0,
    'Cajas/Bulto = "—" cuando el producto viene sin cajas internas',
    LEGEND_FONT,
  );

  // ── Header Row (row 8) ────────────────────────
  for (let c = 0; c < headers.length; c++) {
    const headerName = headers[c];
    if (!headerName) continue;
    const cell: CellObject = {
      v: headerName,
      t: "s",
      s: {
        fill: HEADER_FILL,
        font: HEADER_FONT,
        alignment: { horizontal: "center" },
      },
    };
    ws[utils.encode_cell({ r: HEADER_ROW - 1, c })] = cell;
  }

  // ── Data Rows ─────────────────────────────────
  const greenCols = new Set(["Bultos", "Cajas/Bulto", "Presentación"]);

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    if (!p) continue;
    const row = DATA_START - 1 + i; // 0-indexed

    for (let c = 0; c < headers.length; c++) {
      const headerName = headers[c];
      if (!headerName) continue;
      const isGreen = greenCols.has(headerName);
      const fill = isGreen ? GREEN_FILL : BLUE_FILL;

      const value = getCellValue(headerName, p, mode);
      const cellType = typeof value === "number" ? "n" : "s";

      const cell: CellObject = {
        v: value,
        t: cellType,
        s: {
          fill,
          alignment: { horizontal: cellType === "n" ? "center" : "left" },
        },
      };
      ws[utils.encode_cell({ r: row, c })] = cell;
    }
  }

  // ── Sheet Configuration ───────────────────────
  const totalRows = DATA_START + products.length;

  ws["!ref"] = utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: totalRows - 1, c: headers.length - 1 },
  });

  // Column widths
  ws["!cols"] = headers.map((h) => ({ wch: COL_WIDTHS[h] ?? 14 }));

  // Frozen panes: freeze after the header row so legend + headers stay visible
  ws["!freeze"] = {
    xSplit: 0,
    ySplit: HEADER_ROW,
    topLeftCell: `A${DATA_START}`,
  };

  // Merge legend cells across all columns for readability
  ws["!merges"] = [];
  for (let r = 0; r < 6; r++) {
    ws["!merges"].push({
      s: { r, c: 0 },
      e: { r, c: headers.length - 1 },
    });
  }

  return ws;
}

// ── Cell Value Resolver ───────────────────────────

function getCellValue(
  header: string,
  product: WarehouseProduct,
  mode: "replace" | "adjust" | "initialize",
): string | number {
  switch (header) {
    case "Marca":
      return product.brandName || "—";
    case "Referencia":
      return product.sku;
    case "Producto":
      return product.name;
    case "Bultos":
      // Replace: empty for employee to fill. Adjust: derive from stock.
      if (mode === "replace") return "";
      return deriveBultos(product);
    case "Cajas/Bulto":
      // Replace: pre-fill from product config if available, employee can modify
      if (product.boxesPerBulk && product.boxesPerBulk > 0)
        return product.boxesPerBulk;
      return "—";
    case "Unid/Caja":
      return product.unitsPerBox ?? 1;
    case "Presentación":
      if (mode === "replace") return "";
      return product.presentationQty;
    case "Stock Total":
      return product.quantity;
    default:
      return "";
  }
}

/**
 * Derive the number of bultos from the current stock.
 * If the product has boxesPerBulk and unitsPerBox configured,
 * calculate how many full bultos fit in the current stock.
 */
function deriveBultos(product: WarehouseProduct): number | string {
  const bpb = product.boxesPerBulk;
  const upb = product.unitsPerBox;

  if (bpb && bpb > 0 && upb && upb > 0) {
    const unitsPerBulk = bpb * upb;
    return Math.floor(product.quantity / unitsPerBulk);
  }

  if (upb && upb > 0) {
    // No inner boxes — bultos = total / unitsPerBulk
    return Math.floor(product.quantity / upb);
  }

  return product.quantity;
}

// ── Instructions Sheet Builder ────────────────────

function buildInstructionsSheet(
  mode: "replace" | "adjust" | "initialize",
): WorkSheet {
  const data = [
    {
      Columna: "Marca",
      Tipo: "🟦 Referencia",
      Descripción:
        "Marca del producto. Pre-llenada del catálogo. NO modificar.",
    },
    {
      Columna: "Referencia",
      Tipo: "🟦 Referencia",
      Descripción:
        "SKU / código del producto. Clave de búsqueda principal. NO modificar.",
    },
    {
      Columna: "Producto",
      Tipo: "🟦 Referencia",
      Descripción: "Nombre completo del producto. NO modificar.",
    },
    {
      Columna: "Bultos",
      Tipo: "🟩 Editable",
      Descripción:
        mode === "replace"
          ? "Cantidad de bultos contados. Número entero ≥ 0."
          : "Cantidad actual de bultos. Modifique con el nuevo conteo.",
    },
    {
      Columna: "Cajas/Bulto",
      Tipo: "🟩 Editable",
      Descripción:
        'Cajas internas por bulto. "—" si el producto no tiene cajas internas. Puede modificar si cambió.',
    },
    {
      Columna: "Unid/Caja",
      Tipo: "🟦 Referencia",
      Descripción:
        "Unidades por caja. Configuración del producto. NO modificar.",
    },
    {
      Columna: "Presentación",
      Tipo: "🟩 Editable",
      Descripción:
        "Agrupación de venta: 1=Unitario, 3=Tripack, 6=½Docena, 12=Docena, 24=Set.",
    },
    ...(mode === "adjust"
      ? [
          {
            Columna: "Stock Total",
            Tipo: "🟦 Referencia",
            Descripción:
              "Stock actual en el almacén. Referencia para el ajuste. NO modificar.",
          },
        ]
      : []),
  ];

  const ws = utils.json_to_sheet(data);
  ws["!cols"] = [{ wch: 16 }, { wch: 16 }, { wch: 80 }];
  return ws;
}

// ── Rules Sheet Builder ───────────────────────────

function buildRulesSheet(): WorkSheet {
  const data = [
    {
      "#": 1,
      Regla: "Formato",
      Detalle: "Solo .xlsx, .xls o .csv — máximo 10 MB",
    },
    {
      "#": 2,
      Regla: "Máximo filas",
      Detalle: "10,000 filas de datos (sin encabezado)",
    },
    {
      "#": 3,
      Regla: "Primera hoja",
      Detalle: "El sistema lee solo la PRIMERA hoja",
    },
    { "#": 4, Regla: "Filas vacías", Detalle: "Se omiten automáticamente" },
    {
      "#": 5,
      Regla: "SKU duplicados",
      Detalle: "Se usa la última fila. Las anteriores se marcan advertencia.",
    },
    {
      "#": 6,
      Regla: "Sin cajas internas",
      Detalle: 'Si Cajas/Bulto = "—", total = Bultos × Unid/Caja',
    },
    {
      "#": 7,
      Regla: "Con cajas internas",
      Detalle: "Total = Bultos × Cajas/Bulto × Unid/Caja",
    },
    {
      "#": 8,
      Regla: "Productos bloqueados",
      Detalle: "Solo admin/owner puede forzar actualización",
    },
    {
      "#": 9,
      Regla: "Presentación",
      Detalle: "Valores válidos: 1, 3, 6, 12, 24",
    },
    {
      "#": 10,
      Regla: "Columnas azules",
      Detalle: "NO modificar — son datos de referencia del catálogo",
    },
    {
      "#": 11,
      Regla: "Columnas verdes",
      Detalle: "OBLIGATORIO llenar — son los datos del conteo físico",
    },
  ];

  const ws = utils.json_to_sheet(data);
  ws["!cols"] = [{ wch: 5 }, { wch: 22 }, { wch: 60 }];
  return ws;
}

// ── Helpers ───────────────────────────────────────

function writeLegendCell(
  ws: WorkSheet,
  row: number,
  col: number,
  value: string,
  font: object,
): void {
  ws[utils.encode_cell({ r: row, c: col })] = {
    v: value,
    t: "s",
    s: { font },
  } satisfies CellObject;
}
