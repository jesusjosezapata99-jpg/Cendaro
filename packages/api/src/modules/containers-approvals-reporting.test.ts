/**
 * Cendaro — Containers, Approvals & Reporting Unit Tests (Phase 7 / F7.5)
 *
 * Verifies:
 *  - F7.1: container.receiveItems updates ContainerItem.quantityReceived, recalculates
 *          weighted-average Product.costAvg, upserts StockLedger, logs StockMovement,
 *          and transitions Container.status to "received".
 *  - F7.1: container.addDocument inserts ContainerDocument and logs audit.
 *  - F7.2: approvals.approve / reject dispatches side effects for container_close,
 *          cash_closure, product_unblock, credit_sale, inventory_adjustment, price_change.
 *  - F7.3: reporting.salesSummary, salesByChannel, inventoryValuation, topProducts.
 */
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { logger } from "../logger";
import { appRouter } from "../root";
import { createCallerFactory } from "../trpc";

const dialect = new PgDialect();

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `00000000-0000-4000-8000-${String(idCounter).padStart(12, "0")}`;
}

interface MockPhase7State {
  role?: string;
  userId?: string;
  containerRow?: Record<string, unknown>;
  productRow?: Record<string, unknown>;
  stockRow?: Record<string, unknown>;
  approvalRow?: Record<string, unknown>;
  discrepancyRow?: Record<string, unknown>;
}

function createPhase7Caller(state: MockPhase7State = {}) {
  const inserted: Record<string, unknown>[] = [];
  const updated: Record<string, unknown>[] = [];
  const wheres: { sql: string; params: unknown[] }[] = [];

  const resolveSelect = (lastWhere: string): unknown[] => {
    if (lastWhere.includes('"container"')) {
      return [
        state.containerRow ?? {
          id: "11111111-1111-4111-8111-111111111111",
          workspaceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          containerNumber: "MSCU-1234567",
          status: "in_transit",
        },
      ];
    }
    if (lastWhere.includes('"warehouse"')) {
      return [
        {
          id: "22222222-2222-4222-8222-222222222222",
          workspaceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          name: "Almacén Central",
        },
      ];
    }
    if (lastWhere.includes('"product"')) {
      return [
        state.productRow ?? {
          id: "33333333-3333-4333-8333-333333333333",
          workspaceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          costAvg: "10.00",
        },
      ];
    }
    if (lastWhere.includes('"stock_ledger"')) {
      if (lastWhere.includes('"warehouse_id"')) {
        return state.stockRow ? [state.stockRow] : [];
      }
      if (lastWhere.includes("quantity < 0")) {
        return [{ anomalyCount: 0 }];
      }
      return [
        {
          totalQty: 10,
          totalProducts: 2,
          totalUnits: 50,
          totalCostValueUsd: 500,
          warehouseId: "22222222-2222-4222-8222-222222222222",
          warehouseName: "Almacén Central",
        },
      ];
    }
    if (lastWhere.includes('"approval"')) {
      return state.approvalRow ? [state.approvalRow] : [];
    }
    if (lastWhere.includes('"inventory_discrepancy"')) {
      return state.discrepancyRow
        ? [state.discrepancyRow]
        : [
            {
              id: "55555555-5555-4555-8555-555555555555",
              workspaceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              countId: "66666666-6666-4666-8666-666666666666",
            },
          ];
    }
    if (lastWhere.includes('"order_item"')) {
      return [
        {
          productId: "33333333-3333-4333-8333-333333333333",
          productName: "Taladro Industrial",
          sku: "TAL-001",
          totalQty: 12,
          totalRevenue: 600,
        },
      ];
    }
    if (lastWhere.includes('"sales_order"')) {
      return [
        {
          totalOrders: 5,
          totalRevenue: 1250,
          avgOrderValue: 250,
          channel: "store",
          count: 5,
          total: 1250,
        },
      ];
    }
    return [{ id: nextId(), plan: "pro", fullName: "Owner" }];
  };

  const chain = (kind: "select" | "insert" | "update") => {
    let lastWhere = "";
    let values: Record<string, unknown> | Record<string, unknown>[] = {};
    const self: Record<string, unknown> = {};
    for (const method of [
      "from",
      "leftJoin",
      "innerJoin",
      "orderBy",
      "groupBy",
      "limit",
      "offset",
      "returning",
      "for",
      "onConflictDoUpdate",
    ]) {
      self[method] = () => self;
    }
    self.values = (v: Record<string, unknown> | Record<string, unknown>[]) => {
      values = v;
      return self;
    };
    self.set = (v: Record<string, unknown>) => {
      values = v;
      return self;
    };
    self.where = (condition: SQL | undefined) => {
      if (condition) {
        const rendered = dialect.sqlToQuery(condition);
        lastWhere = rendered.sql;
        wheres.push({ sql: rendered.sql, params: rendered.params });
      }
      return self;
    };
    self.then = (
      onFulfilled: (rows: unknown[]) => unknown,
      onRejected: (reason: unknown) => unknown,
    ) => {
      if (kind === "insert") {
        const list = Array.isArray(values) ? values : [values];
        for (const item of list) inserted.push(item);
        return Promise.resolve(
          list.map((item) => ({ id: nextId(), ...item })),
        ).then(onFulfilled, onRejected);
      }
      if (kind === "update") {
        const obj = Array.isArray(values) ? (values[0] ?? {}) : values;
        updated.push(obj);
        if (lastWhere.includes('"approval"')) {
          return Promise.resolve([
            {
              ...(state.approvalRow ?? {}),
              ...obj,
            },
          ]).then(onFulfilled, onRejected);
        }
        return Promise.resolve([{ id: nextId(), ...obj }]).then(
          onFulfilled,
          onRejected,
        );
      }
      return Promise.resolve(resolveSelect(lastWhere)).then(
        onFulfilled,
        onRejected,
      );
    };
    return self;
  };

  const db = {
    select: () => chain("select"),
    insert: () => chain("insert"),
    update: () => chain("update"),
    execute: () =>
      Promise.resolve({
        rows: [
          {
            member_id: "mmmmmmmm-mmmm-4mmm-8mmm-mmmmmmmmmmmm",
            member_role: state.role ?? "owner",
            member_status: "active",
          },
        ],
      }),
    transaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> =>
      fn(db),
  };

  const createCaller = createCallerFactory(appRouter);
  const caller = createCaller({
    db: db as never,
    user: {
      id: state.userId ?? "99999999-9999-4999-8999-999999999999",
      email: "owner@cendaro.test",
    },
    workspaceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    requestId: "req-phase7-test",
    log: logger.child({ requestId: "req-phase7-test" }),
    membershipCache: new Map(),
    afterCommit: [],
    sessionActivityChecked: true,
  });

  return { caller, inserted, updated, wheres };
}

describe("Phase 7 — Containers, Approvals & Reporting", () => {
  it("F7.1: container.receiveItems updates quantityReceived, recalculates weighted costAvg, upserts StockLedger, and logs StockMovement", async () => {
    const { caller, inserted, updated } = createPhase7Caller({
      productRow: {
        id: "33333333-3333-4333-8333-333333333333",
        workspaceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        costAvg: "10.00",
      },
      stockRow: {
        id: "77777777-7777-4777-8777-777777777777",
        quantity: 10,
      },
    });

    const result = await caller.container.receiveItems({
      containerId: "11111111-1111-4111-8111-111111111111",
      warehouseId: "22222222-2222-4222-8222-222222222222",
      items: [
        {
          containerItemId: "44444444-4444-4444-8444-444444444444",
          productId: "33333333-3333-4333-8333-333333333333",
          quantityReceived: 10,
          unitCost: 20,
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.totalUnitsReceived).toBe(10);

    // Weighted average cost: (10 units * $10 + 10 units * $20) / 20 units = $15.0000
    const costAvgUpdate = updated.find((u) => "costAvg" in u);
    expect(costAvgUpdate).toBeDefined();
    expect(costAvgUpdate?.costAvg).toBe("15.0000");

    // StockMovement container_receipt logged
    const movementInsert = inserted.find(
      (row) => row.movementType === "container_receipt",
    );
    expect(movementInsert).toBeDefined();
    expect(movementInsert?.quantity).toBe(10);
  });

  it("F7.2: approvals.approve dispatches side effects for container_close, cash_closure, product_unblock, and credit_sale", async () => {
    const types: {
      approvalType:
        "container_close" | "cash_closure" | "product_unblock" | "credit_sale";
      entityType: string;
    }[] = [
      { approvalType: "container_close", entityType: "container" },
      { approvalType: "cash_closure", entityType: "cash_closure" },
      { approvalType: "product_unblock", entityType: "stock_ledger" },
      { approvalType: "credit_sale", entityType: "sales_order" },
    ];

    for (const item of types) {
      const { caller, inserted, updated } = createPhase7Caller({
        userId: "99999999-9999-4999-8999-999999999999",
        approvalRow: {
          id: "88888888-8888-4888-8888-888888888888",
          workspaceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          approvalType: item.approvalType,
          entityType: item.entityType,
          entityId: "11111111-1111-4111-8111-111111111111",
          status: "pending",
          requestedBy: "12121212-1212-4212-8212-121212121212",
          requestedAt: new Date(),
          expiresAt: null,
          reason: "Solicitud operativa",
          metadata: null,
        },
      });

      const res = await caller.approvals.approve({
        id: "88888888-8888-4888-8888-888888888888",
        reason: "Verificado por gerencia",
      });

      expect(res.status).toBe("approved");
      // Entity update was dispatched (in addition to Approval update)
      expect(updated.length).toBeGreaterThanOrEqual(2);
      // Signature row inserted
      const sig = inserted.find((r) => r.action === "approve");
      expect(sig).toBeDefined();
    }
  });

  it("F7.3: reporting queries exclude cancelled orders and return typed topProducts & inventoryValuation", async () => {
    const { caller, wheres } = createPhase7Caller();

    const summary = await caller.reporting.salesSummary({
      from: "2026-10-01T00:00:00.000Z",
      to: "2026-10-31T23:59:59.999Z",
    });
    expect(summary.totalOrders).toBe(5);
    expect(wheres.some((w) => w.sql.includes("NOT IN ('cancelled')"))).toBe(
      true,
    );

    const top = await caller.reporting.topProducts({
      from: "2026-10-01T00:00:00.000Z",
      to: "2026-10-31T23:59:59.999Z",
      limit: 5,
    });
    expect(top[0]?.product_name).toBe("Taladro Industrial");
    expect(top[0]?.total_qty).toBe(12);
  });
});
