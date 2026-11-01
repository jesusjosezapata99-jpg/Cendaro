/**
 * Sales, payments, credit notes and the audit chain against a real Postgres.
 *
 * Mocks cannot see what these flows depend on: row locks, triggers that keep
 * balances, CHECK constraints and RLS. They run on a disposable local database
 * built by scripts/db/apply-migrations.mjs:
 *
 *   $env:TEST_DATABASE_URL = "postgres://postgres@localhost:54329/flows"
 *   pnpm -F @cendaro/api exec vitest run src/__tests__/integration.commercial-flows.test.ts
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { QueryResultRow } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { Fixture, RealDb } from "./helpers/real-db";
import { openRealDb, seedFixture, TEST_URL } from "./helpers/real-db";

const FLOW_TIMEOUT = 30_000;

describe.skipIf(!TEST_URL)("commercial flows on a real database", () => {
  let real: RealDb;
  let fx: Fixture;

  beforeAll(async () => {
    real = openRealDb();
    fx = await seedFixture(real);
  });

  afterAll(async () => {
    await real.pool.end();
  });

  const one = async <T extends QueryResultRow>(
    text: string,
    params: unknown[],
  ): Promise<T> => {
    const { rows } = await real.pool.query<T>(text, params);
    const row = rows[0];
    if (!row) throw new Error(`No row for: ${text}`);
    return row;
  };

  const ledger = async (productId: string): Promise<[number, number]> => {
    const row = await one<{ showroom: number; back: number }>(
      `SELECT
         sum(quantity) FILTER (WHERE warehouse_id = $2)::int AS showroom,
         sum(quantity) FILTER (WHERE warehouse_id = $3)::int AS back
       FROM stock_ledger WHERE product_id = $1`,
      [productId, fx.showroomId, fx.warehouseId],
    );
    return [row.showroom, row.back];
  };

  const receivable = (orderId: string) =>
    one<{
      id: string;
      balance: number;
      paid_amount: number;
      status: string;
    }>(
      `SELECT id, balance, paid_amount, status
       FROM account_receivable WHERE order_id = $1`,
      [orderId],
    );

  const customerBalance = async (customerId: string): Promise<number> => {
    const row = await one<{ balance: number }>(
      `SELECT balance FROM customer WHERE id = $1`,
      [customerId],
    );
    return row.balance;
  };

  /** A customer of its own, because customer.balance adds up every test. */
  const newCustomer = async (creditLimit = 1000): Promise<string> => {
    const row = await one<{ id: string }>(
      `INSERT INTO customer
         (workspace_id, name, identification, address, credit_limit, credit_days)
       VALUES ($1, 'Cliente', $2, 'Av. Urdaneta, Caracas', $3, 30)
       RETURNING id`,
      [fx.workspaceId, `ID-${randomUUID().slice(0, 24)}`, creditLimit],
    );
    return row.id;
  };

  const posSale = (productId: string, quantity: number, unitPrice = 10) => ({
    items: [{ productId, quantity, unitPrice }],
    payments: [
      {
        method: "cash" as const,
        amount: quantity * unitPrice,
        currency: "USD" as const,
      },
    ],
  });

  const creditOrder = async (customerId: string, productId: string) =>
    fx.as("employee").sales.createOrder({
      customerId,
      channel: "store",
      paymentTerms: "credit",
      items: [{ productId, quantity: 2, unitPrice: 10, discount: 0 }],
    });

  describe("POS", () => {
    it(
      "takes stock across warehouses by priority and records each movement",
      { timeout: FLOW_TIMEOUT },
      async () => {
        const productId = await fx.addProduct({ stock: [10, 5] });

        const sale = await fx
          .as("employee")
          .sales.checkoutPos(posSale(productId, 12));

        expect(sale.orderNumber).not.toBe("");
        expect(await ledger(productId)).toEqual([0, 3]);
        const { rows } = await real.pool.query<{
          warehouse_id: string;
          quantity: number;
        }>(
          `SELECT warehouse_id, quantity FROM stock_movement
           WHERE reference_id = $1 AND movement_type = 'sale'
           ORDER BY quantity`,
          [sale.id],
        );
        expect(rows).toEqual([
          { warehouse_id: fx.showroomId, quantity: -10 },
          { warehouse_id: fx.warehouseId, quantity: -2 },
        ]);
      },
    );

    it(
      "writes nothing when the stock does not cover the sale",
      { timeout: FLOW_TIMEOUT },
      async () => {
        const productId = await fx.addProduct({ stock: [2, 1] });

        await expect(
          fx.as("employee").sales.checkoutPos(posSale(productId, 4)),
        ).rejects.toMatchObject({ code: "CONFLICT" });

        expect(await ledger(productId)).toEqual([2, 1]);
        const movements = await one<{ total: number }>(
          `SELECT count(*)::int AS total FROM stock_movement WHERE product_id = $1`,
          [productId],
        );
        expect(movements.total).toBe(0);
      },
    );

    it(
      "sells the last units once when two sales race for them",
      { timeout: FLOW_TIMEOUT },
      async () => {
        const productId = await fx.addProduct({ stock: [5, 0] });

        const results = await Promise.allSettled([
          fx.as("employee").sales.checkoutPos(posSale(productId, 4)),
          fx.as("supervisor").sales.checkoutPos(posSale(productId, 4)),
        ]);

        expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
        expect(await ledger(productId)).toEqual([1, 0]);
      },
    );

    it(
      "replays a retried sale instead of charging it twice",
      { timeout: FLOW_TIMEOUT },
      async () => {
        const productId = await fx.addProduct({ stock: [10, 0] });
        const input = {
          ...posSale(productId, 3),
          idempotencyKey: randomUUID(),
        };

        const [first, second] = await Promise.all([
          fx.as("employee").sales.checkoutPos(input),
          fx.as("employee").sales.checkoutPos(input),
        ]);

        expect(second.id).toBe(first.id);
        expect(await ledger(productId)).toEqual([7, 0]);
      },
    );

    it(
      "rejects a price below the floor for staff",
      { timeout: FLOW_TIMEOUT },
      async () => {
        const productId = await fx.addProduct({ price: 10, stock: [10, 0] });

        await expect(
          fx.as("employee").sales.checkoutPos(posSale(productId, 1, 8)),
        ).rejects.toMatchObject({ code: "FORBIDDEN" });

        expect(await ledger(productId)).toEqual([10, 0]);
      },
    );
  });

  describe("orders and credit", () => {
    it(
      "opens a receivable for covered credit and the trigger keeps the customer balance",
      { timeout: FLOW_TIMEOUT },
      async () => {
        const customerId = await newCustomer();
        const productId = await fx.addProduct();

        const order = await creditOrder(customerId, productId);

        expect(order.status).toBe("pending");
        expect(order.orderNumber).not.toBe("");
        expect(await receivable(order.id)).toMatchObject({
          balance: 20,
          paid_amount: 0,
          status: "pending",
        });
        expect(await customerBalance(customerId)).toBe(20);
      },
    );

    it(
      "holds uncovered credit for approval and opens the receivable once approved",
      { timeout: FLOW_TIMEOUT },
      async () => {
        const customerId = await newCustomer(5);
        const productId = await fx.addProduct();

        const order = await creditOrder(customerId, productId);

        expect(order.status).toBe("pending_confirmation");
        expect(await customerBalance(customerId)).toBe(0);
        const approval = await one<{ id: string; approval_type: string }>(
          `SELECT id, approval_type FROM approval WHERE entity_id = $1`,
          [order.id],
        );
        expect(approval.approval_type).toBe("credit_sale");

        await fx.as("owner").approvals.approve({ id: approval.id });

        const confirmed = await one<{ status: string }>(
          `SELECT status FROM sales_order WHERE id = $1`,
          [order.id],
        );
        expect(confirmed.status).toBe("confirmed");
        expect((await receivable(order.id)).balance).toBe(20);
        expect(await customerBalance(customerId)).toBe(20);
      },
    );

    it(
      "does not let two orders spend the same credit",
      { timeout: FLOW_TIMEOUT },
      async () => {
        const customerId = await newCustomer(20);
        const productId = await fx.addProduct();

        const orders = await Promise.all([
          creditOrder(customerId, productId),
          creditOrder(customerId, productId),
        ]);

        expect(orders.map((o) => o.status).sort()).toEqual([
          "pending",
          "pending_confirmation",
        ]);
        expect(await customerBalance(customerId)).toBe(20);
      },
    );

    it(
      "holds a price below the floor for approval",
      { timeout: FLOW_TIMEOUT },
      async () => {
        const productId = await fx.addProduct({ price: 10 });

        const order = await fx.as("employee").sales.createOrder({
          channel: "store",
          items: [{ productId, quantity: 1, unitPrice: 8, discount: 0 }],
        });

        expect(order.status).toBe("pending_confirmation");
        const approval = await one<{ approval_type: string }>(
          `SELECT approval_type FROM approval WHERE entity_id = $1`,
          [order.id],
        );
        expect(approval.approval_type).toBe("price_override");
      },
    );

    it(
      "cancelling a closed order returns its stock and clears the receivable",
      { timeout: FLOW_TIMEOUT },
      async () => {
        const customerId = await newCustomer();
        const productId = await fx.addProduct({ stock: [1, 5] });
        const manager = fx.as("owner");

        const order = await creditOrder(customerId, productId);
        for (const status of [
          "confirmed",
          "prepared",
          "dispatched",
          "delivered",
        ] as const) {
          await manager.sales.updateOrderStatus({ id: order.id, status });
        }
        expect(await ledger(productId)).toEqual([0, 4]);

        await manager.sales.updateOrderStatus({
          id: order.id,
          status: "returned",
        });

        expect(await ledger(productId)).toEqual([1, 5]);
        expect((await receivable(order.id)).status).toBe("written_off");
        expect(await customerBalance(customerId)).toBe(0);
      },
    );

    it(
      "refuses a jump the lifecycle does not allow",
      { timeout: FLOW_TIMEOUT },
      async () => {
        const productId = await fx.addProduct();
        const order = await fx.as("employee").sales.createOrder({
          channel: "store",
          items: [{ productId, quantity: 1, unitPrice: 10, discount: 0 }],
        });

        await expect(
          fx
            .as("owner")
            .sales.updateOrderStatus({ id: order.id, status: "delivered" }),
        ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      },
    );
  });

  describe("payments", () => {
    it(
      "a validated payment moves the receivable exactly once",
      { timeout: FLOW_TIMEOUT },
      async () => {
        const customerId = await newCustomer();
        const order = await creditOrder(customerId, await fx.addProduct());

        await fx.as("owner").payments.add({
          orderId: order.id,
          method: "transfer",
          amount: 8,
          reference: "REF-1",
        });

        expect(await receivable(order.id)).toMatchObject({
          balance: 12,
          paid_amount: 8,
          status: "partial",
        });
        expect(await customerBalance(customerId)).toBe(12);
      },
    );

    it(
      "an unvalidated payment moves nothing until it is validated, once",
      { timeout: FLOW_TIMEOUT },
      async () => {
        const customerId = await newCustomer();
        const order = await creditOrder(customerId, await fx.addProduct());

        const payment = await fx.as("employee").payments.add({
          orderId: order.id,
          method: "transfer",
          amount: 8,
          reference: "REF-2",
        });
        expect((await receivable(order.id)).balance).toBe(20);

        const paymentId = payment?.id ?? "";
        await Promise.allSettled([
          fx.as("owner").payments.validate({ id: paymentId }),
          fx.as("supervisor").payments.validate({ id: paymentId }),
        ]);

        expect((await receivable(order.id)).balance).toBe(12);
        expect(await customerBalance(customerId)).toBe(12);
      },
    );

    it(
      "rejects a repeated reference and an amount above what is owed",
      { timeout: FLOW_TIMEOUT },
      async () => {
        const order = await creditOrder(
          await newCustomer(),
          await fx.addProduct(),
        );
        const payment = {
          orderId: order.id,
          method: "transfer" as const,
          amount: 5,
          reference: "REF-3",
        };
        const manager = fx.as("owner");

        await manager.payments.add(payment);

        await expect(manager.payments.add(payment)).rejects.toMatchObject({
          code: "CONFLICT",
        });
        await expect(
          manager.payments.add({ ...payment, reference: "REF-4", amount: 16 }),
        ).rejects.toMatchObject({ code: "BAD_REQUEST" });
        expect((await receivable(order.id)).balance).toBe(15);
      },
    );

    it(
      "two payments racing for the same balance cannot overpay",
      { timeout: FLOW_TIMEOUT },
      async () => {
        const order = await creditOrder(
          await newCustomer(),
          await fx.addProduct(),
        );
        const manager = fx.as("owner");
        const pay = (reference: string) =>
          manager.payments.add({
            orderId: order.id,
            method: "transfer",
            amount: 15,
            reference,
          });

        const results = await Promise.allSettled([pay("R-A"), pay("R-B")]);

        expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
        expect((await receivable(order.id)).balance).toBe(5);
      },
    );

    it(
      "a retried payment with the same key is stored once",
      { timeout: FLOW_TIMEOUT },
      async () => {
        const order = await creditOrder(
          await newCustomer(),
          await fx.addProduct(),
        );
        const input = {
          orderId: order.id,
          method: "transfer" as const,
          amount: 5,
          idempotencyKey: randomUUID(),
        };
        const manager = fx.as("owner");

        const first = await manager.payments.add(input);
        const second = await manager.payments.add(input);

        expect(second?.id).toBe(first?.id);
        expect((await receivable(order.id)).balance).toBe(15);
      },
    );

    it(
      "a payment recorded from the receivable reduces it once",
      { timeout: FLOW_TIMEOUT },
      async () => {
        const customerId = await newCustomer();
        const order = await creditOrder(customerId, await fx.addProduct());
        const ar = await receivable(order.id);

        await fx.as("owner").vendor.recordPayment({
          id: ar.id,
          amount: 6,
          method: "zelle",
          reference: "AR-1",
        });

        expect(await receivable(order.id)).toMatchObject({
          balance: 14,
          paid_amount: 6,
        });
        expect(await customerBalance(customerId)).toBe(14);
      },
    );
  });

  describe("credit notes", () => {
    const deliveredOrder = async (customerId: string, productId: string) => {
      const order = await creditOrder(customerId, productId);
      const manager = fx.as("owner");
      for (const status of [
        "confirmed",
        "prepared",
        "dispatched",
        "delivered",
      ] as const) {
        await manager.sales.updateOrderStatus({ id: order.id, status });
      }
      return order;
    };

    it(
      "returns the goods and reduces the receivable, once, and never for its requester",
      { timeout: FLOW_TIMEOUT },
      async () => {
        const customerId = await newCustomer();
        const productId = await fx.addProduct({ stock: [10, 0] });
        const order = await deliveredOrder(customerId, productId);
        expect(await ledger(productId)).toEqual([8, 0]);

        const note = await fx.as("employee").creditNotes.create({
          orderId: order.id,
          reason: "Producto devuelto",
          returnToStock: true,
          warehouseId: fx.showroomId,
          items: [{ productId, quantity: 1 }],
        });
        expect(note.creditNoteNumber).toMatch(/^NC/);
        const noteId = note.id;

        await expect(
          fx.as("employee").creditNotes.approve({ id: noteId }),
        ).rejects.toMatchObject({ code: "FORBIDDEN" });

        const results = await Promise.allSettled([
          fx.as("owner").creditNotes.approve({ id: noteId }),
          fx.as("supervisor").creditNotes.approve({ id: noteId }),
        ]);
        expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);

        expect(await ledger(productId)).toEqual([9, 0]);
        const ar = await receivable(order.id);
        expect(ar.balance).toBeLessThan(20);
        expect(await customerBalance(customerId)).toBe(ar.balance);
      },
    );

    it(
      "cannot return goods that never left",
      { timeout: FLOW_TIMEOUT },
      async () => {
        const productId = await fx.addProduct();
        const order = await creditOrder(await newCustomer(), productId);

        await expect(
          fx.as("employee").creditNotes.create({
            orderId: order.id,
            reason: "Sin despachar",
            returnToStock: true,
            warehouseId: fx.showroomId,
            items: [{ productId, quantity: 1 }],
          }),
        ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
      },
    );
  });

  describe("receipts", () => {
    it(
      "a purchase invoice sent twice at once is received once",
      { timeout: FLOW_TIMEOUT },
      async () => {
        const productId = await fx.addProduct({ cost: 10, stock: [10, 0] });
        const input = {
          warehouseId: fx.showroomId,
          invoiceNumber: `FAC-${randomUUID()}`,
          items: [{ productId, quantity: 10, unitCostUsd: 20 }],
        };

        const results = await Promise.allSettled([
          fx.as("owner").inventory.receivePurchase(input),
          fx.as("supervisor").inventory.receivePurchase(input),
        ]);

        expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
        expect(await ledger(productId)).toEqual([20, 0]);
      },
    );
  });

  describe("corrections after a sale", () => {
    const delivered = async (productId: string, quantity: number) => {
      const manager = fx.as("owner");
      const order = await manager.sales.createOrder({
        channel: "store",
        items: [{ productId, quantity, unitPrice: 10, discount: 0 }],
      });
      for (const status of [
        "confirmed",
        "prepared",
        "dispatched",
        "delivered",
      ] as const) {
        await manager.sales.updateOrderStatus({ id: order.id, status });
      }
      return order;
    };
    const returnNote = (orderId: string, productId: string, quantity: number) =>
      fx.as("employee").creditNotes.create({
        orderId,
        reason: "Devolución parcial",
        returnToStock: true,
        warehouseId: fx.showroomId,
        items: [{ productId, quantity }],
      });

    it(
      "a return after a credit note brings back only what is still out",
      { timeout: FLOW_TIMEOUT },
      async () => {
        const productId = await fx.addProduct({ stock: [10, 0] });
        const order = await delivered(productId, 10);
        const note = await returnNote(order.id, productId, 4);
        await fx.as("owner").creditNotes.approve({ id: note.id });
        expect(await ledger(productId)).toEqual([4, 0]);

        await fx
          .as("owner")
          .sales.updateOrderStatus({ id: order.id, status: "returned" });

        expect(await ledger(productId)).toEqual([10, 0]);
      },
    );

    it(
      "a credit note left pending cannot return goods a reversal already returned",
      { timeout: FLOW_TIMEOUT },
      async () => {
        const productId = await fx.addProduct({ stock: [10, 0] });
        const order = await delivered(productId, 10);
        const note = await returnNote(order.id, productId, 4);
        await fx
          .as("owner")
          .sales.updateOrderStatus({ id: order.id, status: "returned" });

        await expect(
          fx.as("owner").creditNotes.approve({ id: note.id }),
        ).rejects.toMatchObject({ code: "CONFLICT" });
        expect(await ledger(productId)).toEqual([10, 0]);
      },
    );

    it(
      "a receivable closed by a credit note accepts no more payments",
      { timeout: FLOW_TIMEOUT },
      async () => {
        const productId = await fx.addProduct({ stock: [10, 0] });
        const customerId = await newCustomer();
        const manager = fx.as("owner");
        const order = await creditOrder(customerId, productId);
        for (const status of [
          "confirmed",
          "prepared",
          "dispatched",
          "delivered",
        ] as const) {
          await manager.sales.updateOrderStatus({ id: order.id, status });
        }
        const note = await returnNote(order.id, productId, 2);
        await manager.creditNotes.approve({ id: note.id });
        expect((await receivable(order.id)).balance).toBe(0);

        await expect(
          manager.payments.add({
            orderId: order.id,
            method: "transfer",
            amount: 5,
            reference: "AFTER-NOTE",
          }),
        ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      },
    );
  });

  describe("orders waiting for approval", () => {
    it(
      "accept no payment until they are approved",
      { timeout: FLOW_TIMEOUT },
      async () => {
        const order = await creditOrder(
          await newCustomer(5),
          await fx.addProduct(),
        );
        expect(order.status).toBe("pending_confirmation");

        await expect(
          fx.as("owner").payments.add({
            orderId: order.id,
            method: "transfer",
            amount: 5,
            reference: "EARLY",
          }),
        ).rejects.toMatchObject({ code: "CONFLICT" });
      },
    );

    it(
      "an approval cannot move an order that left that state",
      { timeout: FLOW_TIMEOUT },
      async () => {
        const productId = await fx.addProduct();
        const order = await fx.as("employee").sales.createOrder({
          channel: "store",
          items: [{ productId, quantity: 1, unitPrice: 10, discount: 0 }],
        });
        const approval = await one<{ id: string }>(
          `INSERT INTO approval
             (workspace_id, approval_type, status, entity_type, entity_id, requested_by)
           VALUES ($1, 'credit_sale', 'pending', 'sales_order', $2, $3)
           RETURNING id`,
          [fx.workspaceId, order.id, fx.userIds.employee],
        );

        await expect(
          fx.as("owner").approvals.approve({ id: approval.id }),
        ).rejects.toMatchObject({ code: "CONFLICT" });
      },
    );

    it(
      "clients cannot open the approvals only an order creates",
      { timeout: FLOW_TIMEOUT },
      async () => {
        await expect(
          fx.as("owner").approvals.request({
            approvalType: "credit_sale",
            entityType: "sales_order",
            entityId: randomUUID(),
          }),
        ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      },
    );
  });

  describe("installments", () => {
    it(
      "paying an installment charges only what it still owes",
      { timeout: FLOW_TIMEOUT },
      async () => {
        const customerId = await newCustomer();
        const order = await creditOrder(customerId, await fx.addProduct());
        const ar = await receivable(order.id);
        const manager = fx.as("owner");
        const due = new Date(Date.now() + 86_400_000).toISOString();
        await manager.receivables.createInstallments({
          receivableId: ar.id,
          installments: [
            { installmentNumber: 1, amount: 10, dueDate: due },
            { installmentNumber: 2, amount: 10, dueDate: due },
          ],
        });
        await manager.vendor.recordPayment({
          id: ar.id,
          amount: 6,
          method: "zelle",
          reference: "PARTIAL",
        });
        const first = await one<{ id: string }>(
          `SELECT id FROM ar_installment
           WHERE receivable_id = $1 AND installment_number = 1`,
          [ar.id],
        );

        await manager.receivables.markPaid({ installmentId: first.id });

        expect((await receivable(order.id)).balance).toBe(10);
        expect(await customerBalance(customerId)).toBe(10);
      },
    );
  });

  describe("point of sale payments", () => {
    it(
      "stay out of the pending list and refuse a repeated reference",
      { timeout: FLOW_TIMEOUT },
      async () => {
        const productId = await fx.addProduct({ stock: [10, 0] });
        const seller = fx.as("employee");

        const sale = await seller.sales.checkoutPos(posSale(productId, 1));
        const payment = await one<{ is_validated: boolean }>(
          `SELECT is_validated FROM payment WHERE order_id = $1`,
          [sale.id],
        );
        expect(payment.is_validated).toBe(true);

        await expect(
          seller.sales.checkoutPos({
            items: [{ productId, quantity: 2, unitPrice: 10 }],
            payments: [
              {
                method: "transfer",
                amount: 10,
                currency: "USD",
                reference: "SAME",
              },
              {
                method: "zelle",
                amount: 10,
                currency: "USD",
                reference: "SAME",
              },
            ],
          }),
        ).rejects.toMatchObject({ code: "BAD_REQUEST" });
        expect(await ledger(productId)).toEqual([9, 0]);
      },
    );
  });

  describe("documents", () => {
    it(
      "one receivable per order, and a converted quote stays converted",
      { timeout: FLOW_TIMEOUT },
      async () => {
        const manager = fx.as("owner");
        const customerId = await newCustomer();
        const productId = await fx.addProduct();
        const order = await creditOrder(customerId, productId);

        await expect(
          manager.vendor.createAR({
            customerId,
            orderId: order.id,
            totalAmount: 20,
            dueDate: new Date(Date.now() + 86_400_000).toISOString(),
          }),
        ).rejects.toMatchObject({ code: "CONFLICT" });

        const quote = await manager.quotes.create({
          customerId,
          channel: "store",
          items: [{ productId, quantity: 1, unitPrice: 10, discount: 0 }],
        });
        const quoteId = quote?.id ?? "";
        await manager.quotes.convertToOrder({ id: quoteId });
        await expect(
          manager.quotes.updateStatus({ id: quoteId, status: "accepted" }),
        ).rejects.toMatchObject({ code: "CONFLICT" });
        await expect(
          manager.quotes.convertToOrder({ id: quoteId }),
        ).rejects.toMatchObject({ code: "CONFLICT" });
      },
    );
  });

  describe("containers", () => {
    it(
      "receives each unit once across repeated and partial receipts",
      { timeout: FLOW_TIMEOUT },
      async () => {
        const productId = await fx.addProduct({ stock: [0, 0] });
        const manager = fx.as("owner");
        const container = await manager.container.create({
          containerNumber: `MSCU-${randomUUID().slice(0, 8)}`,
        });
        const containerId = container?.id ?? "";
        await manager.container.addItems({
          containerId,
          items: [{ productId, quantityExpected: 10 }],
        });
        const item = await one<{ id: string }>(
          `SELECT id FROM container_item WHERE container_id = $1`,
          [containerId],
        );
        const receive = (quantityReceived: number) =>
          manager.container.receiveItems({
            containerId,
            warehouseId: fx.showroomId,
            items: [{ containerItemId: item.id, productId, quantityReceived }],
          });
        const status = async (): Promise<string> =>
          (
            await one<{ status: string }>(
              `SELECT status FROM container WHERE id = $1`,
              [containerId],
            )
          ).status;

        await receive(4);
        await receive(4);
        expect(await ledger(productId)).toEqual([4, 0]);
        expect(await status()).toBe("in_transit");

        await expect(
          manager.container.receiveItems({
            containerId,
            warehouseId: fx.showroomId,
            items: [
              { containerItemId: item.id, productId, quantityReceived: 5 },
              { containerItemId: item.id, productId, quantityReceived: 6 },
            ],
          }),
        ).rejects.toMatchObject({ code: "BAD_REQUEST" });

        await receive(10);
        expect(await ledger(productId)).toEqual([10, 0]);
        expect(await status()).toBe("received");
      },
    );
  });

  describe("fiscal documents", () => {
    it(
      "stores the SENIAT breakdown and discounts a repeated retention once",
      { timeout: FLOW_TIMEOUT },
      async () => {
        vi.stubEnv("FISCAL_EMISSION_ENABLED", "true");
        const customerId = await newCustomer();
        const order = await creditOrder(customerId, await fx.addProduct());
        const manager = fx.as("owner");

        const doc = await manager.fiscal.emitDocument({
          orderId: order.id,
          customerId,
          buyerRif: "G-20000303-0",
          buyerLegalName: "Cliente C.A.",
          fiscalInvoiceNumber: `A-${randomUUID().slice(0, 8)}`,
          controlNumber: `00-${randomUUID().slice(0, 8)}`,
          lines: [{ subtotalUsd: 20 }],
        });
        vi.unstubAllEnvs();
        expect(doc).toMatchObject({
          taxableBase16Usd: 20,
          iva16Usd: 3.2,
          exchangeRateBcv: 40,
        });
        const fiscalDocumentId = doc?.id ?? "";
        const retention = {
          fiscalDocumentId,
          ivaRetentionPct: 75 as const,
          ivaRetentionVoucher: "RET-1",
          islrRetentionPct: 0,
        };

        await manager.fiscal.recordRetention(retention);
        await manager.fiscal.recordRetention(retention);

        expect((await receivable(order.id)).balance).toBeCloseTo(17.6, 2);
        expect(await customerBalance(customerId)).toBeCloseTo(17.6, 2);
        await expect(
          manager.fiscal.recordRetention({ ...retention, ivaRetentionPct: 0 }),
        ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });

        await expect(manager.fiscal.salesBookReport({})).resolves.toBeDefined();
      },
    );

    it(
      "cannot be changed or deleted once issued",
      { timeout: FLOW_TIMEOUT },
      async () => {
        vi.stubEnv("FISCAL_EMISSION_ENABLED", "true");
        const doc = await fx.as("owner").fiscal.emitDocument({
          buyerRif: "G-20000303-0",
          buyerLegalName: "Cliente C.A.",
          fiscalInvoiceNumber: `B-${randomUUID().slice(0, 8)}`,
          controlNumber: `01-${randomUUID().slice(0, 8)}`,
          lines: [{ subtotalUsd: 10 }],
        });
        vi.unstubAllEnvs();

        await expect(
          real.pool.query(
            `UPDATE fiscal_document SET total_usd = 1 WHERE id = $1`,
            [doc?.id],
          ),
        ).rejects.toThrow();
      },
    );
  });

  describe("audit chain", () => {
    it(
      "links every entry of the workspace, even under concurrent writes",
      { timeout: FLOW_TIMEOUT },
      async () => {
        const productIds = await Promise.all(
          Array.from({ length: 10 }, () => fx.addProduct({ stock: [10, 0] })),
        );
        await Promise.all(
          productIds.map((productId) =>
            fx.as("employee").sales.checkoutPos(posSale(productId, 1)),
          ),
        );

        const { rows } = await real.pool.query<{
          prev_hash: string;
          chain_hash: string;
        }>(
          `SELECT prev_hash, chain_hash FROM audit_log
           WHERE workspace_id = $1 ORDER BY seq`,
          [fx.workspaceId],
        );

        expect(rows.length).toBeGreaterThanOrEqual(10);
        rows.slice(1).forEach((row, index) => {
          expect(row.prev_hash).toBe(rows[index]?.chain_hash);
        });
      },
    );

    it(
      "cannot be rewritten, not even by the table owner",
      { timeout: FLOW_TIMEOUT },
      async () => {
        await expect(
          real.pool.query(
            `UPDATE audit_log SET action = 'forged' WHERE workspace_id = $1`,
            [fx.workspaceId],
          ),
        ).rejects.toThrow();
        await expect(
          real.pool.query(`DELETE FROM audit_log WHERE workspace_id = $1`, [
            fx.workspaceId,
          ]),
        ).rejects.toThrow();
      },
    );
  });

  it("every financial invariant holds after all of the above", async () => {
    const query = readFileSync(
      path.resolve(
        import.meta.dirname,
        "../../../../scripts/checks/prod/financial-invariants.sql",
      ),
      "utf8",
    );

    const { rows } = await real.pool.query<{
      invariant: string;
      violations: string;
    }>(query);

    expect(rows.length).toBeGreaterThan(5);
    expect(rows.filter((row) => Number(row.violations) > 0)).toEqual([]);
  });
});
