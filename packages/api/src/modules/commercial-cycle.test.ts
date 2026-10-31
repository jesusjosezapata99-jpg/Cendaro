/**
 * Cendaro — Commercial Cycle Unit Tests (Phase 5 / F5.7)
 *
 * Verifies:
 *  - F5.2: applyStockLifecycle maps whatsapp/instagram to store & updates StockLedger
 *  - F5.3: sales.createOrder validates discount, active status, locked stock, credit limit & AR creation
 *  - F5.4: quotes.convertToOrder idempotency (CONFLICT on converted) & validity (BAD_REQUEST on expired/rejected)
 *  - F5.5: createDeliveryNote & createInternalInvoice populate DeliveryNoteItem & InternalInvoiceItem
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

interface MockOptions {
  role?: string;
  productRows?: Record<string, unknown>[];
  lockedRows?: Record<string, unknown>[];
  customerRow?: Record<string, unknown>;
  quoteRow?: Record<string, unknown>;
  quoteItems?: Record<string, unknown>[];
  orderRow?: Record<string, unknown>;
  orderItems?: Record<string, unknown>[];
  warehouseId?: string;
  auditRow?: Record<string, unknown>;
}

function createMockCaller(opts: MockOptions = {}) {
  const inserted: Record<string, unknown>[] = [];
  const updated: Record<string, unknown>[] = [];
  const wheres: { sql: string; params: unknown[] }[] = [];

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

  const resolveSelect = (where: string): unknown[] => {
    if (where.includes(`"product"."id" in (`)) {
      return opts.productRows ?? [];
    }
    if (where.includes(`"stock_ledger"."isLocked" = $`)) {
      return opts.lockedRows ?? [];
    }
    if (where.includes(`"customer"."id" = $`)) {
      return opts.customerRow ? [opts.customerRow] : [];
    }
    if (where.includes(`"quote"."id" = $`)) {
      return opts.quoteRow ? [opts.quoteRow] : [];
    }
    if (where.includes(`"quote_item"."quoteId" = $`)) {
      return opts.quoteItems ?? [];
    }
    if (where.includes(`"sales_order"."id" = $`)) {
      return opts.orderRow ? [opts.orderRow] : [];
    }
    if (where.includes(`"order_item"."orderId" = $`)) {
      return opts.orderItems ?? [];
    }
    if (where.includes(`"warehouse"."isActive" = $`)) {
      return opts.warehouseId ? [{ id: opts.warehouseId }] : [];
    }
    if (where.includes(`"audit_log"."action" = $`)) {
      return opts.auditRow ? [opts.auditRow] : [];
    }
    return [{ id: nextId(), plan: "pro", fullName: "Tester" }];
  };

  const db = {
    execute: () =>
      Promise.resolve({
        rows: [
          {
            member_id: nextId(),
            member_role: opts.role ?? "supervisor",
            member_status: "active",
          },
        ],
      }),
    select: () => chain("select"),
    insert: () => chain("insert"),
    update: () => chain("update"),
    transaction: (fn: (tx: unknown) => Promise<unknown>) => fn(db),
  };

  const createCaller = createCallerFactory(appRouter);
  const caller = createCaller({
    user: { id: nextId(), email: "supervisor@cendaro.ve" },
    db: db as never,
    requestId: "req-commercial-cycle",
    membershipCache: new Map(),
    afterCommit: [],
    sessionActivityChecked: true,
    log: logger.child({ requestId: "req-commercial-cycle" }),
    workspaceId: nextId(),
  });

  return { caller, inserted, updated, wheres };
}

describe("Phase 5 — Commercial Cycle (F5.2 - F5.5)", () => {
  const productId = "00000000-0000-4000-8000-000000000101";
  const customerId = "00000000-0000-4000-8000-000000000202";

  it("F5.3: sales.createOrder rejects discount greater than unitPrice", async () => {
    const { caller } = createMockCaller();
    await expect(
      caller.sales.createOrder({
        channel: "store",
        items: [{ productId, quantity: 1, unitPrice: 10, discount: 15 }],
      }),
    ).rejects.toThrowError(
      expect.objectContaining({ code: "BAD_REQUEST" }) as Error,
    );
  });

  it("F5.3: sales.createOrder rejects inactive/draft products and locked stock", async () => {
    const draftCaller = createMockCaller({
      productRows: [{ id: productId, status: "draft" }],
    });
    await expect(
      draftCaller.caller.sales.createOrder({
        channel: "store",
        items: [{ productId, quantity: 1, unitPrice: 20, discount: 0 }],
      }),
    ).rejects.toThrowError(
      expect.objectContaining({ code: "BAD_REQUEST" }) as Error,
    );

    const lockedCaller = createMockCaller({
      productRows: [{ id: productId, status: "active" }],
      lockedRows: [{ productId, isLocked: true }],
    });
    await expect(
      lockedCaller.caller.sales.createOrder({
        channel: "store",
        items: [{ productId, quantity: 1, unitPrice: 20, discount: 0 }],
      }),
    ).rejects.toThrowError(
      expect.objectContaining({ code: "CONFLICT" }) as Error,
    );
  });

  it("F5.3: sales.createOrder enforces customer creditLimit and generates AccountReceivable", async () => {
    const overLimit = createMockCaller({
      productRows: [{ id: productId, status: "active" }],
      customerRow: {
        id: customerId,
        creditLimit: 100,
        creditDays: 15,
        balance: 80,
      },
    });
    await expect(
      overLimit.caller.sales.createOrder({
        customerId,
        channel: "vendors",
        items: [{ productId, quantity: 2, unitPrice: 25, discount: 0 }],
      }),
    ).rejects.toThrowError(
      expect.objectContaining({ code: "PRECONDITION_FAILED" }) as Error,
    );

    const withinLimit = createMockCaller({
      productRows: [{ id: productId, status: "active" }],
      customerRow: {
        id: customerId,
        creditLimit: 500,
        creditDays: 15,
        balance: 80,
      },
    });
    await withinLimit.caller.sales.createOrder({
      customerId,
      channel: "vendors",
      items: [{ productId, quantity: 2, unitPrice: 25, discount: 0 }],
    });

    const arInsert = withinLimit.inserted.find(
      (r) => "totalAmount" in r && "dueDate" in r,
    );
    expect(arInsert).toMatchObject({
      customerId,
      totalAmount: 50,
      paidAmount: 0,
      balance: 50,
      status: "pending",
    });
  });

  it("F5.4: quotes.convertToOrder blocks already-converted and expired quotes", async () => {
    const quoteId = nextId();
    const convertedCaller = createMockCaller({
      quoteRow: {
        id: quoteId,
        quoteNumber: "COT-000001",
        status: "converted",
        channel: "store",
        subtotal: 100,
        total: 100,
      },
    });
    await expect(
      convertedCaller.caller.quotes.convertToOrder({ id: quoteId }),
    ).rejects.toThrowError(
      expect.objectContaining({ code: "CONFLICT" }) as Error,
    );

    const expiredCaller = createMockCaller({
      quoteRow: {
        id: quoteId,
        quoteNumber: "COT-000002",
        status: "sent",
        channel: "store",
        subtotal: 100,
        total: 100,
        validUntil: new Date(Date.now() - 86_400_000),
      },
    });
    await expect(
      expiredCaller.caller.quotes.convertToOrder({ id: quoteId }),
    ).rejects.toThrowError(
      expect.objectContaining({ code: "BAD_REQUEST" }) as Error,
    );
  });

  it("F5.2: applyStockLifecycle maps whatsapp channel to store and updates StockLedger", async () => {
    const orderId = nextId();
    const warehouseId = nextId();
    const { caller, inserted, wheres } = createMockCaller({
      orderRow: {
        id: orderId,
        customerId: null,
        channel: "whatsapp",
        status: "dispatched",
        stockDeducted: false,
      },
      orderItems: [
        {
          id: nextId(),
          orderId,
          productId,
          quantity: 3,
          unitPrice: 10,
          discount: 0,
          lineTotal: 30,
        },
      ],
      warehouseId,
    });

    await caller.sales.updateOrderStatus({ id: orderId, status: "delivered" });

    // ChannelAllocation where clause should map whatsapp -> store
    expect(
      wheres.some(
        (w) =>
          w.sql.includes(`"channel_allocation"."channel" = $`) &&
          w.params.includes("store"),
      ),
    ).toBe(true);

    // StockLedger where clause should target primaryWarehouseId
    expect(
      wheres.some(
        (w) =>
          w.sql.includes(`"stock_ledger"."warehouseId" = $`) &&
          w.params.includes(warehouseId),
      ),
    ).toBe(true);

    const movement = inserted.find((r) => "movementType" in r);
    expect(movement).toMatchObject({
      movementType: "sale",
      quantity: -3,
      warehouseId,
      fromChannel: "store",
    });
  });

  it("F5.5: createDeliveryNote and createInternalInvoice insert line items", async () => {
    const orderId = nextId();
    const { caller, inserted } = createMockCaller({
      orderRow: {
        id: orderId,
        orderNumber: "ORD-000010",
        customerId: null,
        channel: "store",
        status: "confirmed",
        subtotal: 60,
        discount: 0,
        total: 60,
      },
      orderItems: [
        {
          id: nextId(),
          orderId,
          productId,
          quantity: 2,
          unitPrice: 30,
          discount: 0,
          lineTotal: 60,
        },
      ],
    });

    await caller.sales.createDeliveryNote({
      orderId,
      recipientName: "Juan Pérez",
    });
    expect(inserted.find((r) => "quantityDispatched" in r)).toMatchObject({
      productId,
      quantityDispatched: 2,
      quantityDelivered: 2,
    });

    await caller.sales.createInternalInvoice({
      orderId,
      tax: 9.6,
    });
    expect(inserted.find((r) => "invoiceId" in r)).toMatchObject({
      productId,
      quantity: 2,
      unitPrice: 30,
      lineTotal: 60,
    });
  });

  it("PROP-01 & PROP-02: sales.checkoutPos replays idempotent sale from AuditLog on duplicate idempotencyKey without re-inserting", async () => {
    const existingOrderId = nextId();
    const idempotencyKey = "11111111-2222-4333-8444-555555555555";
    const { caller, inserted } = createMockCaller({
      auditRow: {
        entityId: existingOrderId,
        newValue: {
          orderNumber: "POS-000777",
          total: 50,
          totalPaid: 50,
          changeUsd: 0,
          fiscalStatus: "not_requested",
          fiscalDocumentId: null,
          fiscalInvoiceNumber: null,
          fiscalControlNumber: null,
          idempotencyKey,
        },
      },
      orderRow: {
        id: existingOrderId,
        orderNumber: "POS-000777",
        channel: "store",
        status: "delivered",
        subtotal: 50,
        discount: 0,
        total: 50,
        totalPaid: 50,
        stockDeducted: true,
      },
    });

    const result = await caller.sales.checkoutPos({
      idempotencyKey,
      items: [{ productId, quantity: 1, unitPrice: 50, discount: 0 }],
      payments: [{ amount: 50, method: "cash", currency: "USD" }],
    });

    expect(result.orderNumber).toBe("POS-000777");
    expect(result.totalPaid).toBe(50);
    // No duplicate order, payment, or stock movement inserted
    expect(inserted.length).toBe(0);
  });

  it("PROP-01: applyStockLifecycle executes set-based batch update for multi-item orders", async () => {
    const orderId = nextId();
    const warehouseId = nextId();
    const productB = "00000000-0000-4000-8000-000000000303";
    const { caller, inserted, wheres } = createMockCaller({
      orderRow: {
        id: orderId,
        customerId: null,
        channel: "store",
        status: "dispatched",
        stockDeducted: false,
      },
      orderItems: [
        {
          id: nextId(),
          orderId,
          productId,
          quantity: 2,
          unitPrice: 10,
          discount: 0,
          lineTotal: 20,
        },
        {
          id: nextId(),
          orderId,
          productId: productB,
          quantity: 5,
          unitPrice: 15,
          discount: 0,
          lineTotal: 75,
        },
      ],
      warehouseId,
    });

    await caller.sales.updateOrderStatus({ id: orderId, status: "delivered" });

    // Multi-item batch update uses IN (...) instead of N individual UPDATE statements
    expect(
      wheres.some(
        (w) =>
          w.sql.includes(`"channel_allocation"."productId" in (`) &&
          w.params.includes(productId) &&
          w.params.includes(productB),
      ),
    ).toBe(true);

    const movements = inserted.filter((r) => r.movementType === "sale");
    expect(movements).toHaveLength(2);
  });
});
