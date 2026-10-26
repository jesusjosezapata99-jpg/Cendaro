import { describe, expect, it } from "vitest";

import { logger } from "../logger";
import { appRouter } from "../root";
import { createCallerFactory } from "../trpc";

let wsCounter = 301;
function nextWorkspaceId() {
  wsCounter += 1;
  return `b0000000-0000-4000-8000-${String(wsCounter).padStart(12, "0")}`;
}
const USER_ID = "a0000000-0000-4000-8000-000000000301";
const PRODUCT_ID = "c0000000-0000-4000-8000-000000000301";
const WAREHOUSE_ID = "d0000000-0000-4000-8000-000000000301";
const LEDGER_ID = "e0000000-0000-4000-8000-000000000301";
const COUNT_ID = "f0000000-0000-4000-8000-000000000301";

const createCaller = createCallerFactory(appRouter);

function buildMockContext(opts: {
  selectQueue?: unknown[][];
  executeRows?: Record<string, unknown>[];
  updateReturning?: unknown[];
}) {
  const workspaceId = nextWorkspaceId();
  const selectQueue = [...(opts.selectQueue ?? [])];
  const insertedRows: unknown[] = [];
  const updatedValues: unknown[] = [];
  const executedSqls: string[] = [];

  const nextSelectResult = (shape?: Record<string, unknown>) => {
    if (shape && "plan" in shape) return [{ plan: "enterprise" }];
    if (shape && "fullName" in shape) return [{ fullName: "Owner QA" }];
    if (
      shape &&
      Object.keys(shape).length === 1 &&
      "id" in shape &&
      selectQueue.length === 0
    ) {
      return [{ id: "mod-row" }];
    }
    return selectQueue.shift() ?? [{ id: "mod-row" }];
  };

  const makeSelectChain = (rows: unknown[]) => {
    const chain = {
      from: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: () => {
        const p = Promise.resolve(rows) as Promise<unknown[]> & {
          for: () => Promise<unknown[]>;
        };
        p.for = () => Promise.resolve(rows);
        return p;
      },
      then: (
        onFulfilled?: ((value: unknown[]) => unknown) | null,
        onRejected?: ((reason: unknown) => unknown) | null,
      ) => Promise.resolve(rows).then(onFulfilled, onRejected),
    };
    return chain;
  };

  const tx = {
    execute: (q: { queryChunks?: unknown[] }) => {
      const sqlText = (q.queryChunks ?? [])
        .map((c) => {
          if (!c || typeof c !== "object" || !("value" in c)) return "";
          const val = (c as { value?: unknown }).value;
          return typeof val === "string"
            ? val
            : Array.isArray(val)
              ? val.join("")
              : "";
        })
        .join("");
      executedSqls.push(sqlText);
      return Promise.resolve({ rows: opts.executeRows ?? [] });
    },
    select: (shape?: Record<string, unknown>) =>
      makeSelectChain(nextSelectResult(shape)),
    insert: () => ({
      values: (val: unknown) => {
        insertedRows.push(val);
        const p = Promise.resolve(opts.updateReturning ?? []) as Promise<
          unknown[]
        > & {
          onConflictDoUpdate: () => Promise<unknown[]>;
          returning: () => Promise<unknown[]>;
        };
        p.onConflictDoUpdate = () =>
          Promise.resolve(opts.updateReturning ?? []);
        p.returning = () => Promise.resolve(opts.updateReturning ?? []);
        return p;
      },
    }),
    update: () => ({
      set: (val: unknown) => {
        updatedValues.push(val);
        return {
          where: () => {
            const p = Promise.resolve(
              opts.updateReturning ?? [{ id: COUNT_ID }],
            ) as Promise<unknown[]> & {
              returning: () => Promise<unknown[]>;
            };
            p.returning = () =>
              Promise.resolve(opts.updateReturning ?? [{ id: COUNT_ID }]);
            return p;
          },
        };
      },
    }),
  };

  const db = {
    ...tx,
    execute: () =>
      Promise.resolve({
        rows: [
          {
            member_id: "10000000-0000-4000-8000-000000000001",
            member_role: "owner",
            member_status: "active",
          },
        ],
      }),
    transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  };

  const caller = createCaller({
    user: { id: USER_ID, email: "owner@cendaro.com", aal: "aal2" },
    db: db as never,
    requestId: "req-inv-test",
    membershipCache: new Map(),
    afterCommit: [],
    sessionActivityChecked: true,
    log: logger.child({ requestId: "req-inv-test" }),
    workspaceId,
  });

  return { caller, insertedRows, updatedValues, executedSqls };
}

describe("inventory router invariants (Phase 3)", () => {
  it("stockOverview uses pre-aggregated sl_agg and ca_agg subqueries (no Cartesian JOIN)", async () => {
    const { caller, executedSqls } = buildMockContext({
      selectQueue: [[{ id: "mod-inventory" }]],
      executeRows: [
        {
          id: PRODUCT_ID,
          sku: "SKU-001",
          name: "Producto Test",
          status: "active",
          total_stock: "45",
          locked: false,
          store_stock: "20",
          ml_stock: "15",
          vendor_stock: "10",
        },
      ],
    });

    const rows = await caller.inventory.stockOverview({ limit: 10 });
    expect(rows).toEqual([
      {
        id: PRODUCT_ID,
        sku: "SKU-001",
        name: "Producto Test",
        status: "active",
        totalStock: 45,
        locked: false,
        storeStock: 20,
        mlStock: 15,
        vendorStock: 10,
      },
    ]);
    const overviewSql = executedSqls.find((s) => s.includes("sl_agg")) ?? "";
    expect(overviewSql).toContain("sl_agg");
    expect(overviewSql).toContain("ca_agg");
  });

  it("transferStock rejects identical source and target channels", async () => {
    const { caller } = buildMockContext({
      selectQueue: [[{ id: "mod-inventory" }]],
    });

    await expect(
      caller.inventory.transferStock({
        productId: PRODUCT_ID,
        fromChannel: "store",
        toChannel: "store",
        quantity: 5,
      }),
    ).rejects.toThrow(/diferentes/);
  });

  it("transferStock rejects products with locked stock", async () => {
    const { caller } = buildMockContext({
      selectQueue: [
        [{ id: "mod-inventory" }],
        [{ id: PRODUCT_ID }], // product exists
        [{ id: LEDGER_ID }], // locked row exists
      ],
    });

    await expect(
      caller.inventory.transferStock({
        productId: PRODUCT_ID,
        fromChannel: "store",
        toChannel: "mercadolibre",
        quantity: 5,
      }),
    ).rejects.toThrow(/bloqueado/);
  });

  it("transferStock rejects when source channel has insufficient balance", async () => {
    const { caller } = buildMockContext({
      selectQueue: [
        [{ id: "mod-inventory" }],
        [{ id: PRODUCT_ID }], // product exists
        [], // no locked row
        [{ id: "alloc-1", quantity: 3 }], // source channel has only 3
      ],
    });

    await expect(
      caller.inventory.transferStock({
        productId: PRODUCT_ID,
        fromChannel: "store",
        toChannel: "mercadolibre",
        quantity: 10,
      }),
    ).rejects.toThrow(/Stock insuficiente/);
  });

  it("updateStockQuantity rejects locked stock and records StockMovement when unlocked", async () => {
    const lockedCtx = buildMockContext({
      selectQueue: [
        [{ id: "mod-inventory" }],
        [
          {
            id: LEDGER_ID,
            productId: PRODUCT_ID,
            warehouseId: WAREHOUSE_ID,
            quantity: 10,
            isLocked: true,
          },
        ],
      ],
    });

    await expect(
      lockedCtx.caller.inventory.updateStockQuantity({
        stockLedgerId: LEDGER_ID,
        newQuantity: 25,
      }),
    ).rejects.toThrow(/bloqueado/);

    const unlockedCtx = buildMockContext({
      selectQueue: [
        [{ id: "mod-inventory" }],
        [
          {
            id: LEDGER_ID,
            productId: PRODUCT_ID,
            warehouseId: WAREHOUSE_ID,
            quantity: 10,
            isLocked: false,
          },
        ],
      ],
      updateReturning: [{ id: LEDGER_ID, quantity: 25 }],
    });

    await unlockedCtx.caller.inventory.updateStockQuantity({
      stockLedgerId: LEDGER_ID,
      newQuantity: 25,
    });

    const movementInsert = unlockedCtx.insertedRows.find(
      (r) =>
        typeof r === "object" &&
        r !== null &&
        "movementType" in r &&
        (r as { movementType: string }).movementType === "adjustment_in",
    );
    expect(movementInsert).toMatchObject({
      productId: PRODUCT_ID,
      warehouseId: WAREHOUSE_ID,
      movementType: "adjustment_in",
      quantity: 15,
    });
  });

  it("finalizeCount locks discrepant products and approveCount applies adjustments + unlocks", async () => {
    const finalizeCtx = buildMockContext({
      selectQueue: [
        [{ id: "mod-inventory" }],
        [{ id: COUNT_ID, warehouseId: WAREHOUSE_ID, status: "in_progress" }],
        [
          {
            id: "item-1",
            countId: COUNT_ID,
            productId: PRODUCT_ID,
            systemQty: 10,
            countedQty: 7,
            difference: -3,
          },
        ],
      ],
    });

    const finRes = await finalizeCtx.caller.inventory.finalizeCount({
      countId: COUNT_ID,
    });
    expect(finRes.discrepancies).toBe(1);
    expect(
      finalizeCtx.updatedValues.some(
        (u) =>
          typeof u === "object" &&
          u !== null &&
          "isLocked" in u &&
          (u as { isLocked: boolean }).isLocked === true,
      ),
    ).toBe(true);

    const approveCtx = buildMockContext({
      selectQueue: [
        [{ id: "mod-inventory" }],
        [{ id: COUNT_ID, warehouseId: WAREHOUSE_ID, status: "completed" }],
        [
          {
            id: "item-1",
            countId: COUNT_ID,
            productId: PRODUCT_ID,
            systemQty: 10,
            countedQty: 7,
            difference: -3,
          },
        ],
      ],
    });

    await approveCtx.caller.inventory.approveCount({ id: COUNT_ID });
    const adjMovement = approveCtx.insertedRows.find(
      (r) =>
        typeof r === "object" &&
        r !== null &&
        "movementType" in r &&
        (r as { movementType: string }).movementType === "adjustment_out",
    );
    expect(adjMovement).toMatchObject({
      productId: PRODUCT_ID,
      warehouseId: WAREHOUSE_ID,
      movementType: "adjustment_out",
      quantity: 3,
      referenceType: "inventory_count",
      referenceId: COUNT_ID,
    });
  });
});
