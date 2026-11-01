/**
 * Costs and margins are confidential: only roles with pricing.read see them.
 * Calls every read procedure as each of the other roles against a real database
 * that holds costs, and fails on any cost field with a value in the response.
 *
 *   $env:TEST_DATABASE_URL = "postgres://postgres@localhost:54329/flows"
 *   pnpm -F @cendaro/api exec vitest run src/__tests__/integration.field-exposure.test.ts
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Fixture, RealDb, TestRole } from "./helpers/real-db";
import { appRouter } from "../root";
import { openRealDb, seedFixture, TEST_URL } from "./helpers/real-db";
import { sampleInput } from "./helpers/sample-input";

const CONFIDENTIAL =
  /^(costAvg|costLast|cost|unitCost|costFob|costCif|grossProfit|grossMargin|margin|marginPct|totalCostValueUsd|inventoryValue)$/i;

const ROLES: readonly TestRole[] = ["vendor", "marketing", "employee"];

type AnyCaller = Record<string, unknown>;

/** Dotted paths of the confidential fields that carry a value. */
function findConfidential(value: unknown, trail = ""): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => findConfidential(item, `${trail}[]`));
  }
  if (typeof value !== "object" || value === null || value instanceof Date) {
    return [];
  }
  return Object.entries(value).flatMap(([key, field]) => {
    const here = trail ? `${trail}.${key}` : key;
    const leaks =
      CONFIDENTIAL.test(key) && field !== null && field !== undefined;
    return [...(leaks ? [here] : []), ...findConfidential(field, here)];
  });
}

function callProcedure(
  caller: AnyCaller,
  path: string,
  input: unknown,
): Promise<unknown> {
  const fn = path
    .split(".")
    .reduce<unknown>((node, key) => (node as AnyCaller)[key], caller);
  return (fn as (input: unknown) => Promise<unknown>)(input);
}

describe.skipIf(!TEST_URL)("confidential fields by role", () => {
  let real: RealDb;
  let fx: Fixture;
  let productId: string;

  const productAs = (role: TestRole): Promise<unknown> =>
    fx.as(role).catalog.productById({ id: productId });

  beforeAll(async () => {
    real = openRealDb();
    fx = await seedFixture(real);
    productId = await fx.addProduct({ price: 10, cost: 5 });

    const supplier = await real.pool.query<{ id: string }>(
      `INSERT INTO supplier (workspace_id, name) VALUES ($1, 'Proveedor') RETURNING id`,
      [fx.workspaceId],
    );
    await real.pool.query(
      `INSERT INTO product_supplier (workspace_id, product_id, supplier_id, cost)
       VALUES ($1, $2, $3, 4)`,
      [fx.workspaceId, productId, supplier.rows[0]?.id],
    );
    await real.pool.query(
      `INSERT INTO container (workspace_id, container_number, cost_fob)
       VALUES ($1, $2, 1500)`,
      [fx.workspaceId, `MSCU-${randomUUID().slice(0, 8)}`],
    );
    await fx.as("owner").sales.checkoutPos({
      items: [{ productId, quantity: 1, unitPrice: 10 }],
      payments: [{ method: "cash", amount: 10, currency: "USD" }],
    });
  });

  afterAll(async () => {
    await real.pool.end();
  });

  const procedures = Object.entries(
    appRouter._def.procedures as unknown as Record<
      string,
      { _def: { type: string; inputs?: unknown[] } }
    >,
  ).filter(([, procedure]) => procedure._def.type === "query");

  it.each(ROLES)(
    "%s receives no cost or margin from any read procedure",
    { timeout: 120_000 },
    async (role) => {
      const caller = fx.as(role) as unknown as AnyCaller;
      const leaks: string[] = [];
      let answered = 0;

      for (const [path, procedure] of procedures) {
        const result = await callProcedure(
          caller,
          path,
          sampleInput(procedure),
        ).catch(() => null);
        if (result !== null) answered += 1;
        leaks.push(...findConfidential(result).map((f) => `${path}: ${f}`));
      }

      const product = await productAs(role);
      leaks.push(
        ...findConfidential(product).map((f) => `catalog.productById: ${f}`),
      );

      expect(answered).toBeGreaterThan(5);
      expect(leaks, leaks.join(" | ")).toEqual([]);
    },
  );

  it("still shows costs to a role with pricing.read", async () => {
    expect(findConfidential(await productAs("owner"))).toContain("costAvg");
  });
});
