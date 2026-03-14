/**
 * Cendaro — Inventory Import Validators
 *
 * Row-level validation logic for inventory import data.
 * Produces ValidatedRow[] with per-row status/message.
 *
 * PRD: FEATURE_PRD_INVENTORY_IMPORT.md §11, Appendix B
 */

import type { ImportMode, ValidatedRow } from "@cendaro/api";

import {
  normalizeNotes,
  normalizeQuantity,
  normalizeSku,
} from "./inventory-normalizers";

// ── Error Codes (Appendix B — 13 codes) ──────────

export const ERROR_CODES = {
  PRODUCT_NOT_FOUND: "PRODUCT_NOT_FOUND",
  INVALID_QUANTITY: "INVALID_QUANTITY",
  NEGATIVE_RESULT: "NEGATIVE_RESULT",
  PRODUCT_LOCKED: "PRODUCT_LOCKED",
  DUPLICATE_SKU: "DUPLICATE_SKU",
  EMPTY_ROW: "EMPTY_ROW",
  FILE_TOO_LARGE: "FILE_TOO_LARGE",
  TOO_MANY_ROWS: "TOO_MANY_ROWS",
  MISSING_HEADER: "MISSING_HEADER",
  WAREHOUSE_INACTIVE: "WAREHOUSE_INACTIVE",
  DUPLICATE_HEADERS: "DUPLICATE_HEADERS",
  UNKNOWN_COLUMN: "UNKNOWN_COLUMN",
  VALUE_TRUNCATED: "VALUE_TRUNCATED",
  IDEMPOTENCY_CONFLICT: "IDEMPOTENCY_CONFLICT",
} as const;

// ── Product lookup map type ──────────────────────

export interface ProductInfo {
  id: string;
  sku: string;
  name: string;
  quantity: number;
  isLocked: boolean;
}

// ── File-level validator ─────────────────────────

/** Max file size in bytes (10 MB) */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** Max data rows (excluding header) */
export const MAX_ROW_COUNT = 10_000;

/** Accepted file extensions */
export const ACCEPTED_EXTENSIONS = [".xlsx", ".xls", ".csv"] as const;

/** Accepted MIME types */
export const ACCEPTED_MIME_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "application/csv",
] as const;

/** Validate a file before parsing */
export function validateFile(file: File): {
  valid: boolean;
  code?: string;
  message?: string;
} {
  // Empty file (§21.1)
  if (file.size === 0) {
    return { valid: false, code: "EMPTY_FILE", message: "Archivo vacío" };
  }

  // File too large (FR-2)
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      code: ERROR_CODES.FILE_TOO_LARGE,
      message: "Archivo excede 10 MB",
    };
  }

  // File type check
  const ext = "." + (file.name.split(".").pop()?.toLowerCase() ?? "");
  if (
    !ACCEPTED_EXTENSIONS.includes(ext as (typeof ACCEPTED_EXTENSIONS)[number])
  ) {
    return {
      valid: false,
      code: "INVALID_TYPE",
      message: `Tipo de archivo no soportado: ${ext}`,
    };
  }

  return { valid: true };
}

// ── Row-level validation ─────────────────────────

/**
 * Validate all data rows against the product map.
 *
 * Pipeline per PRD §11:
 * 1. Normalize values
 * 2. Resolve SKU against productMap
 * 3. Check quantity validity
 * 4. Check lock status
 * 5. Detect duplicate SKUs
 *
 * @param dataRows - Parsed spreadsheet data (array of arrays, NO header row)
 * @param headerMap - Map of field name → column index
 * @param productMap - Map of UPPERCASE SKU → ProductInfo
 * @param mode - Import mode (replace | adjust)
 */
export function validateRows(
  dataRows: string[][],
  headerMap: Record<string, number>,
  productMap: Map<string, ProductInfo>,
  mode: ImportMode,
): { validatedRows: ValidatedRow[]; stats: ValidationStats } {
  const validatedRows: ValidatedRow[] = [];
  const seenSKUs = new Map<string, number>(); // SKU → index in validatedRows

  let validCount = 0;
  let warningCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    if (!row) continue;
    const rowNumber = i + 2; // 1-indexed, +1 for header row

    // Extract raw values
    const rawSku =
      headerMap.sku !== undefined ? String(row[headerMap.sku] ?? "") : "";
    const rawQty =
      headerMap.quantity !== undefined
        ? String(row[headerMap.quantity] ?? "")
        : "";
    const rawNotes =
      headerMap.notes !== undefined
        ? String(row[headerMap.notes] ?? "")
        : undefined;

    // Normalize
    const sku = normalizeSku(rawSku);
    const qtyResult = normalizeQuantity(rawQty, mode);
    const notes = normalizeNotes(rawNotes);

    // Skip empty rows (§21.12, Appendix B: EMPTY_ROW)
    if (!sku && !rawQty.trim()) {
      skippedCount++;
      continue;
    }

    // Resolve product
    const product = productMap.get(sku);

    // Determine status
    let status: "valid" | "warning" | "error" = "valid";
    let message: string | undefined;

    // 1. SKU not found
    if (!sku) {
      status = "error";
      message = "SKU vacío";
    } else if (!product) {
      status = "error";
      message = `Producto con SKU "${sku}" no encontrado`;
    }
    // 2. Invalid quantity
    else if (!qtyResult.isValid) {
      if (mode === "replace" && qtyResult.value < 0) {
        status = "error";
        message = "Cantidad negativa no permitida en modo Reemplazar";
      } else {
        status = "error";
        message = `Cantidad inválida: "${qtyResult.raw}"`;
      }
    }
    // 3. Negative result (Adjust mode)
    else if (mode === "adjust" && product.quantity + qtyResult.value < 0) {
      status = "error";
      message = `La cantidad resultante sería negativa (${product.quantity + qtyResult.value})`;
    }
    // 4. Locked product
    else if (product.isLocked) {
      status = "warning";
      message = `Producto "${sku}" está bloqueado en este almacén`;
    }
    // 5. Float truncation warning
    else if (qtyResult.warning) {
      status = "warning";
      message = qtyResult.warning;
    }

    // 6. Duplicate SKU detection — keep last, mark previous as warning
    if (sku && seenSKUs.has(sku)) {
      const prevIndex = seenSKUs.get(sku);
      if (prevIndex !== undefined) {
        const prevRow = validatedRows[prevIndex];
        if (prevRow && prevRow.status !== "error") {
          // If it was counted as valid before, adjust
          if (prevRow.status === "valid") {
            validCount--;
          }
          prevRow.status = "warning";
          prevRow.message = "Duplicado — se usa la última fila";
          warningCount++;
        }
      }
    }
    if (sku) {
      seenSKUs.set(sku, validatedRows.length);
    }

    // Track stats
    if (status === "valid") validCount++;
    else if (status === "warning") warningCount++;
    else errorCount++;

    validatedRows.push({
      rowNumber,
      sku,
      quantity: qtyResult.isValid ? qtyResult.value : 0,
      notes,
      productId: product?.id ?? "",
      currentQuantity: product?.quantity ?? 0,
      status,
      message,
      productName: product?.name,
      isLocked: product?.isLocked ?? false,
    });
  }

  return {
    validatedRows,
    stats: {
      total: validatedRows.length,
      valid: validCount,
      warnings: warningCount,
      errors: errorCount,
      skipped: skippedCount,
    },
  };
}

export interface ValidationStats {
  total: number;
  valid: number;
  warnings: number;
  errors: number;
  skipped: number;
}
