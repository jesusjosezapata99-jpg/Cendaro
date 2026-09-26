#!/usr/bin/env node
/**
 * Fictitious Excel files uploaded during the recordings
 * (PLAN-2026-09-LANDING-REDESIGN F3), written to scripts/landing-media/.cache/:
 *
 *  - packing-list-ningbo.xlsx: a supplier packing list (English goods, no SKUs)
 *    built from CONTAINER_ITEMS, for `flow-container-ai`;
 *  - catalogo-cliente.xlsx: the kind of catalog spreadsheet a distributor keeps
 *    today, with inconsistent category spellings, for `flow-catalog-import`.
 *
 * Usage (repo root): node scripts/landing-media/make-fixtures.mjs
 */
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { CONTAINER_ITEMS } from "./demo-data.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const XLSX = createRequire(join(ROOT, "apps/erp/package.json"))("xlsx");
const CACHE = join(ROOT, "scripts/landing-media/.cache");

export const PACKING_LIST_PATH = join(CACHE, "packing-list-ningbo.xlsx");
export const CATALOG_PATH = join(CACHE, "catalogo-cliente.xlsx");
export const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const round2 = (n) => Math.round(n * 100) / 100;

function writeSheet(path, sheetName, aoa, widths) {
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  sheet["!cols"] = widths.map((wch) => ({ wch }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
  mkdirSync(CACHE, { recursive: true });
  XLSX.writeFile(workbook, path);
}

function buildPackingList() {
  const rows = CONTAINER_ITEMS.map(
    ([english, , , quantity, unitCost], index) => [
      index + 1,
      english,
      quantity,
      unitCost,
      round2(quantity * unitCost),
      Math.round(quantity * (0.2 + (index % 5) * 0.35) * 10) / 10,
    ],
  );
  const totalQty = rows.reduce((sum, row) => sum + row[2], 0);
  const totalAmount = rows.reduce((sum, row) => sum + row[4], 0);
  writeSheet(
    PACKING_LIST_PATH,
    "Packing List",
    [
      ["NINGBO HAOYU TRADING CO., LTD."],
      ["PACKING LIST / COMMERCIAL INVOICE"],
      ["Container: MSKU 4829137", "", "Port of loading: NINGBO, CN"],
      [],
      [
        "ITEM",
        "DESCRIPTION OF GOODS",
        "QTY (PCS)",
        "UNIT PRICE (USD)",
        "AMOUNT (USD)",
        "G.W. (KG)",
      ],
      ...rows,
      ["", "TOTAL", totalQty, "", round2(totalAmount), ""],
    ],
    [6, 34, 11, 17, 14, 10],
  );
  return rows.length;
}

/** [code, description, category as typed by the client, brand, cost, retail, wholesale, stock] */
const CATALOG_ROWS = [
  ["NUE-001", "Linterna LED recargable 3 W", "Iluminacion", "Lumen", 2.4, 5.5, 4.4, 60],
  ["NUE-002", "Foco ahorrador espiral 23 W", "Iluminacion", "Lumen", 1.1, 2.6, 2.1, 240],
  ["NUE-003", "Panel LED cuadrado 18 W", "Iluminacion", "Lumen", 3.2, 7.4, 5.9, 90],
  ["NUE-004", "Regleta 6 tomas con protector", "Ferreteria", "Tauro", 4.1, 9.2, 7.4, 45],
  ["NUE-005", "Pila alcalina AA x4", "Ferreteria", "Tauro", 1.3, 3.1, 2.5, 300],
  ["NUE-006", "Teipe eléctrico negro 18 mm", "Ferreteria", "Tauro", 0.45, 1.2, 0.95, 500],
  ["NUE-007", "Cerradura de pomo cromada", "Ferretería", "Tauro", 5.6, 12.5, 10.2, 30],
  ["NUE-008", "Multiuso limón 1 L", "Limpieza del hogar", "Brisa", 0.95, 2.1, 1.7, 280],
  ["NUE-009", "Desengrasante cocina 750 ml", "Limpieza del hogar", "Brisa", 1.4, 3.2, 2.6, 160],
  ["NUE-010", "Jabón en barra lavandería x3", "limpieza", "Nubia", 0.8, 1.9, 1.5, 420],
  ["NUE-011", "Ambientador aerosol 400 ml", "LIMPIEZA", "Nubia", 1.5, 3.4, 2.7, 190],
  ["NUE-012", "Trapeador microfibra giratorio", "Hogar", "Marelo", 7.9, 16.5, 13.4, 25],
  ["NUE-013", "Cesta organizadora plegable", "Hogar", "Marelo", 2.8, 6.2, 5.0, 75],
  ["NUE-014", "Juego de sábanas queen", "Hogar y cocina", "Andina", 9.5, 19.9, 16.2, 40],
  ["NUE-015", "Termo para café 500 ml", "Hogar y cocina", "Cristal", 3.6, 8.1, 6.5, 85],
  ["NUE-016", "Set de tazas de cerámica x6", "Hogar y cocina", "Cristal", 4.8, 10.4, 8.4, 55],
  ["NUE-017", "Toallas de mano x3", "Cuidado Personal", "Andina", 2.9, 6.6, 5.3, 110],
  ["NUE-018", "Cepillo dental medio x4", "Cuidado personal", "Nubia", 1.2, 2.8, 2.2, 260],
  ["NUE-019", "Crema corporal 400 ml", "Cuidado personal", "Andina", 2.6, 5.9, 4.7, 95],
  ["NUE-020", "Cuaderno espiral 200 h", "Papeleria", "Cristal", 1.6, 3.7, 3.0, 320],
  ["NUE-021", "Carpeta plástica tamaño oficio", "Papeleria", "Cristal", 0.5, 1.3, 1.0, 600],
  ["NUE-022", "Calculadora de escritorio 12 díg.", "Papelería", "Lumen", 3.4, 7.7, 6.2, 48],
  // Rows the validation step should flag: a negative cost and an existing SKU.
  ["NUE-023", "Cinta métrica 3 m", "Ferreteria", "Tauro", -2, 4.9, 3.9, 15],
  ["LIM-001", "Detergente líquido 2 L", "Limpieza", "Brisa", 2.1, 3.9, 3.2, 100],
];

function buildCatalog() {
  writeSheet(
    CATALOG_PATH,
    "Catálogo",
    [
      // Headers the importer recognizes (catalog-header-aliases.ts).
      ["Código", "Descripción", "Categoría", "Marca", "Costo", "Cantidad"],
      ...CATALOG_ROWS.map(
        ([code, name, category, brand, cost, , , stock]) => [
          code,
          name,
          category,
          brand,
          cost,
          stock,
        ],
      ),
    ],
    [10, 36, 20, 12, 10, 10],
  );
  return CATALOG_ROWS.length;
}

export function makeFixtures() {
  return { packingListLines: buildPackingList(), catalogRows: buildCatalog() };
}

if (process.argv[1]?.endsWith("make-fixtures.mjs")) {
  const { packingListLines, catalogRows } = makeFixtures();
  console.log(`Packing list: ${packingListLines} lines → ${PACKING_LIST_PATH}`);
  console.log(`Client catalog: ${catalogRows} rows → ${CATALOG_PATH}`);
}
