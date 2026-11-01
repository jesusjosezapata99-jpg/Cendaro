/**
 * Foreign keys do not pass through RLS, so a mutation could store another
 * workspace's id if nothing checked it. Each case sends a real id from a second
 * workspace and must be refused without writing anything.
 *
 *   $env:TEST_DATABASE_URL = "postgres://postgres@localhost:54329/flows"
 *   pnpm -F @cendaro/api exec vitest run src/__tests__/integration.workspace-references.test.ts
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Fixture, RealDb } from "./helpers/real-db";
import { openRealDb, seedFixture, TEST_URL } from "./helpers/real-db";

describe.skipIf(!TEST_URL)("ids from another workspace", () => {
  let real: RealDb;
  let mine: Fixture;
  let theirs: Fixture;
  let myProduct: string;
  let theirProduct: string;
  let theirSupplier: string;

  beforeAll(async () => {
    real = openRealDb();
    mine = await seedFixture(real);
    theirs = await seedFixture(real);
    myProduct = await mine.addProduct();
    theirProduct = await theirs.addProduct();
    const supplier = await real.pool.query<{ id: string }>(
      `INSERT INTO supplier (workspace_id, name) VALUES ($1, 'Ajeno') RETURNING id`,
      [theirs.workspaceId],
    );
    theirSupplier = supplier.rows[0]?.id ?? "";
  });

  afterAll(async () => {
    await real.pool.end();
  });

  const line = (productId: string) => ({
    productId,
    quantity: 1,
    unitPrice: 10,
    discount: 0,
  });

  const cases: [string, () => Promise<unknown>][] = [
    [
      "an order for their customer",
      () =>
        mine.as("owner").sales.createOrder({
          customerId: theirs.customerId,
          channel: "store",
          items: [line(myProduct)],
        }),
    ],
    [
      "an order with their product",
      () =>
        mine.as("owner").sales.createOrder({
          channel: "store",
          items: [line(theirProduct)],
        }),
    ],
    [
      "a quote for their customer",
      () =>
        mine.as("owner").quotes.create({
          customerId: theirs.customerId,
          channel: "store",
          items: [line(myProduct)],
        }),
    ],
    [
      "a quote with their product",
      () =>
        mine.as("owner").quotes.create({
          channel: "store",
          items: [line(theirProduct)],
        }),
    ],
    [
      "a price for their product",
      () =>
        mine.as("owner").catalog.setPrice({
          productId: theirProduct,
          priceType: "store",
          amountUsd: 1,
        }),
    ],
    [
      "a product linked to their supplier",
      () =>
        mine.as("owner").catalog.createProduct({
          sku: `SKU-${randomUUID()}`,
          name: "Producto",
          supplierId: theirSupplier,
        }),
    ],
    [
      "a container from their supplier",
      () =>
        mine.as("owner").container.create({
          containerNumber: `MSCU-${randomUUID().slice(0, 8)}`,
          supplierId: theirSupplier,
        }),
    ],
    [
      "a purchase of their product",
      () =>
        mine.as("owner").inventory.receivePurchase({
          warehouseId: mine.showroomId,
          invoiceNumber: `FAC-${randomUUID()}`,
          items: [{ productId: theirProduct, quantity: 1, unitCostUsd: 1 }],
        }),
    ],
    [
      "a purchase into their warehouse",
      () =>
        mine.as("owner").inventory.receivePurchase({
          warehouseId: theirs.showroomId,
          invoiceNumber: `FAC-${randomUUID()}`,
          items: [{ productId: myProduct, quantity: 1, unitCostUsd: 1 }],
        }),
    ],
  ];

  it.each(cases)("refuses %s", async (_name, attempt) => {
    await expect(attempt()).rejects.toMatchObject({
      code: expect.stringMatching(/NOT_FOUND|BAD_REQUEST/) as string,
    });
  });

  it("left the other workspace untouched", async () => {
    const { rows } = await real.pool.query<{ quantity: number }>(
      `SELECT quantity FROM stock_ledger WHERE product_id = $1 ORDER BY quantity DESC`,
      [theirProduct],
    );
    expect(rows.map((row) => row.quantity)).toEqual([100, 0]);
  });
});
