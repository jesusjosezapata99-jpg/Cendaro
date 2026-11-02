/**
 * Money stored as numeric against a real Postgres: amounts keep their exact cents
 * through a sale, and SQL aggregates still reach the code as numbers.
 *
 *   $env:TEST_DATABASE_URL = "postgres://postgres@localhost:54329/flows"
 *   pnpm -F @cendaro/api exec vitest run src/__tests__/integration.exact-money.test.ts
 */
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Fixture, RealDb } from "./helpers/real-db";
import { openRealDb, seedFixture, TEST_URL } from "./helpers/real-db";

const FLOW_TIMEOUT = 30_000;

describe.skipIf(!TEST_URL)("exact money on a real database", () => {
  let real: RealDb;
  let fx: Fixture;

  beforeAll(async () => {
    real = openRealDb();
    fx = await seedFixture(real);
  });

  afterAll(async () => {
    await real.pool.end();
  });

  it(
    "stores what float arithmetic would get wrong to the exact cent",
    { timeout: FLOW_TIMEOUT },
    async () => {
      const productId = await fx.addProduct({
        price: 0.1,
        cost: 0.05,
        stock: [10, 0],
      });

      const sale = await fx.as("employee").sales.checkoutPos({
        items: [{ productId, quantity: 3, unitPrice: 0.1 }],
        payments: [{ method: "cash", amount: 0.3, currency: "USD" }],
      });

      expect(sale.total).toBe(0.3);
      const { rows } = await real.pool.query(
        `SELECT o.total::text AS total, o.total_paid::text AS paid,
                i.line_total::text AS line, p.amount::text AS payment
         FROM sales_order o
         JOIN order_item i ON i.order_id = o.id
         JOIN payment p ON p.order_id = o.id
         WHERE o.id = $1`,
        [sale.id],
      );
      expect(rows).toEqual([
        { total: "0.30", paid: "0.30", line: "0.30", payment: "0.30" },
      ]);
    },
  );

  it(
    "line totals add up to the order total",
    { timeout: FLOW_TIMEOUT },
    async () => {
      const first = await fx.addProduct({
        price: 19.99,
        cost: 1,
        stock: [50, 0],
      });
      const second = await fx.addProduct({
        price: 0.07,
        cost: 0.01,
        stock: [50, 0],
      });

      const sale = await fx.as("employee").sales.checkoutPos({
        items: [
          { productId: first, quantity: 3, unitPrice: 19.99 },
          { productId: second, quantity: 7, unitPrice: 0.07 },
        ],
        payments: [{ method: "cash", amount: 60.46, currency: "USD" }],
      });

      expect(sale.total).toBe(60.46);
      const { rows } = await real.pool.query<{ lines: number; total: number }>(
        `SELECT sum(i.line_total) AS lines, o.total
         FROM order_item i JOIN sales_order o ON o.id = i.order_id
         WHERE o.id = $1 GROUP BY o.total`,
        [sale.id],
      );
      expect(rows).toEqual([{ lines: 60.46, total: 60.46 }]);
    },
  );

  it("aggregates reach the code as numbers", async () => {
    const result = await real.db.execute<{ total: unknown }>(
      sql`SELECT coalesce(sum(total), 0) AS total FROM sales_order`,
    );

    expect(typeof result.rows[0]?.total).toBe("number");
  });
});
