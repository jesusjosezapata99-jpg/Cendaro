import { describe, expect, it } from "vitest";

import {
  aoaToWorkbook,
  firstSheetToJson,
  jsonToWorkbook,
  sanitizeSpreadsheetCell,
} from "./workbook";

describe("Spreadsheet Formula Injection Protection (SEC-FE-04)", () => {
  it("prefixes formula control characters with a single quote", () => {
    expect(sanitizeSpreadsheetCell("=cmd|'/C calc'!A0")).toBe(
      "'=cmd|'/C calc'!A0",
    );
    expect(sanitizeSpreadsheetCell('+HYPERLINK("https://evil.test")')).toBe(
      '\'+HYPERLINK("https://evil.test")',
    );
    expect(sanitizeSpreadsheetCell("-2+3")).toBe("'-2+3");
    expect(sanitizeSpreadsheetCell("@SUM(A1:A10)")).toBe("'@SUM(A1:A10)");
    expect(sanitizeSpreadsheetCell("  =1+1")).toBe("'  =1+1");
  });

  it("leaves safe strings and numbers untouched", () => {
    expect(sanitizeSpreadsheetCell("Pastilla de Freno Cerámica")).toBe(
      "Pastilla de Freno Cerámica",
    );
    expect(sanitizeSpreadsheetCell(125.5)).toBe(125.5);
    expect(sanitizeSpreadsheetCell(null)).toBeNull();
  });

  it("sanitizes rows in jsonToWorkbook and aoaToWorkbook", () => {
    const wb = jsonToWorkbook([{ sku: "SKU-1", notes: "=1+1" }]);
    const rows = firstSheetToJson<{ sku: string; notes: string }>(wb);
    expect(rows[0]?.notes).toBe("'=1+1");

    const wbAoa = aoaToWorkbook([
      ["sku", "notes"],
      ["SKU-2", "@SUM(1,2)"],
    ]);
    const rowsAoa = firstSheetToJson<{ sku: string; notes: string }>(wbAoa);
    expect(rowsAoa[0]?.notes).toBe("'@SUM(1,2)");
  });
});
