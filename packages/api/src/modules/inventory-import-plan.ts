/**
 * Cendaro — Inventory import planning (PLAN-2026-09-SECURITY-REMEDIATION F4.2)
 *
 * Pure decisions behind inventoryImport.commit / initializeCommit, kept free
 * of I/O so every rule is unit-tested (inventory-import-plan.test.ts).
 *
 * The browser sends the stock level it previewed (`currentQuantity`), but that
 * value is never trusted: an adjust used to apply `snapshot + delta`, silently
 * undoing sales recorded after the preview, and a forged snapshot could set
 * any stock level. Plans start from ledger rows the server read under
 * FOR UPDATE, and process rows in file order so repeated SKUs compound.
 */

export interface StockImportRow {
  rowNumber: number;
  sku: string;
  /** Replace: absolute target. Adjust: signed delta. */
  quantity: number;
  productId: string;
  /** Stock level the browser previewed — informational only. */
  currentQuantity: number;
}

/** Ledger row of the target warehouse, as read by the server. */
export interface LedgerSnapshot {
  quantity: number;
  isLocked: boolean;
}

export interface ImportRowError {
  rowNumber: number;
  sku: string;
  code: "PRODUCT_NOT_FOUND" | "NEGATIVE_RESULT";
  message: string;
}

export interface PlannedMovement {
  productId: string;
  sku: string;
  /** Signed, never zero. */
  delta: number;
}

export interface StockAdjustmentPlan {
  /** Final ledger quantity of every product the import sets. */
  finalQuantities: ReadonlyMap<string, number>;
  movements: readonly PlannedMovement[];
  committed: number;
  /** Rows left untouched because their stock is locked. */
  skipped: number;
  failed: number;
  totalDelta: number;
  /** Locked rows applied because an owner/admin forced them. */
  lockedOverridden: number;
  /** Products whose stock changed between the preview and the commit. */
  staleBaseRows: number;
  errors: readonly ImportRowError[];
}

export function planStockAdjustments(input: {
  mode: "replace" | "adjust";
  rows: readonly StockImportRow[];
  /** Products that belong to the workspace. */
  knownProductIds: ReadonlySet<string>;
  /** Ledger rows of the target warehouse by product (absent = no stock). */
  ledger: ReadonlyMap<string, LedgerSnapshot>;
  forceLocked: boolean;
}): StockAdjustmentPlan {
  const running = new Map<string, number>();
  const movements: PlannedMovement[] = [];
  const errors: ImportRowError[] = [];
  let committed = 0;
  let skipped = 0;
  let totalDelta = 0;
  let lockedOverridden = 0;
  let staleBaseRows = 0;

  for (const row of input.rows) {
    if (!input.knownProductIds.has(row.productId)) {
      errors.push({
        rowNumber: row.rowNumber,
        sku: row.sku,
        code: "PRODUCT_NOT_FOUND",
        message: `Producto con SKU "${row.sku}" no encontrado`,
      });
      continue;
    }

    const stored = input.ledger.get(row.productId);
    const isLocked = stored?.isLocked ?? false;
    if (isLocked && !input.forceLocked) {
      skipped += 1;
      continue;
    }

    const previous = running.get(row.productId);
    if (
      previous === undefined &&
      row.currentQuantity !== (stored?.quantity ?? 0)
    ) {
      staleBaseRows += 1;
    }
    const base = previous ?? stored?.quantity ?? 0;
    const next = input.mode === "replace" ? row.quantity : base + row.quantity;

    if (next < 0) {
      errors.push({
        rowNumber: row.rowNumber,
        sku: row.sku,
        code: "NEGATIVE_RESULT",
        message: `La cantidad resultante sería negativa (${next})`,
      });
      continue;
    }

    const delta = next - base;
    running.set(row.productId, next);
    if (delta !== 0) {
      movements.push({ productId: row.productId, sku: row.sku, delta });
    }
    totalDelta += delta;
    committed += 1;
    if (isLocked) lockedOverridden += 1;
  }

  return {
    finalQuantities: running,
    movements,
    committed,
    skipped,
    failed: errors.length,
    totalDelta,
    lockedOverridden,
    staleBaseRows,
    errors,
  };
}

/**
 * Keeps the last occurrence of each SKU (compared case-insensitively), in
 * file order, so a corrected line further down the sheet wins.
 */
export function dedupeInitializeRows<T extends { sku: string }>(
  rows: readonly T[],
): { kept: T[]; skipped: number } {
  const lastIndex = new Map<string, number>();
  rows.forEach((row, index) => lastIndex.set(row.sku.toUpperCase(), index));
  const kept = rows.filter(
    (row, index) => lastIndex.get(row.sku.toUpperCase()) === index,
  );
  return { kept, skipped: rows.length - kept.length };
}

export interface InitializeMovement {
  movementType: "initial_stock" | "adjustment_in" | "adjustment_out";
  quantity: number;
}

/**
 * Movement that explains an initialize import setting the stock to `target`.
 * A product that already had stock in the warehouse records only the
 * difference, so the movement history keeps adding up to the ledger.
 */
export function planInitializeMovement(
  previous: number | undefined,
  target: number,
): InitializeMovement | null {
  if (previous === undefined) {
    return target > 0
      ? { movementType: "initial_stock", quantity: target }
      : null;
  }
  const delta = target - previous;
  if (delta === 0) return null;
  return delta > 0
    ? { movementType: "adjustment_in", quantity: delta }
    : { movementType: "adjustment_out", quantity: -delta };
}
