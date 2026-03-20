"use client";

/**
 * Cendaro — Product Catalog Template Builder
 *
 * Generates professional, multi-sheet XLSX templates for bulk product creation.
 * Headers MUST match the alias map in `catalog-header-aliases.ts` to be
 * auto-detected by the import wizard parser.
 *
 * Pipeline fields (from catalogImportRowSchema):
 *   sku, name, categoryRaw, brandRaw, cost, quantity,
 *   barcode, weight, volume, description
 *
 * Sheets:
 *  1. Productos — data entry sheet with legend + headers
 *  2. Instrucciones — column descriptions
 *  3. Reglas — validation rules
 *  4. Valores Válidos — reference tables
 */
import type { CellObject, WorkSheet } from "xlsx";
import { utils, writeFile } from "xlsx";

// ── Types ─────────────────────────────────────

export interface BrandRef {
  id: string;
  name: string;
}

export interface CategoryRef {
  id: string;
  name: string;
}

export interface SupplierRef {
  id: string;
  name: string;
}

// ── Constants ─────────────────────────────────

/** Blue (reference) background — read-only cells */
const BLUE_FILL = { patternType: "solid", fgColor: { rgb: "D6EAF8" } } as const;

/** Green (editable) background — employee fills */
const GREEN_FILL = {
  patternType: "solid",
  fgColor: { rgb: "D5F5E3" },
} as const;

/** Dark header background */
const HEADER_FILL = {
  patternType: "solid",
  fgColor: { rgb: "2C3E50" },
} as const;

const HEADER_FONT = { bold: true, color: { rgb: "FFFFFF" }, sz: 11 } as const;
const LEGEND_TITLE_FONT = { bold: true, sz: 13 } as const;
const LEGEND_FONT = { sz: 10 } as const;
const BOLD_FONT = { bold: true, sz: 10 } as const;

// ── Headers ───────────────────────────────────
// These MUST be recognized by catalog-header-aliases.ts
// after normalizeHeader() (lowercase + strip diacritics + strip *).
//
// Required fields use trailing " *" for visual indication.
// normalizeHeader() strips * so "referencia *" → "referencia" → alias "sku".

const PRODUCT_HEADERS = [
  "Referencia *", // → normalizes to "referencia" → alias "sku"
  "Nombre *", // → normalizes to "nombre" → alias "name"
  "Categoria", // → normalizes to "categoria" → alias "category"
  "Marca", // → normalizes to "marca" → alias "brand"
  "Costo", // → normalizes to "costo" → alias "cost"
  "Cantidad", // → normalizes to "cantidad" → alias "quantity"
  "Codigo de Barras", // → normalizes to "codigo de barras" → alias "barcode"
  "Peso", // → normalizes to "peso" → alias "weight"
  "Volumen", // → normalizes to "volumen" → alias "volume"
  "Notas", // → normalizes to "notas" → alias "description"
];

const COL_WIDTHS: Record<string, number> = {
  Referencia: 18,
  Nombre: 36,
  Categoria: 18,
  Marca: 18,
  Costo: 14,
  Cantidad: 14,
  "Codigo de Barras": 22,
  Peso: 12,
  Volumen: 12,
  Notas: 30,
};

// ── Builder ───────────────────────────────────

/**
 * Build and download a professional product catalog import template.
 *
 * @param brands - existing brands for reference
 * @param categories - existing categories for reference
 * @param suppliers - existing suppliers for reference (informational only)
 */
export function downloadProductTemplate(
  brands: BrandRef[] = [],
  categories: CategoryRef[] = [],
  suppliers: SupplierRef[] = [],
): void {
  const wb = utils.book_new();

  // ── Sheet 1: Productos (Data) ────────────────
  const ws = buildDataSheet();
  utils.book_append_sheet(wb, ws, "Productos");

  // ── Sheet 2: Instrucciones ────────────────────
  const instrSheet = buildInstructionsSheet();
  utils.book_append_sheet(wb, instrSheet, "Instrucciones");

  // ── Sheet 3: Reglas ──────────────────────────
  const rulesSheet = buildRulesSheet();
  utils.book_append_sheet(wb, rulesSheet, "Reglas");

  // ── Sheet 4: Valores Válidos ──────────────────
  const valuesSheet = buildValidValuesSheet(brands, categories, suppliers);
  utils.book_append_sheet(wb, valuesSheet, "Valores Validos");

  // ── Download ─────────────────────────────────
  writeFile(wb, "Cendaro_Plantilla_Catalogo.xlsx");
}

// ── Data Sheet Builder ────────────────────────

function buildDataSheet(): WorkSheet {
  const ws: WorkSheet = {};
  const LEGEND_ROWS = 7;
  const HEADER_ROW = LEGEND_ROWS + 1;
  const EXAMPLE_START = HEADER_ROW + 1;

  // ── Legend Block (rows 1–6) ────────────────
  writeLegendCell(
    ws,
    0,
    0,
    "CENDARO — Plantilla de Catalogo: Importacion Masiva de Productos",
    LEGEND_TITLE_FONT,
  );
  writeLegendCell(
    ws,
    1,
    0,
    "─────────────────────────────────────────────────────────────",
    LEGEND_FONT,
  );
  writeLegendCell(
    ws,
    2,
    0,
    "🟩  Todos los campos verdes son editables",
    BOLD_FONT,
  );
  writeLegendCell(
    ws,
    3,
    0,
    "Campos obligatorios: Referencia y Nombre (sin ellos la fila se rechaza)",
    BOLD_FONT,
  );
  writeLegendCell(
    ws,
    4,
    0,
    "Costo en USD — se convierte automaticamente a Bs con la tasa BCV vigente",
    LEGEND_FONT,
  );
  writeLegendCell(
    ws,
    5,
    0,
    "Si un SKU ya existe en el catalogo, se actualizan los campos no vacios",
    LEGEND_FONT,
  );

  // ── Header Row (row 8) ────────────────────────
  for (let c = 0; c < PRODUCT_HEADERS.length; c++) {
    const headerName = PRODUCT_HEADERS[c];
    if (!headerName) continue;
    const isRequired = headerName.endsWith(" *");
    const cell: CellObject = {
      v: headerName,
      t: "s",
      s: {
        fill: HEADER_FILL,
        font: {
          ...HEADER_FONT,
          ...(isRequired ? { underline: true } : {}),
        },
        alignment: { horizontal: "center" },
      },
    };
    ws[utils.encode_cell({ r: HEADER_ROW - 1, c })] = cell;
  }

  // ── Example Row (row 9) — one sample product ──
  const exampleProduct = [
    "REF-001", // Referencia
    "Cable USB-C Premium", // Nombre
    "Cables", // Categoria
    "TechBrand", // Marca
    "2.50", // Costo
    "100", // Cantidad
    "7501234567890", // Codigo de Barras
    "0.15", // Peso
    "0.002", // Volumen
    "Cable USB-C 1.5m reforzado", // Notas
  ];

  for (let c = 0; c < exampleProduct.length; c++) {
    const value = exampleProduct[c];
    if (value === undefined) continue;
    const cell: CellObject = {
      v: value,
      t: "s",
      s: {
        fill: GREEN_FILL,
        font: { sz: 10, color: { rgb: "666666" } },
        alignment: { horizontal: "left" },
      },
    };
    ws[utils.encode_cell({ r: EXAMPLE_START - 1, c })] = cell;
  }

  // ── Empty editable rows (rows 10-30) ──────────
  const EMPTY_ROWS = 20;
  for (let r = 0; r < EMPTY_ROWS; r++) {
    for (let c = 0; c < PRODUCT_HEADERS.length; c++) {
      const cell: CellObject = {
        v: "",
        t: "s",
        s: {
          fill: GREEN_FILL,
          alignment: { horizontal: "left" },
        },
      };
      ws[utils.encode_cell({ r: EXAMPLE_START + r, c })] = cell;
    }
  }

  // ── Sheet Configuration ────────────────────────
  const totalRows = EXAMPLE_START + EMPTY_ROWS + 1;
  ws["!ref"] = utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: totalRows - 1, c: PRODUCT_HEADERS.length - 1 },
  });

  ws["!cols"] = PRODUCT_HEADERS.map((h) => ({ wch: COL_WIDTHS[h] ?? 14 }));

  ws["!freeze"] = {
    xSplit: 0,
    ySplit: HEADER_ROW,
    topLeftCell: `A${EXAMPLE_START}`,
  };

  ws["!merges"] = [];
  for (let r = 0; r < 6; r++) {
    ws["!merges"].push({
      s: { r, c: 0 },
      e: { r, c: PRODUCT_HEADERS.length - 1 },
    });
  }

  return ws;
}

// ── Instructions Sheet Builder ────────────────

function buildInstructionsSheet(): WorkSheet {
  const data = [
    {
      Columna: "Referencia",
      Obligatorio: "Si",
      Descripcion:
        "SKU / codigo de referencia unico del producto. Max 64 caracteres. Si ya existe en el catalogo se actualiza.",
    },
    {
      Columna: "Nombre",
      Obligatorio: "Si",
      Descripcion: "Nombre completo del producto. Max 512 caracteres.",
    },
    {
      Columna: "Categoria",
      Obligatorio: "No",
      Descripcion:
        "Nombre de la categoria. Si no existe, el wizard pedira mapearla manualmente.",
    },
    {
      Columna: "Marca",
      Obligatorio: "No",
      Descripcion:
        "Nombre de la marca. Se busca por nombre exacto o slug. Si no se encuentra se omite.",
    },
    {
      Columna: "Costo",
      Obligatorio: "No",
      Descripcion:
        "Costo unitario en USD. Acepta decimales con punto o coma (ej: 2.50 o 2,50).",
    },
    {
      Columna: "Cantidad",
      Obligatorio: "No",
      Descripcion:
        "Cantidad inicial de stock. Entero positivo. Solo se aplica si se provee un almacen por defecto.",
    },
    {
      Columna: "Codigo de Barras",
      Obligatorio: "No",
      Descripcion: "Codigo EAN/UPC del producto. Max 128 caracteres.",
    },
    {
      Columna: "Peso",
      Obligatorio: "No",
      Descripcion: "Peso en kg. Acepta decimales.",
    },
    {
      Columna: "Volumen",
      Obligatorio: "No",
      Descripcion: "Volumen en m3. Acepta decimales.",
    },
    {
      Columna: "Notas",
      Obligatorio: "No",
      Descripcion: "Descripcion o notas del producto. Max 2000 caracteres.",
    },
  ];

  const ws = utils.json_to_sheet(data);
  ws["!cols"] = [{ wch: 20 }, { wch: 12 }, { wch: 80 }];
  return ws;
}

// ── Rules Sheet Builder ───────────────────────

function buildRulesSheet(): WorkSheet {
  const data = [
    {
      "#": 1,
      Regla: "Formato",
      Detalle: "Solo .xlsx, .xls o .csv — maximo 10 MB",
    },
    {
      "#": 2,
      Regla: "Maximo filas",
      Detalle: "10,000 filas de datos (sin encabezado)",
    },
    {
      "#": 3,
      Regla: "Hoja utilizada",
      Detalle: "El sistema lee SOLO la primera hoja del archivo",
    },
    {
      "#": 4,
      Regla: "Deteccion de encabezados",
      Detalle:
        "El wizard busca en las primeras 20 filas una fila con al menos 2 columnas reconocidas",
    },
    {
      "#": 5,
      Regla: "Filas vacias",
      Detalle: "Se omiten automaticamente",
    },
    {
      "#": 6,
      Regla: "Referencia obligatoria",
      Detalle: "Cada producto debe tener una Referencia (SKU) unica",
    },
    {
      "#": 7,
      Regla: "Nombre obligatorio",
      Detalle: "Cada producto debe tener un Nombre",
    },
    {
      "#": 8,
      Regla: "SKU duplicados en archivo",
      Detalle:
        "Si un SKU aparece multiples veces en el archivo, se usa la ultima fila",
    },
    {
      "#": 9,
      Regla: "SKU existente en catalogo",
      Detalle:
        "Si el SKU ya existe en Cendaro, se actualizan los campos no vacios (no se sobreescriben con valores vacios)",
    },
    {
      "#": 10,
      Regla: "Categorias no encontradas",
      Detalle:
        "El wizard muestra un paso de mapeo donde puedes asignar manualmente las categorias no reconocidas",
    },
    {
      "#": 11,
      Regla: "Fila de ejemplo",
      Detalle:
        "La fila 9 es un ejemplo. Puedes modificarla o dejarla — el wizard la procesara como dato normal.",
    },
  ];

  const ws = utils.json_to_sheet(data);
  ws["!cols"] = [{ wch: 5 }, { wch: 28 }, { wch: 80 }];
  return ws;
}

// ── Valid Values Sheet Builder ─────────────────

function buildValidValuesSheet(
  brands: BrandRef[],
  categories: CategoryRef[],
  suppliers: SupplierRef[],
): WorkSheet {
  const ws: WorkSheet = {};

  // Build columns side by side
  const columns = [
    {
      header: "Marcas Existentes",
      values: brands.map((b) => b.name),
    },
    {
      header: "Categorias Existentes",
      values: categories.map((c) => c.name),
    },
    {
      header: "Proveedores (Referencia)",
      values: suppliers.map((s) => s.name),
    },
  ];

  let maxRows = 0;

  for (let c = 0; c < columns.length; c++) {
    const col = columns[c];
    if (!col) continue;

    // Header
    ws[utils.encode_cell({ r: 0, c })] = {
      v: col.header,
      t: "s",
      s: { fill: HEADER_FILL, font: HEADER_FONT },
    } satisfies CellObject;

    // Values
    for (let r = 0; r < col.values.length; r++) {
      ws[utils.encode_cell({ r: r + 1, c })] = {
        v: col.values[r] ?? "",
        t: "s",
        s: { fill: BLUE_FILL },
      } satisfies CellObject;
    }

    maxRows = Math.max(maxRows, col.values.length + 1);
  }

  ws["!ref"] = utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: Math.max(maxRows, 1), c: columns.length - 1 },
  });

  ws["!cols"] = [{ wch: 24 }, { wch: 24 }, { wch: 24 }];

  return ws;
}

// ── Helpers ───────────────────────────────────

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
