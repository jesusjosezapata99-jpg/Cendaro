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

/**
 * Strict negative finite decimal strings (e.g. `"-150.00"`, `"-5"`, `"-0.75"`).
 * Rejects arithmetic expressions (`"-2+3"`), functions (`"-SUM(A1)"`), and
 * leading-zero identifier codes (`"-007"`).
 */
const STRICT_NEGATIVE_DECIMAL_RE = /^\s*-(?:0|[1-9]\d*)(?:\.\d+)?\s*$/;

/**
 * Benign international E.164 / Venezuelan phone strings (e.g. `"+584121234567"`,
 * `"+58 412-555-0199"`, `"+58 (414) 123-4567"`). Contains ONLY `+` followed by a
 * digit and digits/spaces/parentheses/hyphens — zero letters, `=`, `@`, `|`,
 * quotes, slashes, or control characters.
 *
 * Safe to leave unprefixed in OpenXML `.xlsx` (where SheetJS writes explicit
 * `<c t="s">` shared-string cells), whereas `.csv` has no cell type metadata and
 * must still prefix `'` so Excel does not evaluate `+58-412-...` as subtraction.
 */
const SAFE_E164_PHONE_RE = /^\+\d[\d\s()-]{6,22}$/;

/**
 * Matches formula / DDE triggers (`=`, `+`, `-`, `@`, `|`), including payloads
 * smuggled behind whitespace or ASCII control characters (`\x00`–`\x1f`), as
 * well as leading tabs, CR/LF newlines, or control bytes.
 */
// eslint-disable-next-line no-control-regex
const DANGEROUS_CELL_RE = /^[\s\u0000-\u001f]*[=+\-@|]|^[\t\r\n\u0000-\u001f]/;

export interface SanitizeCellOptions {
  format?: "xlsx" | "csv";
}

/**
 * Neutralize Spreadsheet Formula Injection (CSV / DDE Injection) while
 * preserving:
 *   1. True numeric cells (`t: "n"`) for negative decimal strings (`"-150.00"` -> `-150`)
 *      so accounting `SUM()` formulas work accurately in Excel / LibreOffice Calc.
 *   2. Clean display & round-trip fidelity for international phone numbers
 *      (`"+584121234567"`) in `.xlsx` OpenXML string cells.
 */
export function sanitizeSpreadsheetCell(
  value: unknown,
  options?: SanitizeCellOptions,
): unknown {
  if (typeof value !== "string") {
    if (typeof value === "number" && Object.is(value, -0)) {
      return 0;
    }
    return value;
  }

  const format = options?.format ?? "xlsx";

  // 1. Convert strict negative decimal strings (<= 15 significant digits) into
  //    finite IEEE-754 numbers so SheetJS emits `{ t: "n" }` instead of `'`.
  if (STRICT_NEGATIVE_DECIMAL_RE.test(value)) {
    const trimmed = value.trim();
    const digitCount = trimmed.replace(/[^0-9]/g, "").length;
    if (digitCount <= 15) {
      const parsed = Number(trimmed);
      if (Number.isFinite(parsed)) {
        return parsed === 0 ? 0 : parsed;
      }
    }
  }

  // 2. Allow benign E.164 / Venezuelan phone strings unprefixed in `.xlsx`
  //    (`<c t="s">`), while still prefixing `'` in typeless `.csv`.
  if (format === "xlsx" && SAFE_E164_PHONE_RE.test(value)) {
    return value;
  }

  // 3. Prefix any remaining formula / DDE / control-character payload with `'`.
  if (DANGEROUS_CELL_RE.test(value)) {
    return `'${value}`;
  }

  return value;
}

function sanitizeRow<T extends object>(
  row: T,
  options?: SanitizeCellOptions,
): T {
  const copy: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    copy[k] = sanitizeSpreadsheetCell(v, options);
  }
  return copy as T;
}

function escapeCsvField(raw: unknown): string {
  const sanitized = sanitizeSpreadsheetCell(raw, { format: "csv" });
  if (sanitized === null || sanitized === undefined) {
    return "";
  }
  const str =
    typeof sanitized === "string"
      ? sanitized
      : typeof sanitized === "number" ||
          typeof sanitized === "boolean" ||
          typeof sanitized === "bigint"
        ? String(sanitized)
        : sanitized instanceof Date
          ? sanitized.toISOString()
          : JSON.stringify(sanitized);
  if (/[",\r\n]|^\s|\s$/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export interface CsvSerializeOptions {
  /** Prepend UTF-8 BOM (`\uFEFF`) so Windows Excel renders Spanish accents cleanly. Defaults to `true`. */
  includeBom?: boolean;
}

/** Serialize an array-of-arrays into an RFC-4180 + formula-hardened CSV string */
export function aoaToCsv(
  rows: unknown[][],
  options?: CsvSerializeOptions,
): string {
  const includeBom = options?.includeBom ?? true;
  const body = rows
    .map((row) => row.map((cell) => escapeCsvField(cell)).join(","))
    .join("\r\n");
  return `${includeBom ? "\uFEFF" : ""}${body}`;
}

/** Serialize an array of objects into an RFC-4180 + formula-hardened CSV string */
export function jsonToCsv<T extends object>(
  rows: T[],
  options?: CsvSerializeOptions,
): string {
  const includeBom = options?.includeBom ?? true;
  if (rows.length === 0) {
    return includeBom ? "\uFEFF" : "";
  }
  const headers: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        headers.push(key);
      }
    }
  }
  const aoa: unknown[][] = [
    headers,
    ...rows.map((row) =>
      headers.map((h) => (row as Record<string, unknown>)[h]),
    ),
  ];
  return aoaToCsv(aoa, { includeBom });
}

/** Build a workbook from an array of objects (single sheet) */
export function jsonToWorkbook<T extends object>(
  rows: T[],
  sheetName = "Sheet1",
): WorkBook {
  const ws = utils.json_to_sheet(rows.map((r) => sanitizeRow(r)));
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
    const ws = utils.json_to_sheet(rows.map((r) => sanitizeRow(r)));
    utils.book_append_sheet(wb, ws, name);
  }
  return wb;
}

/** Build a workbook from an array-of-arrays (with custom headers) */
export function aoaToWorkbook(
  data: unknown[][],
  sheetName = "Sheet1",
): WorkBook {
  const sanitized = data.map((row) =>
    row.map((cell) => sanitizeSpreadsheetCell(cell)),
  );
  const ws = utils.aoa_to_sheet(sanitized);
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
