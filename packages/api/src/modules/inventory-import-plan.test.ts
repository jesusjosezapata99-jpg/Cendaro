/**
 * Inventory import planning (PLAN-2026-09-SECURITY-REMEDIATION F4.2, H4).
 *
 * The server used to apply `browser snapshot + delta`: sales recorded after
 * the preview were silently undone and a forged `currentQuantity` set any
 * stock level. Plans are now computed only from ledger rows read on the
 * server, in import order, so repeated SKUs compound instead of overwriting.
 */
import { describe, expect, it } from "vitest";

import type { LedgerSnapshot, StockImportRow } from "./inventory-import-plan";
import {
  dedupeInitializeRows,
  planInitializeMovement,
  planStockAdjustments,
} from "./inventory-import-plan";

const P1 = "00000000-0000-4000-8000-000000000001";
const P2 = "00000000-0000-4000-8000-000000000002";
const UNKNOWN = "00000000-0000-4000-8000-0000000000ff";

function row(overrides: Partial<StockImportRow> = {}): StockImportRow {
  return {
    rowNumber: 2,
    sku: "SKU-1",
    quantity: 5,
    productId: P1,
    currentQuantity: 10,
    ...overrides,
  };
}

function ledgerOf(
  entries: [string, LedgerSnapshot][],
): Map<string, LedgerSnapshot> {
  return new Map(entries);
}

const KNOWN = new Set([P1, P2]);

describe("planStockAdjustments", () => {
  it("adds an adjust delta to the server stock, not the browser snapshot", () => {
    // Preview saw 10 units; a sale left 7 before the commit.
    const plan = planStockAdjustments({
      mode: "adjust",
      rows: [row({ quantity: 5, currentQuantity: 10 })],
      knownProductIds: KNOWN,
      ledger: ledgerOf([[P1, { quantity: 7, isLocked: false }]]),
      forceLocked: false,
    });

    expect(plan.finalQuantities.get(P1)).toBe(12);
    expect(plan.movements).toEqual([{ productId: P1, sku: "SKU-1", delta: 5 }]);
    expect(plan.totalDelta).toBe(5);
    expect(plan.staleBaseRows).toBe(1);
  });

  it("records the real delta of a replace against the server stock", () => {
    const plan = planStockAdjustments({
      mode: "replace",
      // A forged snapshot of 0 must not inflate the recorded movement.
      rows: [row({ quantity: 20, currentQuantity: 0 })],
      knownProductIds: KNOWN,
      ledger: ledgerOf([[P1, { quantity: 15, isLocked: false }]]),
      forceLocked: false,
    });

    expect(plan.finalQuantities.get(P1)).toBe(20);
    expect(plan.movements).toEqual([{ productId: P1, sku: "SKU-1", delta: 5 }]);
    expect(plan.totalDelta).toBe(5);
  });

  it("treats a product without a ledger row as zero stock", () => {
    const plan = planStockAdjustments({
      mode: "adjust",
      rows: [row({ quantity: 4, currentQuantity: 0 })],
      knownProductIds: KNOWN,
      ledger: new Map(),
      forceLocked: false,
    });

    expect(plan.finalQuantities.get(P1)).toBe(4);
    expect(plan.staleBaseRows).toBe(0);
  });

  it("compounds repeated SKUs in file order", () => {
    const plan = planStockAdjustments({
      mode: "adjust",
      rows: [
        row({ rowNumber: 2, quantity: 3 }),
        row({ rowNumber: 3, quantity: -1 }),
      ],
      knownProductIds: KNOWN,
      ledger: ledgerOf([[P1, { quantity: 10, isLocked: false }]]),
      forceLocked: false,
    });

    expect(plan.finalQuantities.get(P1)).toBe(12);
    expect(plan.movements.map((m) => m.delta)).toEqual([3, -1]);
    expect(plan.committed).toBe(2);
    // Only the first row of a product is compared with the snapshot.
    expect(plan.staleBaseRows).toBe(0);
  });

  it("rejects a row whose result would be negative and keeps the stock", () => {
    const plan = planStockAdjustments({
      mode: "adjust",
      rows: [row({ quantity: -8 })],
      knownProductIds: KNOWN,
      ledger: ledgerOf([[P1, { quantity: 5, isLocked: false }]]),
      forceLocked: false,
    });

    expect(plan.finalQuantities.has(P1)).toBe(false);
    expect(plan.movements).toEqual([]);
    expect(plan.failed).toBe(1);
    expect(plan.errors).toEqual([
      {
        rowNumber: 2,
        sku: "SKU-1",
        code: "NEGATIVE_RESULT",
        message: "La cantidad resultante sería negativa (-3)",
      },
    ]);
  });

  it("reports products outside the workspace", () => {
    const plan = planStockAdjustments({
      mode: "replace",
      rows: [row({ productId: UNKNOWN, sku: "GHOST" })],
      knownProductIds: KNOWN,
      ledger: new Map(),
      forceLocked: false,
    });

    expect(plan.finalQuantities.size).toBe(0);
    expect(plan.errors[0]).toMatchObject({
      sku: "GHOST",
      code: "PRODUCT_NOT_FOUND",
    });
    expect(plan.failed).toBe(1);
  });

  it("skips locked stock unless the override was granted", () => {
    const input = {
      mode: "replace" as const,
      rows: [row({ quantity: 1 })],
      knownProductIds: KNOWN,
      ledger: ledgerOf([[P1, { quantity: 9, isLocked: true }]]),
    };

    const skipped = planStockAdjustments({ ...input, forceLocked: false });
    expect(skipped.skipped).toBe(1);
    expect(skipped.finalQuantities.size).toBe(0);
    expect(skipped.lockedOverridden).toBe(0);

    const forced = planStockAdjustments({ ...input, forceLocked: true });
    expect(forced.finalQuantities.get(P1)).toBe(1);
    expect(forced.lockedOverridden).toBe(1);
    expect(forced.movements).toEqual([
      { productId: P1, sku: "SKU-1", delta: -8 },
    ]);
  });

  it("confirms an unchanged replace without recording a movement", () => {
    const plan = planStockAdjustments({
      mode: "replace",
      rows: [row({ quantity: 6, currentQuantity: 6 })],
      knownProductIds: KNOWN,
      ledger: ledgerOf([[P1, { quantity: 6, isLocked: false }]]),
      forceLocked: false,
    });

    expect(plan.finalQuantities.get(P1)).toBe(6);
    expect(plan.movements).toEqual([]);
    expect(plan.committed).toBe(1);
  });

  it("never mutates its inputs", () => {
    const ledger = ledgerOf([[P1, { quantity: 5, isLocked: false }]]);
    const rows = [row({ quantity: 2 })];
    planStockAdjustments({
      mode: "adjust",
      rows,
      knownProductIds: KNOWN,
      ledger,
      forceLocked: false,
    });

    expect(ledger.get(P1)).toEqual({ quantity: 5, isLocked: false });
    expect(rows[0]?.quantity).toBe(2);
  });
});

describe("dedupeInitializeRows", () => {
  it("keeps the last occurrence of each SKU, ignoring case, in file order", () => {
    const rows = [
      { sku: "abc-1", rowNumber: 2 },
      { sku: "XYZ", rowNumber: 3 },
      { sku: "ABC-1", rowNumber: 4 },
    ];

    const { kept, skipped } = dedupeInitializeRows(rows);

    expect(kept.map((r) => r.rowNumber)).toEqual([3, 4]);
    expect(skipped).toBe(1);
  });
});

describe("planInitializeMovement", () => {
  it("records initial stock for a product that had no ledger row", () => {
    expect(planInitializeMovement(undefined, 12)).toEqual({
      movementType: "initial_stock",
      quantity: 12,
    });
  });

  it("records only the difference when the warehouse already had stock", () => {
    expect(planInitializeMovement(10, 25)).toEqual({
      movementType: "adjustment_in",
      quantity: 15,
    });
    expect(planInitializeMovement(10, 4)).toEqual({
      movementType: "adjustment_out",
      quantity: 6,
    });
  });

  it("records nothing when the quantity does not change", () => {
    expect(planInitializeMovement(7, 7)).toBeNull();
    expect(planInitializeMovement(undefined, 0)).toBeNull();
  });
});
