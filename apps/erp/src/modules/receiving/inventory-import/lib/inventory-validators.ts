/**
 * Cendaro — Inventory Import Validators (Zero-Template + Semantic SKU Ready)
 *
 * Row-level validation logic for inventory import data across:
 *   • Replace / Adjust modes: supports packaging (`bultos × cajas × unid`) OR direct
 *     unit counts (`quantity` / `stockTotal`), plus semantic SKU overrides resolved
 *     via `aiImport.matchCatalogItems` when a count sheet lacks internal SKUs.
 *   • Initialize mode: supports editable deterministic SKU autogeneration (`AUTO-...`)
 *     and default `"General"` brand fallback when supplier/warehouse files omit them.
 */

import type { ImportMode, ValidatedRow } from "@cendaro/api";
import { suggestDeterministicSku } from "@cendaro/validators";

import {
  normalizeBrandName,
  normalizeBultos,
  normalizeCajasPerBulk,
  normalizePresentacion,
  normalizeProductName,
  normalizeSku,
  normalizeUnidPerCaja,
} from "./inventory-normalizers";

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
  BRAND_EMPTY: "BRAND_EMPTY",
  PRODUCT_NAME_EMPTY: "PRODUCT_NAME_EMPTY",
  SKU_ALREADY_EXISTS: "SKU_ALREADY_EXISTS",
} as const;

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

export interface SemanticInventoryResolution {
  classification: "matched_existing" | "possible_duplicate" | "new_product";
  matchedSku: string | null;
  matchedName: string | null;
  confidence: number;
}

export const MAX_FILE_SIZE = 10 * 1024 * 1024;
export const MAX_PDF_FILE_SIZE = 7 * 1024 * 1024;
export const MAX_ROW_COUNT = 10_000;

export const ACCEPTED_EXTENSIONS = [".xlsx", ".xls", ".csv", ".pdf"] as const;

export const ACCEPTED_MIME_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "application/csv",
  "application/pdf",
] as const;

export function validateFile(file: File): {
  valid: boolean;
  code?: string;
  message?: string;
} {
  if (file.size === 0) {
    return { valid: false, code: "EMPTY_FILE", message: "Archivo vacío" };
  }

  const ext = "." + (file.name.split(".").pop()?.toLowerCase() ?? "");
  if (
    !ACCEPTED_EXTENSIONS.includes(ext as (typeof ACCEPTED_EXTENSIONS)[number])
  ) {
    return {
      valid: false,
      code: "INVALID_TYPE",
      message: `Tipo de archivo no soportado (${file.name}): ${ext}`,
    };
  }

  if (ext === ".pdf" && file.size > MAX_PDF_FILE_SIZE) {
    return {
      valid: false,
      code: ERROR_CODES.FILE_TOO_LARGE,
      message: `El PDF "${file.name}" excede 7 MB`,
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      code: ERROR_CODES.FILE_TOO_LARGE,
      message: `El archivo "${file.name}" excede 10 MB`,
    };
  }

  return { valid: true };
}

export function calculateTotalUnits(
  bultos: number,
  cajasPerBulk: number,
  unitsPerBox: number,
): number {
  if (cajasPerBulk > 0) {
    return bultos * cajasPerBulk * unitsPerBox;
  }
  return bultos * unitsPerBox;
}

function extractDirectQuantityCell(
  row: string[],
  headerMap: Record<string, number>,
): string {
  if (headerMap.quantity !== undefined) {
    return String(row[headerMap.quantity] ?? "").trim();
  }
  if (headerMap.bultos === undefined && headerMap.stockTotal !== undefined) {
    return String(row[headerMap.stockTotal] ?? "").trim();
  }
  return "";
}

/**
 * Validate all data rows against the product map (Replace / Adjust modes).
 */
export function validateRows(
  dataRows: string[][],
  headerMap: Record<string, number>,
  productMap: Map<string, ProductInfo>,
  mode: ImportMode,
  semanticResolutions?: Map<number, SemanticInventoryResolution>,
): { validatedRows: ValidatedRow[]; stats: ValidationStats } {
  const validatedRows: ValidatedRow[] = [];
  const seenSKUs = new Map<string, number>();

  let validCount = 0;
  let warningCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  const hasBultosCol = headerMap.bultos !== undefined;

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    if (!row) continue;
    const rowNumber = i + 2;

    const rawSku =
      headerMap.sku !== undefined ? String(row[headerMap.sku] ?? "") : "";
    const rawProductName =
      headerMap.producto !== undefined
        ? String(row[headerMap.producto] ?? "").trim()
        : "";
    const rawBarcode =
      headerMap.barcode !== undefined
        ? String(row[headerMap.barcode] ?? "").trim()
        : "";
    const rawBultos =
      headerMap.bultos !== undefined ? String(row[headerMap.bultos] ?? "") : "";
    const rawDirectQty = extractDirectQuantityCell(row, headerMap);
    const rawCountInput =
      hasBultosCol && rawBultos.trim() ? rawBultos : rawDirectQty;
    const usingDirectUnits =
      !(hasBultosCol && rawBultos.trim()) && Boolean(rawDirectQty);

    const rawCajas =
      headerMap.cajasPerBulk !== undefined
        ? String(row[headerMap.cajasPerBulk] ?? "")
        : "";
    const rawUnidPerCaja =
      headerMap.unidPerCaja !== undefined
        ? String(row[headerMap.unidPerCaja] ?? "")
        : "";
    const rawPresentacion =
      headerMap.presentacion !== undefined
        ? String(row[headerMap.presentacion] ?? "")
        : "";

    let sku = normalizeSku(rawSku);
    const countResult = normalizeBultos(rawCountInput);
    const cajasResult = normalizeCajasPerBulk(rawCajas);
    const unidResult = normalizeUnidPerCaja(rawUnidPerCaja);
    const presentacionResult = normalizePresentacion(rawPresentacion);

    if (!sku && !rawProductName && !rawBarcode && !rawCountInput.trim()) {
      skippedCount++;
      continue;
    }

    let product = sku ? productMap.get(sku) : undefined;
    let semanticNote: string | undefined;
    const sem = semanticResolutions?.get(i);

    if (
      !product &&
      sem?.classification === "matched_existing" &&
      sem.matchedSku
    ) {
      const resolvedSku = sem.matchedSku.toUpperCase();
      const candidate = productMap.get(resolvedSku);
      if (candidate) {
        sku = candidate.sku.toUpperCase();
        product = candidate;
        semanticNote = `Vinculado por IA semántica (${Math.round(sem.confidence * 100)}%) a SKU ${candidate.sku}`;
      }
    }

    const displayLabel =
      sku || rawProductName || rawBarcode || "(sin identificador)";
    const errorPrefix = product
      ? `Fila ${rowNumber} — ${sku} (${product.name})`
      : `Fila ${rowNumber} — ${displayLabel}`;

    let status: "valid" | "warning" | "error" = "valid";
    let message: string | undefined = semanticNote;

    if (!sku && !product) {
      status = "error";
      message =
        sem?.classification === "possible_duplicate" && sem.matchedSku
          ? `${errorPrefix}: Coincidencia ambigua con SKU "${sem.matchedSku}" (${sem.matchedName ?? ""}) — confirme el SKU en el archivo`
          : `${errorPrefix}: Sin SKU y no se encontró coincidencia exacta en el catálogo`;
    } else if (!product) {
      status = "error";
      message =
        sem?.classification === "possible_duplicate" && sem.matchedSku
          ? `${errorPrefix}: SKU no existe (¿quiso decir "${sem.matchedSku}" — ${sem.matchedName ?? ""}?)`
          : `${errorPrefix}: Producto no encontrado en el catálogo`;
    } else if (!countResult.isValid) {
      status = "error";
      message = `${errorPrefix}: La cantidad/bultos debe ser un entero ≥ 0`;
    } else if (!usingDirectUnits && !presentacionResult.isValid) {
      status = "error";
      message = `${errorPrefix}: Presentación debe ser 1, 3, 6, 12 o 24`;
    } else {
      const cajasPerBulk =
        cajasResult.value > 0 ? cajasResult.value : (product.boxesPerBulk ?? 0);
      const unitsPerBox =
        unidResult.value > 0 ? unidResult.value : (product.unitsPerBox ?? 1);

      const totalUnits = usingDirectUnits
        ? countResult.value
        : calculateTotalUnits(countResult.value, cajasPerBulk, unitsPerBox);

      if (mode === "adjust") {
        const delta = totalUnits - product.quantity;
        if (product.quantity + delta < 0) {
          status = "error";
          message = `${errorPrefix}: Stock resultante negativo (${product.quantity + delta}). Actual: ${product.quantity}`;
        }
      }

      if (status === "valid" && product.isLocked) {
        status = "warning";
        message = `${errorPrefix}: Producto bloqueado en este almacén`;
      }

      if (status === "valid" && countResult.warning) {
        message = `${errorPrefix}: ${countResult.warning}`;
      }

      const quantity =
        mode === "replace" ? totalUnits : totalUnits - product.quantity;

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
      sku: sku || rawBarcode || "SIN-SKU",
      quantity: 0,
      productId: product?.id ?? "",
      currentQuantity: product?.quantity ?? 0,
      status,
      message,
      productName: product?.name ?? (rawProductName || undefined),
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

export interface InitializeValidatedRow {
  rowNumber: number;
  brand: string;
  sku: string;
  skuAutoGenerated?: boolean;
  productName: string;
  bultos: number;
  cajasPerBulk: number | null;
  unidPerCaja: number | null;
  presentacion: number;
  totalUnits: number;
  status: "valid" | "warning" | "error";
  message?: string;
}

/**
 * Validate all data rows for Initialize mode (Zero-Template Ready).
 */
export function validateInitializeRows(
  dataRows: string[][],
  headerMap: Record<string, number>,
  existingSkus?: Set<string>,
): { validatedRows: InitializeValidatedRow[]; stats: ValidationStats } {
  const validatedRows: InitializeValidatedRow[] = [];
  const seenSKUs = new Map<string, number>();

  let validCount = 0;
  let warningCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  const hasBultosCol = headerMap.bultos !== undefined;

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    if (!row) continue;
    const rowNumber = i + 2;

    const rawSku =
      headerMap.sku !== undefined ? String(row[headerMap.sku] ?? "") : "";
    const rawBrand =
      headerMap.marca !== undefined ? String(row[headerMap.marca] ?? "") : "";
    const rawProduct =
      headerMap.producto !== undefined
        ? String(row[headerMap.producto] ?? "")
        : "";
    const rawBultos =
      headerMap.bultos !== undefined ? String(row[headerMap.bultos] ?? "") : "";
    const rawDirectQty = extractDirectQuantityCell(row, headerMap);
    const rawCountInput =
      hasBultosCol && rawBultos.trim() ? rawBultos : rawDirectQty;
    const usingDirectUnits =
      !(hasBultosCol && rawBultos.trim()) && Boolean(rawDirectQty);

    const rawCajas =
      headerMap.cajasPerBulk !== undefined
        ? String(row[headerMap.cajasPerBulk] ?? "")
        : "";
    const rawUnidPerCaja =
      headerMap.unidPerCaja !== undefined
        ? String(row[headerMap.unidPerCaja] ?? "")
        : "";
    const rawPresentacion =
      headerMap.presentacion !== undefined
        ? String(row[headerMap.presentacion] ?? "")
        : "";

    let sku = normalizeSku(rawSku);
    const normalizedBrand = normalizeBrandName(rawBrand);
    const productName = normalizeProductName(rawProduct) || sku;
    const countResult = normalizeBultos(rawCountInput);
    const cajasResult = normalizeCajasPerBulk(rawCajas);
    const unidResult = normalizeUnidPerCaja(rawUnidPerCaja);
    const presentacionResult = normalizePresentacion(rawPresentacion);

    if (!sku && !normalizedBrand && !productName && !rawCountInput.trim()) {
      skippedCount++;
      continue;
    }

    const brandDefaulted = !normalizedBrand;
    const brand = normalizedBrand || "General";

    const skuAutoGenerated = !sku && Boolean(productName);
    if (skuAutoGenerated) {
      sku = suggestDeterministicSku({
        name: productName,
        brand,
        rowNumber,
      });
    }

    const errorPrefix = `Fila ${rowNumber} — ${sku || "(sin SKU)"}`;
    let status: "valid" | "warning" | "error" = "valid";
    const warnings: string[] = [];
    let message: string | undefined;

    if (!productName) {
      status = "error";
      message = `${errorPrefix}: Nombre de producto vacío`;
    } else if (!sku) {
      status = "error";
      message = `${errorPrefix}: SKU vacío`;
    } else if (!countResult.isValid) {
      status = "error";
      message = `${errorPrefix}: La cantidad/bultos debe ser un entero ≥ 0`;
    } else if (!usingDirectUnits && !presentacionResult.isValid) {
      status = "error";
      message = `${errorPrefix}: Presentación debe ser 1, 3, 6, 12 o 24`;
    } else {
      const cajasVal =
        !usingDirectUnits && cajasResult.value > 0 ? cajasResult.value : null;
      const unidVal =
        !usingDirectUnits && unidResult.value > 0 ? unidResult.value : null;
      const effectiveUnitsPer = unidVal ?? 1;

      const totalUnits = usingDirectUnits
        ? countResult.value
        : calculateTotalUnits(
            countResult.value,
            cajasVal ?? 0,
            effectiveUnitsPer,
          );

      if (skuAutoGenerated) {
        warnings.push("SKU sugerido automáticamente");
      }
      if (brandDefaulted) {
        warnings.push("Marca asignada a 'General' (editable)");
      }
      if (existingSkus?.has(sku)) {
        warnings.push("SKU ya existe en catálogo — se actualizará stock");
      }
      if (countResult.warning) {
        warnings.push(countResult.warning);
      }

      if (warnings.length > 0) {
        status = "warning";
        message = `${errorPrefix}: ${warnings.join(" · ")}`;
      }

      if (seenSKUs.has(sku)) {
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
      seenSKUs.set(sku, validatedRows.length);

      if (status === "valid") validCount++;
      else warningCount++;

      validatedRows.push({
        rowNumber,
        brand,
        sku,
        skuAutoGenerated,
        productName,
        bultos: countResult.value,
        cajasPerBulk: cajasVal,
        unidPerCaja: unidVal,
        presentacion: usingDirectUnits ? 1 : presentacionResult.value,
        totalUnits,
        status,
        message,
      });
      continue;
    }

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
      brand,
      sku,
      skuAutoGenerated,
      productName,
      bultos: countResult.value || 0,
      cajasPerBulk: null,
      unidPerCaja: null,
      presentacion: presentacionResult.value || 1,
      totalUnits: 0,
      status,
      message,
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
