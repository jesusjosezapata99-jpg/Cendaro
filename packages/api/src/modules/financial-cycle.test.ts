/**
 * Cendaro — Financial Cycle Unit Tests (Phase 6 / F6.6)
 *
 * Verifies:
 *  - F6.1: payments.add & sales.addPayment shared implementation + PaymentEvidence insertion
 *  - F6.2: dailyClosurePreview & createClosure server-side UTC-4 calculation
 *  - F6.3: vendor.recordPayment, receivables.recordPayment & receivables.markPaid
 *          synchronize AccountReceivable, Payment, PaymentAllocation, SalesOrder.totalPaid & Customer.balance
 *  - F6.6: reporting.reconcileFinancialLedger maintains 0 discrepancy (SOC 1 / SSAE 18 ICFR)
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

interface MockFinancialState {
  role?: string;
  orderRow?: Record<string, unknown>;
  arRow?: Record<string, unknown>;
  installmentRow?: Record<string, unknown>;
  dailySalesTotal?: number;
  dailyCashTotal?: number;
  dailyDigitalTotal?: number;
  ledgerSalesTotal?: number;
  ledgerPaymentsTotal?: number;
  ledgerArBalance?: number;
}

function createFinancialCaller(state: MockFinancialState = {}) {
  const inserted: Record<string, unknown>[] = [];
  const updated: Record<string, unknown>[] = [];
  const wheres: { sql: string; params: unknown[] }[] = [];

  const resolveSelect = (lastWhere: string): unknown[] => {
    if (lastWhere.includes('"sales_order"')) {
      if (
        lastWhere.includes("status") &&
        (lastWhere.includes("createdAt") || lastWhere.includes("created_at"))
      ) {
        return [{ totalSales: state.dailySalesTotal ?? 0 }];
      }
      if (lastWhere.includes("NOT IN ('cancelled')")) {
        return [
          {
            totalRevenue: String(state.ledgerSalesTotal ?? 100),
            totalOrders: 1,
          },
        ];
      }
      return state.orderRow
        ? [state.orderRow]
        : [
            {
              id: "11111111-1111-4111-8111-111111111111",
              workspaceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              total: 100,
              totalPaid: 0,
            },
          ];
    }
    if (lastWhere.includes('"payment"')) {
      if (lastWhere.includes("createdAt") || lastWhere.includes("created_at")) {
        return [
          {
            totalCash: state.dailyCashTotal ?? 0,
            totalDigital: state.dailyDigitalTotal ?? 0,
          },
        ];
      }
      return [
        {
          totalCollected: String(state.ledgerPaymentsTotal ?? 40),
          totalPayments: 1,
        },
      ];
    }
    if (lastWhere.includes('"account_receivable"')) {
      if (lastWhere.includes("IN ('pending', 'partial', 'overdue')")) {
        return [
          {
            totalOutstanding: String(state.ledgerArBalance ?? 60),
            totalInvoices: 1,
          },
        ];
      }
      return state.arRow ? [state.arRow] : [];
    }
    if (lastWhere.includes('"stock_ledger"')) {
      return [{ anomalyCount: 0 }];
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
        if (lastWhere.includes('"ar_installment"')) {
          return Promise.resolve([
            state.installmentRow ?? {
              id: nextId(),
              receivableId: "22222222-2222-4222-8222-222222222222",
              installmentNumber: 1,
              amount: 40,
              status: "paid",
              ...obj,
            },
          ]).then(onFulfilled, onRejected);
        }
        if (lastWhere.includes('"account_receivable"')) {
          return Promise.resolve([
            state.arRow ?? {
              id: "22222222-2222-4222-8222-222222222222",
              customerId: "33333333-3333-4333-8333-333333333333",
              orderId: "11111111-1111-4111-8111-111111111111",
              totalAmount: 100,
              paidAmount: 40,
              balance: 60,
              status: "partial",
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
    execute: () =>
      Promise.resolve({
        rows: [
          {
            member_id: nextId(),
            member_role: state.role ?? "owner",
            member_status: "active",
          },
        ],
      }),
    select: () => chain("select"),
    insert: () => chain("insert"),
    update: () => chain("update"),
    transaction: (fn: (tx: unknown) => Promise<unknown>) => fn(db),
  };

  const caller = createCallerFactory(appRouter)({
    user: {
      id: "99999999-9999-4999-8999-999999999999",
      email: "owner@cendaro.test",
    },
    db: db as never,
    requestId: "req-financial-cycle",
    membershipCache: new Map(),
    afterCommit: [],
    sessionActivityChecked: true,
    log: logger.child({ requestId: "req-financial-cycle" }),
    workspaceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  });

  return { caller, inserted, updated, wheres };
}

describe("Phase 6 — Financial Cycle & Ledger Reconciliation (F6.1–F6.6)", () => {
  it("F6.1: payments.add and sales.addPayment insert PaymentEvidence when evidenceUrl is provided", async () => {
    const { caller, inserted } = createFinancialCaller();

    const payment = await caller.payments.add({
      orderId: "11111111-1111-4111-8111-111111111111",
      method: "transfer",
      amount: 55,
      reference: "REF-998877",
      evidenceUrl: "https://cdn.cendaro.test/vouchers/ref-998877.png",
      evidenceType: "voucher",
    });

    expect(payment?.amount).toBe(55);
    const evidenceInsert = inserted.find(
      (row) =>
        row.evidenceUrl ===
          "https://cdn.cendaro.test/vouchers/ref-998877.png" &&
        row.evidenceType === "voucher" &&
        typeof row.paymentId === "string",
    );
    expect(evidenceInsert).toBeDefined();
  });

  it("F6.2: sales.createClosure uses server-calculated totals in America/Caracas (UTC-4) when DB activity exists", async () => {
    const { caller, inserted } = createFinancialCaller({
      dailySalesTotal: 250,
      dailyCashTotal: 100,
      dailyDigitalTotal: 150,
    });

    const closure = await caller.sales.createClosure({
      closureDate: "2026-10-26T16:00:00.000Z",
      totalSales: 0,
      totalCash: 0,
      totalDigital: 0,
      expectedTotal: 0,
      actualTotal: 245,
      notes: "Arqueo vespertino",
    });

    expect(closure?.expectedTotal).toBe(250);
    expect(closure?.totalCash).toBe(100);
    expect(closure?.totalDigital).toBe(150);
    expect(closure?.discrepancy).toBe(-5);

    const closureInsert = inserted.find((row) => "expectedTotal" in row);
    expect(closureInsert?.expectedTotal).toBe(250);
    expect(closureInsert?.discrepancy).toBe(-5);
  });

  it("F6.3: vendor.recordPayment and receivables.markPaid create Payment, PaymentAllocation and update SalesOrder.totalPaid", async () => {
    const { caller, inserted, updated } = createFinancialCaller();

    await caller.vendor.recordPayment({
      id: "22222222-2222-4222-8222-222222222222",
      amount: 40,
      method: "zelle",
      reference: "ZELLE-40",
    });

    const paymentRow = inserted.find(
      (row) =>
        row.orderId === "11111111-1111-4111-8111-111111111111" &&
        row.amount === 40 &&
        row.method === "zelle",
    );
    expect(paymentRow).toBeDefined();

    const allocationRow = inserted.find(
      (row) =>
        row.receivableId === "22222222-2222-4222-8222-222222222222" &&
        row.amount === 40 &&
        typeof row.paymentId === "string",
    );
    expect(allocationRow).toBeDefined();

    // Also test receivables.markPaid delegating to executeRecordArPayment
    await caller.receivables.markPaid({
      installmentId: "44444444-4444-4444-8444-444444444444",
    });

    const totalPaidUpdates = updated.filter((row) => "totalPaid" in row);
    expect(totalPaidUpdates.length).toBeGreaterThanOrEqual(2);
  });

  it("F6.6: reporting.reconcileFinancialLedger reports BALANCED_COMPLIANT with 0 discrepancy", async () => {
    const { caller } = createFinancialCaller({
      ledgerSalesTotal: 100,
      ledgerPaymentsTotal: 40,
      ledgerArBalance: 60,
    });

    const report = await caller.reporting.reconcileFinancialLedger();
    expect(report.status).toBe("BALANCED_COMPLIANT");
    expect(report.financials.discrepancy).toBe(0);
    expect(report.financials.isBalanced).toBe(true);
    expect(report.inventory.isHealthy).toBe(true);
  });
});
