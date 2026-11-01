/**
 * Cendaro — Order lifecycle: creation with payment terms, status changes and
 * their effects on stock and receivables.
 *
 * Every function runs inside the caller's transaction and locks what it reads,
 * so two concurrent requests cannot both deduct stock or spend the same credit.
 */
import type { SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, inArray, sql } from "drizzle-orm";

import type { getDb } from "@cendaro/db/client";
import type { salesChannelEnum } from "@cendaro/db/schema";
import {
  AccountReceivable,
  Approval,
  ChannelAllocation,
  CreditNote,
  Customer,
  OrderItem,
  SalesOrder,
  StockLedger,
  StockMovement,
  Warehouse,
} from "@cendaro/db/schema";
import { canTransitionOrder, MONEY_EPSILON } from "@cendaro/validators";

import type { WorkspaceMembership } from "../trpc";
import type { PricedLine } from "./pricing-policy";
import { isOrderPricingWithinPolicy } from "./pricing-policy";
import { assertInWorkspace } from "./workspace-guard";

type Db = ReturnType<typeof getDb>;

export interface OrderContext {
  db: Db;
  user: { id: string };
  workspace: WorkspaceMembership;
}

export type SalesOrderRow = typeof SalesOrder.$inferSelect;
type SalesChannel = (typeof salesChannelEnum.enumValues)[number];

const CLOSING_STATUSES: readonly string[] = ["delivered", "invoiced"];
const REVERT_STATUSES: readonly string[] = ["returned", "cancelled"];
const OPEN_RECEIVABLE_STATUSES = ["pending", "partial", "overdue"] as const;
const DEFAULT_CREDIT_DAYS = 30;

export function isRevertingStatus(status: string): boolean {
  return REVERT_STATUSES.includes(status);
}

export function assertOrderTransition(from: string, to: string): void {
  if (!canTransitionOrder(from, to)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Un pedido en estado "${from}" no puede pasar a "${to}"`,
    });
  }
}

interface LedgerAllocation {
  productId: string;
  warehouseId: string;
  delta: number;
}

/** Active warehouses in the order stock is taken from. */
async function warehousesByPriority(ctx: OrderContext): Promise<string[]> {
  const rows = await ctx.db
    .select({ id: Warehouse.id })
    .from(Warehouse)
    .where(
      and(
        eq(Warehouse.workspaceId, ctx.workspace.workspaceId),
        eq(Warehouse.isActive, true),
      ),
    )
    .orderBy(
      sql`CASE WHEN ${Warehouse.type} = 'showroom' THEN 0 WHEN ${Warehouse.type} = 'warehouse' THEN 1 ELSE 2 END`,
      asc(Warehouse.createdAt),
    );
  return rows.map((r) => r.id);
}

/**
 * Locks the ledger rows of the products in a fixed order, so concurrent sales
 * cannot deadlock, and takes each quantity across warehouses by priority.
 */
async function planDeduction(
  ctx: OrderContext,
  needed: ReadonlyMap<string, number>,
): Promise<LedgerAllocation[]> {
  const warehouses = await warehousesByPriority(ctx);
  const rows = await ctx.db
    .select({
      productId: StockLedger.productId,
      warehouseId: StockLedger.warehouseId,
      quantity: StockLedger.quantity,
      isLocked: StockLedger.isLocked,
    })
    .from(StockLedger)
    .where(
      and(
        eq(StockLedger.workspaceId, ctx.workspace.workspaceId),
        inArray(StockLedger.productId, [...needed.keys()]),
      ),
    )
    .orderBy(asc(StockLedger.productId), asc(StockLedger.warehouseId))
    .for("update");

  if (rows.some((r) => r.isLocked === true)) {
    throw new TRPCError({
      code: "CONFLICT",
      message:
        "Uno o más productos están bloqueados por conteo físico de inventario",
    });
  }

  const allocations: LedgerAllocation[] = [];
  for (const [productId, quantity] of needed) {
    let remaining = quantity;
    for (const warehouseId of warehouses) {
      if (remaining <= 0) break;
      const row = rows.find(
        (r) => r.productId === productId && r.warehouseId === warehouseId,
      );
      const taken = Math.min(row?.quantity ?? 0, remaining);
      if (taken <= 0) continue;
      allocations.push({ productId, warehouseId, delta: -taken });
      remaining -= taken;
    }
    if (remaining > 0) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Stock insuficiente para despachar el pedido",
      });
    }
  }
  return allocations;
}

/** Returns stock to the warehouses it left from, as recorded when it was sold. */
async function planRestoration(
  ctx: OrderContext,
  orderId: string,
  sold: ReadonlyMap<string, number>,
): Promise<LedgerAllocation[]> {
  const movements = await ctx.db
    .select({
      productId: StockMovement.productId,
      warehouseId: StockMovement.warehouseId,
      quantity: StockMovement.quantity,
    })
    .from(StockMovement)
    .where(
      and(
        eq(StockMovement.workspaceId, ctx.workspace.workspaceId),
        eq(StockMovement.referenceId, orderId),
        eq(StockMovement.referenceType, "sales_order"),
        eq(StockMovement.movementType, "sale"),
      ),
    );

  // Units a credit note already returned must not come back a second time.
  const alreadyReturned = await unitsReturnedByCreditNotes(ctx, orderId);
  const withoutReturned = (productId: string, quantity: number): number => {
    const returned = Math.min(alreadyReturned.get(productId) ?? 0, quantity);
    alreadyReturned.set(
      productId,
      (alreadyReturned.get(productId) ?? 0) - returned,
    );
    return quantity - returned;
  };

  const allocations: LedgerAllocation[] = [];
  const pending = new Map(sold);
  for (const movement of movements) {
    if (!movement.warehouseId) continue;
    const quantity = Math.abs(movement.quantity);
    pending.set(
      movement.productId,
      (pending.get(movement.productId) ?? 0) - quantity,
    );
    const delta = withoutReturned(movement.productId, quantity);
    if (delta > 0) {
      allocations.push({
        productId: movement.productId,
        warehouseId: movement.warehouseId,
        delta,
      });
    }
  }

  // Orders deducted before movements recorded a warehouse go to the primary one.
  const [primary] = await warehousesByPriority(ctx);
  if (primary) {
    for (const [productId, quantity] of pending) {
      const delta = withoutReturned(productId, Math.max(quantity, 0));
      if (delta > 0) {
        allocations.push({ productId, warehouseId: primary, delta });
      }
    }
  }
  return allocations;
}

async function unitsReturnedByCreditNotes(
  ctx: OrderContext,
  orderId: string,
): Promise<Map<string, number>> {
  const rows = await ctx.db
    .select({
      productId: StockMovement.productId,
      quantity: StockMovement.quantity,
    })
    .from(StockMovement)
    .innerJoin(CreditNote, eq(CreditNote.id, StockMovement.referenceId))
    .where(
      and(
        eq(StockMovement.workspaceId, ctx.workspace.workspaceId),
        eq(StockMovement.referenceType, "credit_note"),
        eq(StockMovement.movementType, "return"),
        eq(CreditNote.orderId, orderId),
      ),
    );
  const returned = new Map<string, number>();
  for (const row of rows) {
    returned.set(
      row.productId,
      (returned.get(row.productId) ?? 0) + row.quantity,
    );
  }
  return returned;
}

/** One statement per order instead of one per product. */
function deltaByProduct(
  productColumn: AnyPgColumn,
  deltas: readonly (readonly [string, number])[],
): SQL {
  const branches = deltas.map(
    ([productId, delta]) =>
      sql`WHEN ${productColumn} = ${productId} THEN ${delta}`,
  );
  return sql`(CASE ${sql.join(branches, sql` `)} ELSE 0 END)`;
}

/** Adds up the allocations of each product per warehouse. */
function deltasByWarehouse(
  allocations: readonly LedgerAllocation[],
): Map<string, Map<string, number>> {
  const byWarehouse = new Map<string, Map<string, number>>();
  for (const { warehouseId, productId, delta } of allocations) {
    const deltas = byWarehouse.get(warehouseId) ?? new Map<string, number>();
    deltas.set(productId, (deltas.get(productId) ?? 0) + delta);
    byWarehouse.set(warehouseId, deltas);
  }
  return byWarehouse;
}

/**
 * The rows exist and are locked by planDeduction. It has to be an UPDATE: an
 * upsert would propose a negative row, which ck_stock_ledger_quantity_non_negative
 * rejects before ON CONFLICT is considered.
 */
async function deductFromLedger(
  ctx: OrderContext,
  allocations: readonly LedgerAllocation[],
): Promise<void> {
  for (const [warehouseId, deltas] of deltasByWarehouse(allocations)) {
    await ctx.db
      .update(StockLedger)
      .set({
        quantity: sql`${StockLedger.quantity} + ${deltaByProduct(StockLedger.productId, [...deltas])}`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(StockLedger.workspaceId, ctx.workspace.workspaceId),
          eq(StockLedger.warehouseId, warehouseId),
          inArray(StockLedger.productId, [...deltas.keys()]),
        ),
      );
  }
}

/** Upserts because the ledger row of a returned product may no longer exist. */
async function returnToLedger(
  ctx: OrderContext,
  allocations: readonly LedgerAllocation[],
): Promise<void> {
  const workspaceId = ctx.workspace.workspaceId;
  const rows = [...deltasByWarehouse(allocations)].flatMap(
    ([warehouseId, deltas]) =>
      [...deltas].map(([productId, quantity]) => ({
        workspaceId,
        productId,
        warehouseId,
        quantity,
      })),
  );
  if (rows.length === 0) return;
  await ctx.db
    .insert(StockLedger)
    .values(rows)
    .onConflictDoUpdate({
      target: [
        StockLedger.workspaceId,
        StockLedger.productId,
        StockLedger.warehouseId,
      ],
      set: {
        quantity: sql`${StockLedger.quantity} + excluded.quantity`,
        updatedAt: new Date(),
      },
    });
}

/**
 * Stock effect of an order moving to `status`: closing (delivered / invoiced)
 * deducts it, a reversal (returned / cancelled) restores it, and the movements
 * and the order's stockDeducted flag stay in step.
 */
export async function applyStockLifecycle(
  ctx: OrderContext,
  order: Pick<SalesOrderRow, "id" | "channel" | "stockDeducted">,
  status: SalesOrderRow["status"],
  preloadedItems?: readonly { productId: string; quantity: number }[],
): Promise<{ isClosing: boolean; isReverting: boolean }> {
  const isClosing = CLOSING_STATUSES.includes(status) && !order.stockDeducted;
  const isReverting =
    REVERT_STATUSES.includes(status) && Boolean(order.stockDeducted);
  if (!isClosing && !isReverting) return { isClosing, isReverting };

  const workspaceId = ctx.workspace.workspaceId;
  const items =
    preloadedItems ??
    (await ctx.db
      .select({ productId: OrderItem.productId, quantity: OrderItem.quantity })
      .from(OrderItem)
      .where(
        and(
          eq(OrderItem.orderId, order.id),
          eq(OrderItem.workspaceId, workspaceId),
        ),
      ));

  const quantities = new Map<string, number>();
  for (const item of items) {
    quantities.set(
      item.productId,
      (quantities.get(item.productId) ?? 0) + item.quantity,
    );
  }

  if (quantities.size > 0) {
    const effectiveChannel =
      order.channel === "whatsapp" || order.channel === "instagram"
        ? "store"
        : order.channel;

    const allocations = isClosing
      ? await planDeduction(ctx, quantities)
      : await planRestoration(ctx, order.id, quantities);

    if (isClosing) await deductFromLedger(ctx, allocations);
    else await returnToLedger(ctx, allocations);

    // Channel rows are reservations over the physical ledger checked above,
    // and most products have none, so they clamp at zero instead of failing.
    const channelDeltas = new Map<string, number>();
    for (const { productId, delta } of allocations) {
      channelDeltas.set(productId, (channelDeltas.get(productId) ?? 0) + delta);
    }
    if (channelDeltas.size > 0) {
      await ctx.db
        .update(ChannelAllocation)
        .set({
          quantity: sql`GREATEST(${ChannelAllocation.quantity} + ${deltaByProduct(ChannelAllocation.productId, [...channelDeltas])}, 0)`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(ChannelAllocation.workspaceId, workspaceId),
            inArray(ChannelAllocation.productId, [...channelDeltas.keys()]),
            eq(ChannelAllocation.channel, effectiveChannel),
          ),
        );
    }

    if (allocations.length > 0) {
      await ctx.db.insert(StockMovement).values(
        allocations.map(({ productId, warehouseId, delta }) => ({
          workspaceId,
          productId,
          warehouseId,
          movementType: isClosing ? ("sale" as const) : ("return" as const),
          quantity: delta,
          fromChannel: isClosing ? effectiveChannel : undefined,
          toChannel: isReverting ? effectiveChannel : undefined,
          createdBy: ctx.user.id,
          referenceId: order.id,
          referenceType: "sales_order",
        })),
      );
    }
  }

  await ctx.db
    .update(SalesOrder)
    .set({ stockDeducted: isClosing })
    .where(
      and(eq(SalesOrder.id, order.id), eq(SalesOrder.workspaceId, workspaceId)),
    );

  return { isClosing, isReverting };
}

/**
 * A cancelled or returned order owes nothing anymore. If money was already
 * received, it must go back through a credit note, which records the refund.
 */
export async function settleReceivableOnReversal(
  ctx: OrderContext,
  order: Pick<SalesOrderRow, "id" | "totalPaid">,
): Promise<void> {
  const workspaceId = ctx.workspace.workspaceId;
  const [receivable] = await ctx.db
    .select({
      id: AccountReceivable.id,
      paidAmount: AccountReceivable.paidAmount,
      status: AccountReceivable.status,
    })
    .from(AccountReceivable)
    .where(
      and(
        eq(AccountReceivable.orderId, order.id),
        eq(AccountReceivable.workspaceId, workspaceId),
      ),
    )
    .limit(1)
    .for("update");

  const paid = Math.max(
    Number(order.totalPaid ?? 0),
    Number(receivable?.paidAmount ?? 0),
  );
  if (paid > MONEY_EPSILON) {
    throw new TRPCError({
      code: "CONFLICT",
      message:
        "Este pedido tiene pagos registrados: revértelo con una nota de crédito",
    });
  }

  if (
    receivable &&
    (OPEN_RECEIVABLE_STATUSES as readonly string[]).includes(receivable.status)
  ) {
    await ctx.db
      .update(AccountReceivable)
      .set({ balance: 0, status: "written_off" })
      .where(
        and(
          eq(AccountReceivable.id, receivable.id),
          eq(AccountReceivable.workspaceId, workspaceId),
        ),
      );
  }
}

interface ReceivableInput {
  customerId: string;
  orderId: string;
  orderNumber: string;
  total: number;
  creditDays: number | null;
}

async function createReceivable(
  db: Db,
  workspaceId: string,
  createdBy: string,
  input: ReceivableInput,
): Promise<void> {
  const days =
    input.creditDays && input.creditDays > 0
      ? input.creditDays
      : DEFAULT_CREDIT_DAYS;
  await db.insert(AccountReceivable).values({
    workspaceId,
    customerId: input.customerId,
    orderId: input.orderId,
    totalAmount: input.total,
    paidAmount: 0,
    balance: input.total,
    status: "pending",
    dueDate: new Date(Date.now() + days * 86_400_000),
    notes: `Generado por pedido ${input.orderNumber}`,
    createdBy,
  });
}

export interface CreateOrderInput {
  customerId?: string | null;
  channel: SalesChannel;
  notes?: string | null;
  paymentTerms: "cash" | "credit";
  items: readonly PricedLine[];
}

/**
 * Creates an order from any entry point. It waits in `pending_confirmation`
 * with an open approval when a price is below its floor or the credit does not
 * cover it; a receivable exists only for credit sales, once they are authorized.
 */
export async function createCommercialOrder(
  ctx: OrderContext,
  input: CreateOrderInput,
): Promise<SalesOrderRow> {
  const workspaceId = ctx.workspace.workspaceId;
  if (input.paymentTerms === "credit" && !input.customerId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Una venta a crédito necesita un cliente",
    });
  }

  await assertInWorkspace(
    ctx.db,
    Customer,
    input.customerId,
    workspaceId,
    "Cliente",
  );

  const priceWithinPolicy = await isOrderPricingWithinPolicy(
    ctx,
    input.channel,
    input.items,
  );

  const productIds = [...new Set(input.items.map((i) => i.productId))];
  const [lockedStock] = await ctx.db
    .select({ productId: StockLedger.productId })
    .from(StockLedger)
    .where(
      and(
        eq(StockLedger.workspaceId, workspaceId),
        inArray(StockLedger.productId, productIds),
        eq(StockLedger.isLocked, true),
      ),
    )
    .limit(1);
  if (lockedStock) {
    throw new TRPCError({
      code: "CONFLICT",
      message:
        "Uno o más productos están bloqueados por conteo físico de inventario",
    });
  }

  const subtotal = input.items.reduce(
    (sum, i) => sum + i.unitPrice * i.quantity,
    0,
  );
  const discount = input.items.reduce(
    (sum, i) => sum + i.discount * i.quantity,
    0,
  );
  const total = subtotal - discount;

  let creditDays: number | null = null;
  let creditCovers = true;
  if (input.paymentTerms === "credit" && input.customerId) {
    const [customer] = await ctx.db
      .select({
        creditLimit: Customer.creditLimit,
        creditDays: Customer.creditDays,
        balance: Customer.balance,
      })
      .from(Customer)
      .where(
        and(
          eq(Customer.id, input.customerId),
          eq(Customer.workspaceId, workspaceId),
        ),
      )
      .limit(1)
      .for("update");
    if (!customer) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Cliente no encontrado",
      });
    }
    creditDays = customer.creditDays;
    const available = (customer.creditLimit ?? 0) - (customer.balance ?? 0);
    creditCovers = total <= available + MONEY_EPSILON;
  }

  const needsApproval = !priceWithinPolicy || !creditCovers;
  const [order] = await ctx.db
    .insert(SalesOrder)
    .values({
      workspaceId,
      // Empty: trg_order_number assigns the next number of the workspace.
      orderNumber: "",
      customerId: input.customerId,
      channel: input.channel,
      status: needsApproval ? "pending_confirmation" : "pending",
      subtotal,
      discount,
      total,
      notes: input.notes,
      createdBy: ctx.user.id,
    })
    .returning();
  if (!order) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "No se pudo registrar el pedido",
    });
  }

  await ctx.db.insert(OrderItem).values(
    input.items.map((item) => ({
      workspaceId,
      orderId: order.id,
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount,
      lineTotal: (item.unitPrice - item.discount) * item.quantity,
    })),
  );

  if (needsApproval) {
    await ctx.db.insert(Approval).values({
      workspaceId,
      approvalType: priceWithinPolicy ? "credit_sale" : "price_override",
      status: "pending",
      entityType: "sales_order",
      entityId: order.id,
      requestedBy: ctx.user.id,
      reason: priceWithinPolicy
        ? `Pedido ${order.orderNumber}: el crédito disponible no cubre $${total.toFixed(2)}`
        : `Pedido ${order.orderNumber}: precio por debajo del mínimo permitido`,
      metadata: {
        orderNumber: order.orderNumber,
        total,
        paymentTerms: input.paymentTerms,
      },
    });
  } else if (input.paymentTerms === "credit" && input.customerId) {
    await createReceivable(ctx.db, workspaceId, ctx.user.id, {
      customerId: input.customerId,
      orderId: order.id,
      orderNumber: order.orderNumber,
      total,
      creditDays,
    });
  }

  return order;
}

/**
 * Effect of resolving an order's approval: confirms it, creating the receivable
 * if it was a credit sale, or cancels it.
 */
export async function applyOrderApprovalDecision(
  db: Db,
  requesterId: string,
  workspaceId: string,
  approval: { entityId: string; metadata: unknown },
  decision: "approved" | "rejected",
): Promise<void> {
  const [order] = await db
    .select()
    .from(SalesOrder)
    .where(
      and(
        eq(SalesOrder.id, approval.entityId),
        eq(SalesOrder.workspaceId, workspaceId),
      ),
    )
    .limit(1)
    .for("update");
  if (!order) return;
  if (order.status !== "pending_confirmation") {
    throw new TRPCError({
      code: "CONFLICT",
      message: "Este pedido ya no espera una aprobación",
    });
  }

  await db
    .update(SalesOrder)
    .set({ status: decision === "approved" ? "confirmed" : "cancelled" })
    .where(
      and(eq(SalesOrder.id, order.id), eq(SalesOrder.workspaceId, workspaceId)),
    );

  const metadata = approval.metadata as { paymentTerms?: string } | null;
  if (
    decision !== "approved" ||
    metadata?.paymentTerms !== "credit" ||
    !order.customerId
  ) {
    return;
  }

  const [existing] = await db
    .select({ id: AccountReceivable.id })
    .from(AccountReceivable)
    .where(
      and(
        eq(AccountReceivable.orderId, order.id),
        eq(AccountReceivable.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  if (existing) return;

  const [customer] = await db
    .select({ creditDays: Customer.creditDays })
    .from(Customer)
    .where(
      and(
        eq(Customer.id, order.customerId),
        eq(Customer.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  await createReceivable(db, workspaceId, requesterId, {
    customerId: order.customerId,
    orderId: order.id,
    orderNumber: order.orderNumber,
    total: Number(order.total),
    creditDays: customer?.creditDays ?? null,
  });
}
