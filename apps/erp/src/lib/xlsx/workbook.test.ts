import { describe, expect, it } from "vitest";

import {
  aoaToCsv,
  aoaToWorkbook,
  firstSheetToJson,
  jsonToCsv,
  jsonToWorkbook,
  parseWorkbook,
  sanitizeSpreadsheetCell,
  workbookToBuffer,
} from "./workbook";

describe("Spreadsheet Formula Injection Protection", () => {
  it("prefixes formula control characters and control-byte smugglers with a single quote", () => {
    expect(sanitizeSpreadsheetCell("=cmd|'/C calc'!A0")).toBe(
      "'=cmd|'/C calc'!A0",
    );
    expect(sanitizeSpreadsheetCell('+HYPERLINK("https://evil.test")')).toBe(
      '\'+HYPERLINK("https://evil.test")',
    );
    expect(sanitizeSpreadsheetCell("-2+3")).toBe("'-2+3");
    expect(sanitizeSpreadsheetCell("-SUM(A1:A5)")).toBe("'-SUM(A1:A5)");
    expect(sanitizeSpreadsheetCell("@SUM(A1:A10)")).toBe("'@SUM(A1:A10)");
    expect(sanitizeSpreadsheetCell("  =1+1")).toBe("'  =1+1");
    expect(sanitizeSpreadsheetCell("\t=1+1")).toBe("'\t=1+1");
    expect(sanitizeSpreadsheetCell("\r=1+1")).toBe("'\r=1+1");
    expect(sanitizeSpreadsheetCell("\n=1+1")).toBe("'\n=1+1");
    expect(sanitizeSpreadsheetCell("\u0000=1+1")).toBe("'\u0000=1+1");
  });

  it("preserves Venezuelan / international E.164 phone numbers cleanly in XLSX and escapes them in CSV", () => {
    expect(sanitizeSpreadsheetCell("+584121234567")).toBe("+584121234567");
    expect(sanitizeSpreadsheetCell("+58 412-555-0199")).toBe(
      "+58 412-555-0199",
    );
    expect(sanitizeSpreadsheetCell("+58 (414) 123-4567")).toBe(
      "+58 (414) 123-4567",
    );

    // Round-trip binary .xlsx verification: phone remains an OpenXML shared string (`t: "s"`) without a literal `'`
    const wb = jsonToWorkbook([
      { customer: "Cliente Valencia", phone: "+58 412-555-0199" },
    ]);
    const roundTripped = parseWorkbook(workbookToBuffer(wb));
    const ws = roundTripped.Sheets.Sheet1;
    expect(ws?.B2?.t).toBe("s");
    expect(ws?.B2?.f).toBeUndefined();
    expect(ws?.B2?.v).toBe("+58 412-555-0199");

    // In typeless CSV, `+58-412-555-0199` must be prefixed so Excel never evaluates arithmetic subtraction
    expect(sanitizeSpreadsheetCell("+58-412-555-0199", { format: "csv" })).toBe(
      "'+58-412-555-0199",
    );
  });

  it("preserves negative balances and exact-money decimal strings as true numeric cells (`t: 'n'`) for SUM()", () => {
    expect(sanitizeSpreadsheetCell(-150.25)).toBe(-150.25);
    expect(sanitizeSpreadsheetCell("-150.00")).toBe(-150);
    expect(sanitizeSpreadsheetCell("-0.75")).toBe(-0.75);
    expect(sanitizeSpreadsheetCell("-0")).toBe(0);

    // Leading-zero codes (`-007`) must NOT be coerced to numbers and remain escaped
    expect(sanitizeSpreadsheetCell("-007")).toBe("'-007");

    // Binary .xlsx round-trip: both JS number and numeric string produce numeric cells (`t: "n"`)
    const wb = jsonToWorkbook([
      { account: "AR-1", balanceNum: -150.5, balanceStr: "-320.75" },
    ]);
    const roundTripped = parseWorkbook(workbookToBuffer(wb));
    const ws = roundTripped.Sheets.Sheet1;
    expect(ws?.B2?.t).toBe("n");
    expect(ws?.B2?.v).toBe(-150.5);
    expect(ws?.C2?.t).toBe("n");
    expect(ws?.C2?.v).toBe(-320.75);
  });

  it("leaves safe strings and numbers untouched", () => {
    expect(sanitizeSpreadsheetCell("Pastilla de Freno Cerámica")).toBe(
      "Pastilla de Freno Cerámica",
    );
    expect(sanitizeSpreadsheetCell(125.5)).toBe(125.5);
    expect(sanitizeSpreadsheetCell(null)).toBeNull();
  });

  it("sanitizes rows in jsonToWorkbook, aoaToWorkbook, jsonToCsv, and aoaToCsv", () => {
    const wb = jsonToWorkbook([{ sku: "SKU-1", notes: "=1+1" }]);
    const rows = firstSheetToJson<{ sku: string; notes: string }>(wb);
    expect(rows[0]?.notes).toBe("'=1+1");

    const wbAoa = aoaToWorkbook([
      ["sku", "notes"],
      ["SKU-2", "@SUM(1,2)"],
    ]);
    const rowsAoa = firstSheetToJson<{ sku: string; notes: string }>(wbAoa);
    expect(rowsAoa[0]?.notes).toBe("'@SUM(1,2)");

    const csv = jsonToCsv([
      {
        sku: "SKU-3",
        phone: "+58-412-555-0199",
        balance: "-150.25",
        payload: '=HYPERLINK("https://evil.test","click")',
      },
    ]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("'+58-412-555-0199");
    expect(csv).toContain(",-150.25,");
    expect(csv).toContain('"\'=HYPERLINK(""https://evil.test"",""click"")"');

    const aoaCsv = aoaToCsv([["=CMD|'/C calc'!A0"]], { includeBom: false });
    expect(aoaCsv).toBe("'=CMD|'/C calc'!A0");
  });
});
