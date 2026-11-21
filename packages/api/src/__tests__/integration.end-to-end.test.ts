/**
 * One business day from quote to price change on a real Postgres, with the money
 * invariants checked and the audit trail growing after every step. The other suites
 * test each rule alone; this one tests that they hold together.
 *
 *   $env:TEST_DATABASE_URL = "postgres://postgres@localhost:54329/flows"
 *   pnpm -F @cendaro/api exec vitest run src/__tests__/integration.end-to-end.test.ts
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Fixture, RealDb } from "./helpers/real-db";
import { openRealDb, seedFixture, TEST_URL } from "./helpers/real-db";

const INVARIANTS = readFileSync(
  path.resolve(
    __dirname,
    "../../../../scripts/checks/prod/financial-invariants.sql",
  ),
  "utf8",
);

describe.skipIf(!TEST_URL)("a full business day", () => {
  let real: RealDb;
  let fx: Fixture;
  let auditRows = 0;

  beforeAll(async () => {
    real = openRealDb();
    fx = await seedFixture(real);
  });

  afterAll(async () => {
    await real.pool.end();
  });

  /** Invariants hold and the step left at least one new, chained audit entry. */
  const checkpoint = async (step: string): Promise<void> => {
    const { rows } = await real.pool.query<{
      invariant: string;
      violations: number;
    }>(INVARIANTS);
    expect(
      rows.filter((row) => Number(row.violations) > 0),
      step,
    ).toEqual([]);

    const audit = await real.pool.query<{ total: number; unchained: number }>(
      `SELECT count(*)::int AS total,
              (count(*) FILTER (WHERE chain_hash IS NULL))::int AS unchained
       FROM audit_log WHERE workspace_id = $1`,
      [fx.workspaceId],
    );
    expect(audit.rows[0]?.unchained, step).toBe(0);
    expect(audit.rows[0]?.total ?? 0, step).toBeGreaterThan(auditRows);
    auditRows = audit.rows[0]?.total ?? 0;
  };

  const ledger = async (productId: string): Promise<number> => {
    const { rows } = await real.pool.query<{ total: number }>(
      `SELECT sum(quantity)::int AS total FROM stock_ledger WHERE product_id = $1`,
      [productId],
    );
    return rows[0]?.total ?? 0;
  };

  it(
    "keeps money, stock and audit consistent",
    { timeout: 120_000 },
    async () => {
      const owner = fx.as("owner");
      const employee = fx.as("employee");
      const productId = await fx.addProduct({
        price: 12.5,
        cost: 5,
        stock: [20, 0],
      });
      const { rows: customers } = await real.pool.query<{ id: string }>(
        `INSERT INTO customer
         (workspace_id, name, identification, address, credit_limit, credit_days)
       VALUES ($1, 'Cliente', $2, 'Av. Urdaneta, Caracas', 1000, 30)
       RETURNING id`,
        [fx.workspaceId, `ID-${randomUUID().slice(0, 24)}`],
      );
      const customerId = customers[0]?.id ?? "";

      // Quote, then a credit order that opens the receivable.
      const quote = await employee.quotes.create({
        customerId,
        channel: "store",
        items: [{ productId, quantity: 4, unitPrice: 12.5, discount: 0 }],
      });
      await checkpoint("quote");
      await owner.quotes.convertToOrder({
        id: quote?.id ?? "",
        paymentTerms: "credit",
      });
      const { rows: converted } = await real.pool.query<{ id: string }>(
        `SELECT converted_order_id AS id FROM quote WHERE id = $1`,
        [quote?.id],
      );
      const orderId = converted[0]?.id ?? "";
      expect(orderId).not.toBe("");
      await checkpoint("credit order");

      // Through to delivery: the stock leaves once.
      for (const status of [
        "confirmed",
        "prepared",
        "dispatched",
        "delivered",
      ] as const) {
        await owner.sales.updateOrderStatus({ id: orderId, status });
      }
      expect(await ledger(productId)).toBe(16);
      await checkpoint("delivery");

      // A partial payment moves the receivable only when it is validated.
      const payment = await employee.payments.add({
        orderId,
        method: "transfer",
        amount: 20,
        reference: "E2E-1",
      });
      const receivable = async () =>
        (
          await real.pool.query<{ balance: number; status: string }>(
            `SELECT balance, status FROM account_receivable WHERE order_id = $1`,
            [orderId],
          )
        ).rows[0];
      expect((await receivable())?.balance).toBe(50);
      await checkpoint("payment recorded");
      await fx.as("supervisor").payments.validate({ id: payment?.id ?? "" });
      expect(await receivable()).toEqual({ balance: 30, status: "partial" });
      await checkpoint("payment validated");

      // A credit note returns a unit and lowers what is owed.
      const note = await employee.creditNotes.create({
        orderId,
        reason: "Devolución de una unidad",
        returnToStock: true,
        warehouseId: fx.showroomId,
        items: [{ productId, quantity: 1 }],
      });
      await owner.creditNotes.approve({ id: note.id });
      expect(await ledger(productId)).toBe(17);
      expect((await receivable())?.balance).toBe(17.5);
      await checkpoint("credit note");

      // A counter sale and the day's cash closure.
      const sale = await employee.sales.checkoutPos({
        items: [{ productId, quantity: 2, unitPrice: 12.5 }],
        payments: [{ method: "cash", amount: 25, currency: "USD" }],
      });
      expect(sale.total).toBe(25);
      expect(await ledger(productId)).toBe(15);
      await checkpoint("point of sale");
      const closure = await owner.payments.createClosure({
        closureDate: new Date().toISOString(),
        actualTotal: 45,
      });
      expect(closure).toBeTruthy();
      await checkpoint("cash closure");

      // A partial container receipt adds exactly what arrived.
      const container = await owner.container.create({
        containerNumber: `MSCU-${randomUUID().slice(0, 8)}`,
      });
      const containerId = container?.id ?? "";
      await owner.container.addItems({
        containerId,
        items: [{ productId, quantityExpected: 10 }],
      });
      const { rows: items } = await real.pool.query<{ id: string }>(
        `SELECT id FROM container_item WHERE container_id = $1`,
        [containerId],
      );
      await owner.container.receiveItems({
        containerId,
        warehouseId: fx.showroomId,
        items: [
          {
            containerItemId: items[0]?.id ?? "",
            productId,
            quantityReceived: 4,
          },
        ],
      });
      expect(await ledger(productId)).toBe(19);
      await checkpoint("container receipt");

      // A price change leaves one history row and does not touch past documents.
      await owner.catalog.setPrice({
        productId,
        priceType: "store",
        amountUsd: 13,
      });
      const { rows: history } = await real.pool.query<{ total: number }>(
        `SELECT count(*)::int AS total FROM price_history WHERE product_id = $1`,
        [productId],
      );
      expect(history[0]?.total).toBe(1);
      const { rows: lines } = await real.pool.query<{ unit_price: number }>(
        `SELECT unit_price FROM order_item WHERE order_id = $1`,
        [orderId],
      );
      expect(lines).toEqual([{ unit_price: 12.5 }]);
      await checkpoint("price change");

      // The chain is one unbroken line across all of it.
      const { rows: chain } = await real.pool.query<{
        prev_hash: string;
        chain_hash: string;
      }>(
        `SELECT prev_hash, chain_hash FROM audit_log
       WHERE workspace_id = $1 ORDER BY seq`,
        [fx.workspaceId],
      );
      expect(chain[0]?.prev_hash).toBe("GENESIS");
      chain.slice(1).forEach((row, index) => {
        expect(row.prev_hash).toBe(chain[index]?.chain_hash);
      });
    },
  );
});
