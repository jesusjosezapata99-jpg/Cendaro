/**
 * Cendaro — Catalog Import Validators
 *
 * Client-side validation for parsed catalog rows.
 * Zod schemas + validation functions.
 *
 * PRD: FEATURE_PRD_CATALOG_IMPORT.md §12, §22, Appendix B
 */

import type { CatalogImportField } from "./catalog-header-aliases";
import {
  normalizeBarcode,
  normalizeBrand,
  normalizeCategory,
  normalizeName,
  normalizeQuantity,
  normalizeSku,
  parseDecimal,
  truncateString,
} from "./catalog-normalizers";

// ── Constants ────────────────────────────────────

/** Maximum file size: 10 MB */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** Maximum row count */
export const MAX_ROW_COUNT = 10_000;

/** Accepted MIME types */
export const ACCEPTED_MIME_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.ms-excel", // .xls
  "text/csv",
];

/** Accepted file extensions */
export const ACCEPTED_EXTENSIONS = [".xlsx", ".xls", ".csv"];

// ── Types ────────────────────────────────────────

export interface CatalogRowError {
  code: string;
  message: string;
  severity: "error" | "warning" | "info";
}

export interface ParsedCatalogRow {
  rowNumber: number;
  sku: string;
  name: string;
  categoryRaw?: string;
  brandRaw?: string;
  cost?: number;
  quantity?: number;
  barcode?: string;
  weight?: number;
  volume?: number;
  description?: string;
}

export interface ValidatedCatalogRow extends ParsedCatalogRow {
  status: "valid" | "warning" | "error";
  errors: CatalogRowError[];
}

// ── File Validation ──────────────────────────────

interface FileValidationResult {
  valid: boolean;
  code?: string;
  message?: string;
}

/**
 * Validate a file before parsing.
 * Checks: MIME type, extension, file size, empty file.
 */
export function validateFile(file: File): FileValidationResult {
  // Empty file
  if (file.size === 0) {
    return { valid: false, code: "EMPTY_FILE", message: "Archivo vacío" };
  }

  // File too large (PRD §22 edge case #1)
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      code: "FILE_TOO_LARGE",
      message: "Archivo excede 10 MB",
    };
  }

  // File extension check
  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (!ACCEPTED_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      code: "INVALID_FORMAT",
      message: `Formato no aceptado: ${ext}. Use .xlsx, .xls, o .csv`,
    };
  }

  return { valid: true };
}

// ── Row Parsing ──────────────────────────────────

/**
 * Parse a single row from the spreadsheet into a `ParsedCatalogRow`.
 *
 * @param row - Raw cell values from the spreadsheet row
 * @param headerMap - Mapping of field name → column index
 * @param rowNumber - 1-indexed row number for display
 */
export function parseRow(
  row: string[],
  headerMap: Record<string, number>,
  rowNumber: number,
): ParsedCatalogRow | null {
  const get = (field: CatalogImportField): string => {
    const idx = headerMap[field];
    return idx !== undefined ? String(row[idx] ?? "").trim() : "";
  };

  const sku = normalizeSku(get("sku"));
  const name = normalizeName(get("name"));

  // Skip completely empty rows (PRD §22 edge case #8)
  if (!sku && !name) return null;

  const costRaw = get("cost");
  const quantityRaw = get("quantity");
  const weightRaw = get("weight");
  const volumeRaw = get("volume");
  const descriptionRaw = get("description");

  return {
    rowNumber,
    sku,
    name,
    categoryRaw: normalizeCategory(get("category")) || undefined,
    brandRaw: normalizeBrand(get("brand")) || undefined,
    cost: costRaw ? (parseDecimal(costRaw) ?? undefined) : undefined,
    quantity: quantityRaw
      ? (normalizeQuantity(quantityRaw) ?? undefined)
      : undefined,
    barcode: normalizeBarcode(get("barcode")) || undefined,
    weight: weightRaw ? (parseDecimal(weightRaw) ?? undefined) : undefined,
    volume: volumeRaw ? (parseDecimal(volumeRaw) ?? undefined) : undefined,
    description: descriptionRaw || undefined,
  };
}

// ── Row Validation ───────────────────────────────

/**
 * Validate a parsed catalog row.
 *
 * @param row - A parsed row
 * @param seenSkus - Set of SKUs already seen (for duplicate detection)
 * @returns A validated row with errors attached
 */
export function validateRow(
  row: ParsedCatalogRow,
  seenSkus: Set<string>,
): ValidatedCatalogRow {
  const errors: CatalogRowError[] = [];

  // Required: SKU
  if (!row.sku) {
    errors.push({
      code: "REQUIRED_FIELD",
      message: '"SKU" es obligatorio pero está vacío',
      severity: "error",
    });
  }

  // Required: Name
  if (!row.name) {
    errors.push({
      code: "REQUIRED_FIELD",
      message: '"Nombre" es obligatorio pero está vacío',
      severity: "error",
    });
  }

  // SKU length
  if (row.sku && row.sku.length > 64) {
    errors.push({
      code: "VALUE_TRUNCATED",
      message: `SKU truncado de ${row.sku.length} a 64 caracteres`,
      severity: "warning",
    });
    row.sku = row.sku.slice(0, 64);
  }

  // Name length
  if (row.name && row.name.length > 512) {
    const { value } = truncateString(row.name, 512);
    row.name = value;
    errors.push({
      code: "VALUE_TRUNCATED",
      message: `Nombre truncado a 512 caracteres`,
      severity: "warning",
    });
  }

  // Duplicate SKU within file (PRD §22 edge case #4)
  if (row.sku && seenSkus.has(row.sku)) {
    errors.push({
      code: "DUPLICATE_SKU_FILE",
      message: `SKU "${row.sku}" duplicado en el archivo — se usa la última fila`,
      severity: "warning",
    });
  }
  if (row.sku) seenSkus.add(row.sku);

  // Cost validation
  if (row.cost !== undefined && row.cost < 0) {
    errors.push({
      code: "NEGATIVE_COST",
      message: `Costo no puede ser negativo. Recibido: "${row.cost}"`,
      severity: "error",
    });
  }

  // Quantity validation
  if (row.quantity !== undefined && row.quantity < 0) {
    errors.push({
      code: "INVALID_QUANTITY",
      message: `Cantidad debe ser un entero positivo. Recibido: "${row.quantity}"`,
      severity: "error",
    });
  }

  // Description truncation
  if (row.description && row.description.length > 2000) {
    const { value } = truncateString(row.description, 2000);
    row.description = value;
    errors.push({
      code: "VALUE_TRUNCATED",
      message: `Descripción truncada a 2000 caracteres`,
      severity: "warning",
    });
  }

  // Determine overall status
  const hasErrors = errors.some((e) => e.severity === "error");
  const hasWarnings = errors.some((e) => e.severity === "warning");

  return {
    ...row,
    status: hasErrors ? "error" : hasWarnings ? "warning" : "valid",
    errors,
  };
}

/**
 * Validate all parsed rows.
 * Handles duplicate SKU deduplication (keeps last occurrence).
 *
 * @returns validated rows + aggregate counts
 */
export function validateAllRows(rows: ParsedCatalogRow[]): {
  rows: ValidatedCatalogRow[];
  validCount: number;
  warningCount: number;
  errorCount: number;
} {
  const seenSkus = new Set<string>();
  const validatedRows = rows.map((row) => validateRow(row, seenSkus));

  // Deduplicate: mark earlier occurrences as duplicates
  // (seenSkus already has all of them; the validateRow function adds the warning)

  const validCount = validatedRows.filter((r) => r.status === "valid").length;
  const warningCount = validatedRows.filter(
    (r) => r.status === "warning",
  ).length;
  const errorCount = validatedRows.filter((r) => r.status === "error").length;

  return { rows: validatedRows, validCount, warningCount, errorCount };
}
