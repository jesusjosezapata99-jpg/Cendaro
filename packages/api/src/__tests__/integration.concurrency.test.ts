/**
 * Many sales and payments at once against a real Postgres: nothing is oversold,
 * nothing is overpaid, the audit chain does not fork and no deadlock surfaces.
 *
 *   $env:TEST_DATABASE_URL = "postgres://postgres@localhost:54329/flows"
 *   pnpm -F @cendaro/api exec vitest run src/__tests__/integration.concurrency.test.ts
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Fixture, RealDb } from "./helpers/real-db";
import { openRealDb, seedFixture, TEST_URL } from "./helpers/real-db";

const LOAD_TIMEOUT = 120_000;
const SIMULTANEOUS_SALES = 50;
const RACING_PAYMENTS = 20;

const rejectionCodes = (results: PromiseSettledResult<unknown>[]): string[] =>
  results.flatMap((result) =>
    result.status === "rejected"
      ? [(result.reason as { code?: string }).code ?? "UNKNOWN"]
      : [],
  );

describe.skipIf(!TEST_URL)("concurrency on a real database", () => {
  let real: RealDb;
  let fx: Fixture;

  beforeAll(async () => {
    real = openRealDb();
    fx = await seedFixture(real);
  });

  afterAll(async () => {
    await real.pool.end();
  });

  const sale = (productId: string) => ({
    items: [{ productId, quantity: 1, unitPrice: 10 }],
    payments: [
      { method: "cash" as const, amount: 10, currency: "USD" as const },
    ],
  });

  it(
    "sells limited stock exactly once under 50 simultaneous sales",
    { timeout: LOAD_TIMEOUT },
    async () => {
      const productId = await fx.addProduct({ stock: [20, 10] });

      const results = await Promise.allSettled(
        Array.from({ length: SIMULTANEOUS_SALES }, () =>
          fx.as("employee").sales.checkoutPos(sale(productId)),
        ),
      );

      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(30);
      expect(new Set(rejectionCodes(results))).toEqual(new Set(["CONFLICT"]));
      const { rows } = await real.pool.query<{ total: number; lowest: number }>(
        `SELECT sum(quantity)::int AS total, min(quantity)::int AS lowest
         FROM stock_ledger WHERE product_id = $1`,
        [productId],
      );
      expect(rows[0]).toEqual({ total: 0, lowest: 0 });
    },
  );

  it(
    "completes 50 simultaneous sales of different products",
    { timeout: LOAD_TIMEOUT },
    async () => {
      const productIds = await Promise.all(
        Array.from({ length: SIMULTANEOUS_SALES }, () =>
          fx.addProduct({ stock: [5, 0] }),
        ),
      );

      const results = await Promise.allSettled(
        productIds.map((productId) =>
          fx.as("employee").sales.checkoutPos(sale(productId)),
        ),
      );

      expect(rejectionCodes(results)).toEqual([]);
      const { rows } = await real.pool.query<{ numbers: number }>(
        `SELECT count(DISTINCT order_number)::int AS numbers FROM sales_order
         WHERE id = ANY($1::uuid[])`,
        [
          results.flatMap((r) =>
            r.status === "fulfilled" ? [r.value.id] : [],
          ),
        ],
      );
      expect(rows[0]?.numbers).toBe(SIMULTANEOUS_SALES);
    },
  );

  it(
    "never overpays a receivable under 20 racing payments",
    { timeout: LOAD_TIMEOUT },
    async () => {
      const { rows: created } = await real.pool.query<{ id: string }>(
        `INSERT INTO customer
           (workspace_id, name, identification, address, credit_limit, credit_days)
         VALUES ($1, 'Cliente', $2, 'Av. Urdaneta, Caracas', 1000, 30)
         RETURNING id`,
        [fx.workspaceId, `ID-${randomUUID().slice(0, 24)}`],
      );
      const customerId = created[0]?.id ?? "";
      const productId = await fx.addProduct({ stock: [20, 0] });
      const order = await fx.as("employee").sales.createOrder({
        customerId,
        channel: "store",
        paymentTerms: "credit",
        items: [{ productId, quantity: 10, unitPrice: 10, discount: 0 }],
      });

      const results = await Promise.allSettled(
        Array.from({ length: RACING_PAYMENTS }, (_, index) =>
          fx.as("owner").payments.add({
            orderId: order.id,
            method: "transfer",
            amount: 10,
            reference: `LOAD-${index}`,
          }),
        ),
      );

      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(10);
      expect(new Set(rejectionCodes(results))).toEqual(
        new Set(["BAD_REQUEST"]),
      );
      const { rows: receivable } = await real.pool.query(
        `SELECT balance, paid_amount, status FROM account_receivable
         WHERE order_id = $1`,
        [order.id],
      );
      expect(receivable).toEqual([
        { balance: 0, paid_amount: 100, status: "paid" },
      ]);
      const { rows: customer } = await real.pool.query(
        `SELECT balance FROM customer WHERE id = $1`,
        [customerId],
      );
      expect(customer).toEqual([{ balance: 0 }]);
    },
  );

  it(
    "keeps one unbroken audit chain after all of it",
    { timeout: LOAD_TIMEOUT },
    async () => {
      const { rows } = await real.pool.query<{
        seq: string;
        prev_hash: string;
        chain_hash: string;
      }>(
        `SELECT seq, prev_hash, chain_hash FROM audit_log
         WHERE workspace_id = $1 ORDER BY seq`,
        [fx.workspaceId],
      );

      expect(rows.length).toBeGreaterThan(SIMULTANEOUS_SALES);
      expect(new Set(rows.map((row) => row.seq)).size).toBe(rows.length);
      expect(new Set(rows.map((row) => row.chain_hash)).size).toBe(rows.length);
      expect(rows[0]?.prev_hash).toBe("GENESIS");
      rows.slice(1).forEach((row, index) => {
        expect(row.prev_hash).toBe(rows[index]?.chain_hash);
      });
    },
  );
});
