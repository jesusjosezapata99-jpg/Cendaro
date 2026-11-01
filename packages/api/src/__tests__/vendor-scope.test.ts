/**
 * Vendor row scoping (internal plan F2 review, C1).
 *
 * Vendors hold orders.read / customers.read, but must only reach their own
 * orders and quotes (created_by) and the customers assigned to them
 * (assigned_vendor_id) through the sales and quotes routers and global
 * search alike. The fake db renders every WHERE clause to SQL so the tests
 * assert the filter that actually reaches Postgres.
 */
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { salesChannelEnum } from "@cendaro/db/schema";

import { logger } from "../logger";
import { appRouter } from "../root";
import { createCallerFactory } from "../trpc";

const dialect = new PgDialect();

interface RenderedWhere {
  sql: string;
  params: unknown[];
}

let idCounter = 0;

/** Fresh ids keep the process-wide membership, module and rate-limit caches apart. */
function nextId(): string {
  idCounter += 1;
  return `00000000-0000-4000-8000-${String(idCounter).padStart(12, "0")}`;
}

function fakeDb(opts: { role: string; emptyWhen?: RegExp }) {
  const wheres: RenderedWhere[] = [];
  const inserts: unknown[] = [];

  const chain = (): Record<string, unknown> => {
    let lastWhere = "";
    let lastParams: unknown[] = [];
    const self: Record<string, unknown> = {};
    for (const method of [
      "from",
      "leftJoin",
      "innerJoin",
      "orderBy",
      "groupBy",
      "limit",
      "offset",
      "set",
      "values",
      "returning",
      "for",
    ]) {
      self[method] = () => self;
    }
    self.where = (condition: SQL | undefined) => {
      if (condition) {
        const rendered = dialect.sqlToQuery(condition);
        lastWhere = rendered.sql;
        lastParams = rendered.params;
        wheres.push({ sql: rendered.sql, params: rendered.params });
      }
      return self;
    };
    self.then = (
      onFulfilled: (rows: unknown[]) => unknown,
      onRejected: (reason: unknown) => unknown,
    ) => {
      const rows = lastWhere.includes(`"product_price"."productId" in (`)
        ? [{ productId: lastParams[1], priceType: "store", amountUsd: 10 }]
        : lastWhere.includes(`"stock_ledger"."isLocked" = $`) ||
            opts.emptyWhen?.test(lastWhere) === true
          ? []
          : [{ id: nextId(), plan: "pro", fullName: "Caller" }];
      return Promise.resolve(rows).then(onFulfilled, onRejected);
    };
    return self;
  };

  const db = {
    execute: () =>
      Promise.resolve({
        rows: [
          {
            member_id: nextId(),
            member_role: opts.role,
            member_status: "active",
          },
        ],
      }),
    select: () => chain(),
    insert: (table: unknown) => {
      inserts.push(table);
      return chain();
    },
    update: () => chain(),
    transaction: (fn: (tx: unknown) => Promise<unknown>) => fn(db),
  };

  return { db, wheres, inserts };
}

const createCaller = createCallerFactory(appRouter);

function callerFor(role: string, emptyWhen?: RegExp) {
  const userId = nextId();
  const { db, wheres, inserts } = fakeDb({ role, emptyWhen });
  const caller = createCaller({
    user: { id: userId, email: "caller@example.com" },
    db: db as never,
    requestId: "req-vendor-scope",
    membershipCache: new Map(),
    afterCommit: [],
    sessionActivityChecked: true,
    log: logger.child({ requestId: "req-vendor-scope" }),
    workspaceId: nextId(),
  });
  return { caller, userId, wheres, inserts };
}

/** True when some WHERE filters `column` by exactly `userId`. */
function filtersBy(
  wheres: RenderedWhere[],
  column: string,
  userId: string,
): boolean {
  return wheres.some(
    (w) => w.sql.includes(`${column} = $`) && w.params.includes(userId),
  );
}

// PgDialect renders the Drizzle property names; the client maps them to
// snake_case columns at runtime.
const ORDER_OWNER = `"sales_order"."createdBy"`;
const QUOTE_OWNER = `"quote"."createdBy"`;
const CUSTOMER_VENDOR = `"customer"."assignedVendorId"`;
const channel = salesChannelEnum.enumValues[0];

describe("vendor reads are scoped to their own rows", () => {
  const cases: [
    string,
    string,
    (c: ReturnType<typeof callerFor>["caller"]) => Promise<unknown>,
  ][] = [
    ["sales.listOrders", ORDER_OWNER, (c) => c.sales.listOrders({})],
    [
      "sales.orderById",
      ORDER_OWNER,
      (c) => c.sales.orderById({ id: nextId() }),
    ],
    ["sales.listCustomers", CUSTOMER_VENDOR, (c) => c.sales.listCustomers({})],
    [
      "sales.customerById",
      CUSTOMER_VENDOR,
      (c) => c.sales.customerById({ id: nextId() }),
    ],
    [
      "sales.listDeliveryNotes",
      ORDER_OWNER,
      (c) => c.sales.listDeliveryNotes({}),
    ],
    [
      "sales.listInternalInvoices",
      ORDER_OWNER,
      (c) => c.sales.listInternalInvoices({}),
    ],
    ["quotes.list", QUOTE_OWNER, (c) => c.quotes.list({})],
    ["quotes.byId", QUOTE_OWNER, (c) => c.quotes.byId({ id: nextId() })],
    [
      "search.global (orders)",
      ORDER_OWNER,
      (c) => c.search.global({ q: "ab" }),
    ],
    [
      "search.global (quotes)",
      QUOTE_OWNER,
      (c) => c.search.global({ q: "ab" }),
    ],
    [
      "search.global (customers)",
      CUSTOMER_VENDOR,
      (c) => c.search.global({ q: "ab" }),
    ],
  ];

  for (const [name, column, call] of cases) {
    it(`${name} filters by ${column} for a vendor`, async () => {
      const { caller, userId, wheres } = callerFor("vendor");
      await call(caller);
      expect(filtersBy(wheres, column, userId)).toBe(true);
    });

    it(`${name} is not narrowed for a supervisor`, async () => {
      const { caller, wheres } = callerFor("supervisor");
      await call(caller);
      expect(wheres.some((w) => w.sql.includes(`${column} = $`))).toBe(false);
    });
  }
});

describe("fiscal documents are outside the vendor role", () => {
  it("forbids reading them", async () => {
    const { caller } = callerFor("vendor");
    await expect(caller.fiscal.listDocuments({})).rejects.toThrowError(
      expect.objectContaining({ code: "FORBIDDEN" }) as Error,
    );
    await expect(caller.fiscal.salesBookReport({})).rejects.toThrowError(
      expect.objectContaining({ code: "FORBIDDEN" }) as Error,
    );
  });
});

describe("vendor writes are limited to their own customers and quotes", () => {
  const items = [
    { productId: nextId(), quantity: 1, unitPrice: 10, discount: 0 },
  ];

  it("rejects an order for a customer not assigned to the vendor", async () => {
    const { caller, inserts } = callerFor(
      "vendor",
      /"customer"\."assignedVendorId"/,
    );
    await expect(
      caller.sales.createOrder({ customerId: nextId(), channel, items }),
    ).rejects.toThrowError(
      expect.objectContaining({ code: "NOT_FOUND" }) as Error,
    );
    expect(inserts).toEqual([]);
  });

  it("rejects a quote for a customer not assigned to the vendor", async () => {
    const { caller, inserts } = callerFor(
      "vendor",
      /"customer"\."assignedVendorId"/,
    );
    await expect(
      caller.quotes.create({ customerId: nextId(), channel, items }),
    ).rejects.toThrowError(
      expect.objectContaining({ code: "NOT_FOUND" }) as Error,
    );
    expect(inserts).toEqual([]);
  });

  it("rejects a vendor's order or quote without a customer", async () => {
    const { caller, inserts } = callerFor("vendor");
    await expect(
      caller.sales.createOrder({ channel, items }),
    ).rejects.toThrowError(
      expect.objectContaining({ code: "BAD_REQUEST" }) as Error,
    );
    await expect(caller.quotes.create({ channel, items })).rejects.toThrowError(
      expect.objectContaining({ code: "BAD_REQUEST" }) as Error,
    );
    expect(inserts).toEqual([]);
  });

  it("rejects converting another vendor's quote", async () => {
    const { caller, inserts } = callerFor("vendor", /"quote"\."createdBy"/);
    await expect(
      caller.quotes.convertToOrder({ id: nextId() }),
    ).rejects.toThrowError(
      expect.objectContaining({ code: "NOT_FOUND" }) as Error,
    );
    expect(inserts).toEqual([]);
  });

  it("lets a vendor order for an assigned customer", async () => {
    const { caller, userId, wheres, inserts } = callerFor("vendor");
    await caller.sales.createOrder({ customerId: nextId(), channel, items });
    expect(filtersBy(wheres, CUSTOMER_VENDOR, userId)).toBe(true);
    expect(inserts.length).toBeGreaterThan(0);
  });
});
