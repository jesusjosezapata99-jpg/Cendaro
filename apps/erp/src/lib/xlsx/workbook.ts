import type { WorkBook, WorkSheet } from "xlsx";
import { read, utils, write } from "xlsx";

/** Parse an ArrayBuffer or Uint8Array into a WorkBook */
export function parseWorkbook(data: ArrayBuffer | Uint8Array): WorkBook {
  return read(data, { type: "array" });
}

/** Get typed row data from the first sheet */
export function firstSheetToJson<T>(wb: WorkBook): T[] {
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("Workbook has no sheets");
  const ws: WorkSheet | undefined = wb.Sheets[sheetName];
  if (!ws) throw new Error("Sheet not found");
  return utils.sheet_to_json<T>(ws);
}

/** Get typed row data from a named sheet (throws if not found) */
export function sheetToJson<T>(wb: WorkBook, sheetName: string): T[] {
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error(`Sheet "${sheetName}" not found`);
  return utils.sheet_to_json<T>(ws);
}

/** Build a workbook from an array of objects (single sheet) */
export function jsonToWorkbook<T extends object>(
  rows: T[],
  sheetName = "Sheet1",
): WorkBook {
  const ws = utils.json_to_sheet(rows);
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, sheetName);
  return wb;
}

/** Build a workbook from multiple named sheets */
export function buildMultiSheetWorkbook(
  sheets: { name: string; rows: object[] }[],
): WorkBook {
  const wb = utils.book_new();
  for (const { name, rows } of sheets) {
    const ws = utils.json_to_sheet(rows);
    utils.book_append_sheet(wb, ws, name);
  }
  return wb;
}

/** Build a workbook from an array-of-arrays (with custom headers) */
export function aoaToWorkbook(
  data: unknown[][],
  sheetName = "Sheet1",
): WorkBook {
  const ws = utils.aoa_to_sheet(data);
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, sheetName);
  return wb;
}

/** Serialize a workbook to a Uint8Array buffer */
export function workbookToBuffer(wb: WorkBook): Uint8Array {
  return write(wb, { bookType: "xlsx", type: "array" }) as Uint8Array;
}

/** Auto-fit column widths based on data content */
export function autoFitColumns(ws: WorkSheet, rows: object[]): void {
  const keys = Object.keys(rows[0] ?? {});
  ws["!cols"] = keys.map((key) => {
    const maxLen = Math.max(
      key.length,
      ...rows.map((r) => {
        const val = (
          r as Record<string, string | number | boolean | null | undefined>
        )[key];
        return String(val ?? "").length;
      }),
    );
    return { wch: Math.min(maxLen + 2, 50) };
  });
}
