/**
 * Cendaro — Inventory Import Validators
 *
 * Row-level validation logic for inventory import data.
 * Produces ValidatedRow[] with per-row status/message.
 *
 * Packaging calculation:
 * - Scenario A (with inner boxes): total = Bultos × Cajas/Bulto × Unid/Caja
 * - Scenario B (no inner boxes):   total = Bultos × Unid/Caja
 *
 * PRD: FEATURE_PRD_INVENTORY_IMPORT.md §11, Appendix B
 */

import type { ImportMode, ValidatedRow } from "@cendaro/api";

import {
  normalizeBultos,
  normalizeCajasPerBulk,
  normalizePresentacion,
  normalizeSku,
} from "./inventory-normalizers";

// ── Error Codes ──────────────────────────────────

export const ERROR_CODES = {
  PRODUCT_NOT_FOUND: "PRODUCT_NOT_FOUND",
  INVALID_QUANTITY: "INVALID_QUANTITY",
  INVALID_PRESENTATION: "INVALID_PRESENTATION",
  NEGATIVE_RESULT: "NEGATIVE_RESULT",
  PRODUCT_LOCKED: "PRODUCT_LOCKED",
  DUPLICATE_SKU: "DUPLICATE_SKU",
  EMPTY_ROW: "EMPTY_ROW",
  FILE_TOO_LARGE: "FILE_TOO_LARGE",
  TOO_MANY_ROWS: "TOO_MANY_ROWS",
  MISSING_HEADER: "MISSING_HEADER",
  MISSING_PACKAGING: "MISSING_PACKAGING",
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
  brandName: string;
  unitsPerBox: number | null;
  boxesPerBulk: number | null;
  presentationQty: number;
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

// ── Packaging Calculation ────────────────────────

/**
 * Calculate total units from packaging breakdown.
 *
 * Scenario A (with inner boxes): total = bultos × cajasPerBulk × unitsPerBox
 * Scenario B (no inner boxes):   total = bultos × unitsPerBox
 */
export function calculateTotalUnits(
  bultos: number,
  cajasPerBulk: number,
  unitsPerBox: number,
): number {
  if (cajasPerBulk > 0) {
    // Scenario A: with inner boxes
    return bultos * cajasPerBulk * unitsPerBox;
  }
  // Scenario B: no inner boxes, units directly in bulto
  return bultos * unitsPerBox;
}

// ── Row-level validation ─────────────────────────

/**
 * Validate all data rows against the product map.
 *
 * Pipeline:
 * 1. Normalize values (SKU, bultos, cajas/bulto, presentación)
 * 2. Resolve SKU against productMap
 * 3. Calculate total units from packaging
 * 4. Check lock status
 * 5. Detect duplicate SKUs
 * 6. Enhanced error messages with product name + row
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
    const rowNumber = i + 2; // 1-indexed, +1 for header row (accounts for legend rows in template)

    // Extract raw values
    const rawSku =
      headerMap.sku !== undefined ? String(row[headerMap.sku] ?? "") : "";
    const rawBultos =
      headerMap.bultos !== undefined ? String(row[headerMap.bultos] ?? "") : "";
    const rawCajas =
      headerMap.cajasPerBulk !== undefined
        ? String(row[headerMap.cajasPerBulk] ?? "")
        : "";
    const rawPresentacion =
      headerMap.presentacion !== undefined
        ? String(row[headerMap.presentacion] ?? "")
        : "";

    // Normalize
    const sku = normalizeSku(rawSku);
    const bultosResult = normalizeBultos(rawBultos);
    const cajasResult = normalizeCajasPerBulk(rawCajas);
    const presentacionResult = normalizePresentacion(rawPresentacion);

    // Skip empty rows (no SKU and no bultos)
    if (!sku && !rawBultos.trim()) {
      skippedCount++;
      continue;
    }

    // Resolve product
    const product = productMap.get(sku);

    // Build detailed error prefix: "Fila {row} — {sku} ({name})"
    const errorPrefix = product
      ? `Fila ${rowNumber} — ${sku} (${product.name})`
      : `Fila ${rowNumber} — ${sku}`;

    // Determine status
    let status: "valid" | "warning" | "error" = "valid";
    let message: string | undefined;

    // 1. SKU not found
    if (!sku) {
      status = "error";
      message = `${errorPrefix}: SKU vacío`;
    } else if (!product) {
      status = "error";
      message = `${errorPrefix}: Producto no encontrado en el catálogo`;
    }
    // 2. Invalid bultos
    else if (!bultosResult.isValid) {
      status = "error";
      message = `${errorPrefix}: Los bultos deben ser un número entero ≥ 0`;
    }
    // 3. Invalid presentación
    else if (!presentacionResult.isValid) {
      status = "error";
      message = `${errorPrefix}: Presentación debe ser 1, 3, 6, 12 o 24`;
    }
    // 4. Calculate total quantity
    else {
      // Determine packaging config: use spreadsheet value if provided, else product config
      const cajasPerBulk =
        cajasResult.value > 0 ? cajasResult.value : (product.boxesPerBulk ?? 0);
      const unitsPerBox = product.unitsPerBox ?? 1;

      const totalUnits = calculateTotalUnits(
        bultosResult.value,
        cajasPerBulk,
        unitsPerBox,
      );

      // Check negative result in adjust mode
      if (mode === "adjust") {
        const delta = totalUnits - product.quantity;
        if (product.quantity + delta < 0) {
          status = "error";
          message = `${errorPrefix}: Stock resultante negativo (${product.quantity + delta}). Actual: ${product.quantity}`;
        }
      }

      // 5. Locked product
      if (status === "valid" && product.isLocked) {
        status = "warning";
        message = `${errorPrefix}: Producto bloqueado en este almacén`;
      }

      // 6. Truncation warnings
      if (status === "valid" && bultosResult.warning) {
        status = "warning";
        message = `${errorPrefix}: ${bultosResult.warning}`;
      }

      // Build the validated row with calculated quantity
      const quantity =
        mode === "replace" ? totalUnits : totalUnits - product.quantity; // delta for adjust

      // 7. Duplicate SKU detection
      if (sku && seenSKUs.has(sku)) {
        const prevIndex = seenSKUs.get(sku);
        if (prevIndex !== undefined) {
          const prevRow = validatedRows[prevIndex];
          if (prevRow && prevRow.status !== "error") {
            if (prevRow.status === "valid") validCount--;
            prevRow.status = "warning";
            prevRow.message = `${errorPrefix}: Duplicado — se usa la última fila`;
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
        quantity,
        productId: product.id,
        currentQuantity: product.quantity,
        status,
        message,
        productName: product.name,
        isLocked: product.isLocked,
      });
      continue;
    }

    // Fallback for error rows (no product resolved)
    if (sku && seenSKUs.has(sku)) {
      const prevIndex = seenSKUs.get(sku);
      if (prevIndex !== undefined) {
        const prevRow = validatedRows[prevIndex];
        if (prevRow && prevRow.status !== "error") {
          if (prevRow.status === "valid") validCount--;
          prevRow.status = "warning";
          prevRow.message = `${errorPrefix}: Duplicado — se usa la última fila`;
          warningCount++;
        }
      }
    }
    if (sku) {
      seenSKUs.set(sku, validatedRows.length);
    }

    errorCount++;

    validatedRows.push({
      rowNumber,
      sku,
      quantity: 0,
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
