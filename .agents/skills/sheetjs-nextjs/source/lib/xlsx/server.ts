// ⚠️  SERVER ONLY — do not import in Client Components ("use client")
// Safe to use in: Route Handlers, Server Components, Server Actions

import { join } from "path";
import { readFile } from "xlsx";

import {
  buildMultiSheetWorkbook,
  jsonToWorkbook,
  workbookToBuffer,
} from "./workbook";

const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Read a spreadsheet from the filesystem (relative to project root) */
export function readSheetFile(relativePath: string) {
  const fullPath = join(process.cwd(), relativePath);
  return readFile(fullPath);
}

/** Build a streaming xlsx Response for a Route Handler (single sheet) */
export function xlsxResponse<T extends object>(
  rows: T[],
  filename = "export.xlsx",
  sheetName = "Sheet1",
): Response {
  const wb = jsonToWorkbook(rows, sheetName);
  const buf = workbookToBuffer(wb);
  return new Response(buf, {
    headers: {
      "Content-Type": XLSX_CONTENT_TYPE,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

/** Build a multi-sheet xlsx Response for a Route Handler */
export function xlsxMultiSheetResponse(
  sheets: { name: string; rows: object[] }[],
  filename = "export.xlsx",
): Response {
  const wb = buildMultiSheetWorkbook(sheets);
  const buf = workbookToBuffer(wb);
  return new Response(buf, {
    headers: {
      "Content-Type": XLSX_CONTENT_TYPE,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
