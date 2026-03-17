import { read, utils } from "xlsx";

import { firstSheetToJson, parseWorkbook } from "./workbook";

/** Read a File object from an <input type="file"> and parse the first sheet */
export async function fileToJson<T>(file: File): Promise<T[]> {
  const buffer = await file.arrayBuffer();
  const wb = parseWorkbook(buffer);
  return firstSheetToJson<T>(wb);
}

/** Read a File and return every sheet as a named map */
export async function fileToAllSheets(
  file: File,
): Promise<Record<string, unknown[]>> {
  const buffer = await file.arrayBuffer();
  const wb = read(buffer, { type: "array" });
  const result: Record<string, unknown[]> = {};
  for (const name of wb.SheetNames) {
    result[name] = utils.sheet_to_json(wb.Sheets[name]);
  }
  return result;
}

/** Parse a file and correctly deserialize date cells */
export async function fileToJsonWithDates<T>(file: File): Promise<T[]> {
  const buffer = await file.arrayBuffer();
  const wb = read(buffer, { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return utils.sheet_to_json<T>(ws, { raw: false });
}
