import type { WorkBook } from "xlsx";
import { writeFile } from "xlsx";

import {
  buildMultiSheetWorkbook,
  jsonToWorkbook,
  workbookToBuffer,
} from "./workbook";

/** Trigger a browser download of an xlsx from an array of objects */
export function downloadAsXlsx<T extends object>(
  rows: T[],
  filename = "export.xlsx",
  sheetName = "Sheet1",
): void {
  const wb = jsonToWorkbook(rows, sheetName);
  writeFile(wb, filename);
}

/** Trigger a browser download from a pre-built WorkBook */
export function downloadWorkbook(wb: WorkBook, filename = "export.xlsx"): void {
  writeFile(wb, filename);
}

/** Trigger a browser download of a multi-sheet workbook */
export function downloadMultiSheet(
  sheets: { name: string; rows: object[] }[],
  filename = "export.xlsx",
): void {
  const wb = buildMultiSheetWorkbook(sheets);
  writeFile(wb, filename);
}

/** Convert a workbook to a Blob (useful for fetch/upload scenarios) */
export function workbookToBlob(wb: WorkBook): Blob {
  const buf = workbookToBuffer(wb);
  return new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
