/**
 * Cendaro — Sales Router
 *
 * Customers, orders, order items.
 * PRD §14-17: sales channels, order flow, customer management.
 */
import { TRPCError } from "@trpc/server";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { z } from "zod/v4";

import type { getDb } from "@cendaro/db/client";
import {
  CashClosure,
  ChannelAllocation,
  Customer,
  customerTypeEnum,
  OrderItem,
  orderStatusEnum,
  Payment,
  paymentMethodEnum,
  Product,
  salesChannelEnum,
  SalesOrder,
  StockMovement,
} from "@cendaro/db/schema";
import {
  can,
  createCustomerSchema,
  fiscalPersonKey,
  isFiscalInvoiceReady,
  normalizeFiscalId,
  updateCustomerSchema,
} from "@cendaro/validators";

import type { WorkspaceMembership } from "../trpc";
import {
  createTRPCRouter,
  wsPermissionProcedure,
  wsReadPermissionProcedure,
} from "../trpc";
import { logAudit } from "./audit";
import { escapeLike } from "./search";
import { assertVendorCustomer, vendorScopeId } from "./vendor-scope";

type SalesDb = ReturnType<typeof getDb>;

/**
 * Finds a workspace customer that is the same person as this identification
 * (same document, or a natural person's cédula ⇄ personal RIF), using the
 * person_key column whose unique index (migration 014) also closes the race.
 */
async function findCustomerByFiscalId(
  db: SalesDb,
  workspaceId: string,
  identification: string,
  excludeId?: string,
): Promise<
  { id: string; name: string; identification: string | null } | undefined
> {
  const [existing] = await db
    .select({
      id: Customer.id,
      name: Customer.name,
      identification: Customer.identification,
    })
    .from(Customer)
    .where(
      and(
        eq(Customer.workspaceId, workspaceId),
        eq(Customer.personKey, fiscalPersonKey(identification)),
        excludeId ? ne(Customer.id, excludeId) : undefined,
      ),
    )
    .limit(1);
  return existing;
}

/** True when an update sets a credit limit or term different from the stored one. */
function changesCredit(
  input: { creditLimit?: number; creditDays?: number },
  current: { creditLimit: number | null; creditDays: number | null },
): boolean {
  const limitChanged =
    input.creditLimit !== undefined &&
    input.creditLimit !== (current.creditLimit ?? 0);
  const daysChanged =
    input.creditDays !== undefined &&
    input.creditDays !== (current.creditDays ?? 0);
  return limitChanged || daysChanged;
}

function blankToNull(value: string | undefined): string | null {
  return value === undefined || value === "" ? null : value;
}

function duplicateCustomerError(identification: string, name?: string) {
  return new TRPCError({
    code: "CONFLICT",
    message: name
      ? `Ya existe un cliente registrado con ${identification}: ${name}. Búscalo en la lista de clientes.`
      : `Ya existe un cliente registrado con ${identification}. Búscalo en la lista de clientes.`,
  });
}

/** Postgres unique_violation (23505), directly or wrapped by Drizzle. */
function isUniqueViolation(error: unknown): boolean {
  const codeOf = (value: unknown): unknown =>
    typeof value === "object" && value !== null && "code" in value
      ? value.code
      : undefined;
  const cause =
    typeof error === "object" && error !== null && "cause" in error
      ? error.cause
      : undefined;
  return codeOf(error) === "23505" || codeOf(cause) === "23505";
}

interface SalesWriteContext {
  db: SalesDb;
  user: { id: string };
  workspace: WorkspaceMembership;
}

type SalesOrderRow = typeof SalesOrder.$inferSelect;

/** Tolerance for comparing USD amounts computed in floating point. */
const MONEY_EPSILON = 0.005;

/**
 * SENIAT: an invoice issued to a registered buyer must carry their name, a
 * valid RIF / cédula / passport and domicilio fiscal. Orders without a
 * customer are sold to "Consumidor Final" and skip this check.
 */
async function assertInvoiceReadyBuyer(
  ctx: SalesWriteContext,
  customerId: string,
): Promise<void> {
  const [buyer] = await ctx.db
    .select({
      name: Customer.name,
      identification: Customer.identification,
      address: Customer.address,
    })
    .from(Customer)
    .where(
      and(
        eq(Customer.id, customerId),
        eq(Customer.workspaceId, ctx.workspace.workspaceId),
      ),
    )
    .limit(1);
  if (!buyer || !isFiscalInvoiceReady(buyer)) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "El cliente no tiene los datos fiscales que exige el SENIAT (documento válido y domicilio fiscal). Actualiza la ficha del cliente antes de facturar.",
    });
  }
}

const CLOSING_STATUSES: readonly string[] = ["delivered", "invoiced"];
const REVERT_STATUSES: readonly string[] = ["returned", "cancelled"];

/**
 * Stock lifecycle of an order moving to `status`: deducts its items from the
 * sales channel when it closes (delivered / invoiced) and restores them when
 * a deducted order is returned or cancelled. Each change is logged in
 * stock_movement and the order's stockDeducted flag is kept in step.
 */
async function applyStockLifecycle(
  ctx: SalesWriteContext,
  order: Pick<SalesOrderRow, "id" | "channel" | "stockDeducted">,
  status: SalesOrderRow["status"],
): Promise<{ isClosing: boolean; isReverting: boolean }> {
  const isClosing = CLOSING_STATUSES.includes(status) && !order.stockDeducted;
  const isReverting =
    REVERT_STATUSES.includes(status) && Boolean(order.stockDeducted);
  if (!isClosing && !isReverting) return { isClosing, isReverting };

  const items = await ctx.db
    .select()
    .from(OrderItem)
    .where(
      and(
        eq(OrderItem.orderId, order.id),
        eq(OrderItem.workspaceId, ctx.workspace.workspaceId),
      ),
    );

  for (const item of items) {
    const sign = isClosing ? -1 : 1;

    await ctx.db
      .update(ChannelAllocation)
      .set({
        quantity: sql`GREATEST(quantity + ${sign * item.quantity}, 0)`,
      })
      .where(
        and(
          eq(ChannelAllocation.workspaceId, ctx.workspace.workspaceId),
          eq(ChannelAllocation.productId, item.productId),
          eq(ChannelAllocation.channel, order.channel),
        ),
      );

    await ctx.db.insert(StockMovement).values({
      workspaceId: ctx.workspace.workspaceId,
      productId: item.productId,
      movementType: isClosing ? "sale" : "return",
      quantity: sign * item.quantity,
      fromChannel: isClosing ? order.channel : undefined,
      toChannel: isReverting ? order.channel : undefined,
      createdBy: ctx.user.id,
      referenceId: order.id,
      referenceType: "sales_order",
    });
  }

  await ctx.db
    .update(SalesOrder)
    .set({ stockDeducted: isClosing })
    .where(
      and(
        eq(SalesOrder.id, order.id),
        eq(SalesOrder.workspaceId, ctx.workspace.workspaceId),
      ),
    );

  return { isClosing, isReverting };
}

/**
 * A POS sale: cart lines plus the payments that cover them. Amounts are in
 * USD; `amountBs` only records what the cashier received in bolívares.
 */
export const posCheckoutInputSchema = z.object({
  customerId: z.string().uuid().optional(),
  notes: z.string().trim().max(500).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().positive(),
        unitPrice: z.number().nonnegative(),
        discount: z.number().nonnegative().default(0),
      }),
    )
    .min(1, "El ticket está vacío")
    .max(200),
  payments: z
    .array(
      z.object({
        method: z.enum(paymentMethodEnum.enumValues),
        amount: z.number().positive(),
        currency: z.enum(["USD", "VES"]),
        amountBs: z.number().nonnegative().optional(),
        reference: z.string().trim().max(128).optional(),
        bankName: z.string().trim().max(128).optional(),
      }),
    )
    .min(1, "Registra al menos un pago")
    .max(20),
});
export type PosCheckoutInput = z.infer<typeof posCheckoutInputSchema>;

type PosPaymentInput = PosCheckoutInput["payments"][number];

/** A payment as stored: `amount` is what the sale kept, `received` what was handed over. */
interface RecordedPosPayment extends PosPaymentInput {
  received: number;
}

/**
 * Change (vuelto) can only come out of cash. It is taken from the cash
 * payments, last one first, so each stored payment amount — and the order's
 * totalPaid — is the money the sale actually kept, which is what cash closure
 * and the sales reconciliation report count. A cash payment consumed entirely
 * by the change is not stored.
 */
function settleChange(
  payments: PosPaymentInput[],
  overpaid: number,
): RecordedPosPayment[] {
  const recorded = payments.map((p) => ({ ...p, received: p.amount }));
  let change = Math.max(0, overpaid);
  if (change <= MONEY_EPSILON) return recorded;

  const cashReceived = recorded
    .filter((p) => p.method === "cash")
    .reduce((sum, p) => sum + p.amount, 0);
  if (change > cashReceived + MONEY_EPSILON) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Solo se puede dar vuelto de pagos en efectivo: ajusta los montos de tarjeta, transferencia, pago móvil o Zelle al total de la venta",
    });
  }

  const settled = [...recorded];
  for (let i = settled.length - 1; i >= 0 && change > 0; i--) {
    const payment = settled[i];
    if (payment?.method !== "cash") continue;
    const taken = Math.min(payment.amount, change);
    settled[i] = { ...payment, amount: payment.amount - taken };
    change -= taken;
  }
  return settled.filter((p) => p.amount > MONEY_EPSILON);
}

function paymentNote(p: RecordedPosPayment): string {
  if (p.currency === "VES" && p.amountBs !== undefined) {
    return `Pago POS (Bs ${p.amountBs.toFixed(2)})`;
  }
  const change = p.received - p.amount;
  return change > MONEY_EPSILON
    ? `Pago POS (recibido $${p.received.toFixed(2)}, vuelto $${change.toFixed(2)})`
    : `Pago POS ($${p.amount.toFixed(2)})`;
}

export const listOrdersInputSchema = z.object({
  limit: z.number().int().min(1).max(100).default(25),
  offset: z.number().int().min(0).default(0),
  cursor: z.number().int().min(0).nullish(),
  search: z.string().max(256).optional(),
  status: z.enum(orderStatusEnum.enumValues).optional(),
  statuses: z.array(z.enum(orderStatusEnum.enumValues)).optional(),
  channel: z.enum(salesChannelEnum.enumValues).optional(),
  channels: z.array(z.enum(salesChannelEnum.enumValues)).optional(),
  dateFrom: z.string().datetime().or(z.date()).optional(),
  dateTo: z.string().datetime().or(z.date()).optional(),
  sort: z
    .enum([
      "createdAt:asc",
      "createdAt:desc",
      "total:asc",
      "total:desc",
      "orderNumber:asc",
      "orderNumber:desc",
    ])
    .optional(),
});
export type ListOrdersInput = z.infer<typeof listOrdersInputSchema>;

export const salesRouter = createTRPCRouter({
  // ─── Customers (PRD §17) ─────────────────────

  listCustomers: wsReadPermissionProcedure("customers", "read")
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(25),
        offset: z.number().int().min(0).default(0),
        /** Offset supplied by useInfiniteQuery; takes precedence over `offset`. */
        cursor: z.number().int().min(0).nullish(),
        customerType: z.enum(customerTypeEnum.enumValues).optional(),
        /** Name, legal name, phone or RIF/cédula (with or without dashes). */
        search: z.string().trim().max(64).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(Customer.workspaceId, ctx.workspace.workspaceId)];
      const vendorId = vendorScopeId(ctx);
      if (vendorId) {
        conditions.push(eq(Customer.assignedVendorId, vendorId));
      }
      if (input.customerType) {
        conditions.push(eq(Customer.customerType, input.customerType));
      }
      if (input.search) {
        const pattern = `%${escapeLike(input.search)}%`;
        const compactId = input.search.toUpperCase().replace(/[^A-Z0-9]/g, "");
        const searchCondition = or(
          ilike(Customer.name, pattern),
          ilike(Customer.legalName, pattern),
          ilike(Customer.phone, pattern),
          ilike(Customer.email, pattern),
          ilike(Customer.identification, pattern),
          compactId
            ? sql`upper(regexp_replace(${Customer.identification}, '[^A-Za-z0-9]', '', 'g')) LIKE ${`%${compactId}%`}`
            : undefined,
        );
        if (searchCondition) conditions.push(searchCondition);
      }
      return ctx.db
        .select({
          id: Customer.id,
          name: Customer.name,
          legalName: Customer.legalName,
          identification: Customer.identification,
          address: Customer.address,
          customerType: Customer.customerType,
          phone: Customer.phone,
          email: Customer.email,
          assignedVendorId: Customer.assignedVendorId,
          creditLimit: Customer.creditLimit,
          createdAt: Customer.createdAt,
        })
        .from(Customer)
        .where(and(...conditions))
        .orderBy(Customer.name, Customer.id)
        .limit(input.limit)
        .offset(input.cursor ?? input.offset);
    }),

  /** Directory totals, computed over every customer the caller can see. */
  customerStats: wsReadPermissionProcedure("customers", "read").query(
    async ({ ctx }) => {
      const vendorId = vendorScopeId(ctx);
      const rows = await ctx.db
        .select({
          customerType: Customer.customerType,
          count: sql<number>`count(*)::int`,
          withCredit: sql<number>`count(*) filter (where ${Customer.creditLimit} > 0)::int`,
          creditTotal: sql<number>`coalesce(sum(${Customer.creditLimit}), 0)::float8`,
        })
        .from(Customer)
        .where(
          and(
            eq(Customer.workspaceId, ctx.workspace.workspaceId),
            vendorId ? eq(Customer.assignedVendorId, vendorId) : undefined,
          ),
        )
        .groupBy(Customer.customerType);

      const byType: Partial<
        Record<(typeof rows)[number]["customerType"], number>
      > = {};
      let total = 0;
      let withCredit = 0;
      let creditTotal = 0;
      for (const row of rows) {
        byType[row.customerType] = Number(row.count);
        total += Number(row.count);
        withCredit += Number(row.withCredit);
        creditTotal += Number(row.creditTotal);
      }
      return { total, withCredit, creditTotal, byType };
    },
  ),

  customerById: wsReadPermissionProcedure("customers", "read")
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const vendorId = vendorScopeId(ctx);
      const [customer] = await ctx.db
        .select()
        .from(Customer)
        .where(
          and(
            eq(Customer.id, input.id),
            eq(Customer.workspaceId, ctx.workspace.workspaceId),
            vendorId ? eq(Customer.assignedVendorId, vendorId) : undefined,
          ),
        )
        .limit(1);
      return customer ?? null;
    }),

  /**
   * Registers a buyer with the data SENIAT requires on an invoice (name or
   * razón social, RIF / cédula / passport, domicilio fiscal — see
   * @cendaro/validators fiscal.ts). The identification is stored in
   * canonical form and is unique per workspace.
   */
  createCustomer: wsPermissionProcedure("customers", "create")
    .input(createCustomerSchema)
    .mutation(async ({ ctx, input }) => {
      const fiscalId = normalizeFiscalId(input.idType, input.identification);
      if (!fiscalId.ok) {
        // Unreachable after schema validation; kept as a server-side guard.
        throw new TRPCError({ code: "BAD_REQUEST", message: fiscalId.message });
      }

      const grantsCredit =
        (input.creditLimit ?? 0) > 0 || (input.creditDays ?? 0) > 0;
      if (grantsCredit && !can(ctx.workspace.role, "customers", "approve")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Solo la gerencia puede otorgar crédito a un cliente",
        });
      }

      const existing = await findCustomerByFiscalId(
        ctx.db,
        ctx.workspace.workspaceId,
        fiscalId.value,
      );
      if (existing) {
        throw duplicateCustomerError(
          existing.identification ?? fiscalId.value,
          existing.name,
        );
      }

      let created: typeof Customer.$inferSelect | undefined;
      try {
        [created] = await ctx.db
          .insert(Customer)
          .values({
            workspaceId: ctx.workspace.workspaceId,
            name: input.name,
            // Blank optional fields (already trimmed) are stored as NULL.
            legalName: input.legalName === "" ? undefined : input.legalName,
            identification: fiscalId.value,
            address: input.address,
            customerType: input.customerType,
            phone: input.phone === "" ? undefined : input.phone,
            email: input.email === "" ? undefined : input.email,
            creditLimit: input.creditLimit,
            creditDays: input.creditDays,
          })
          .returning();
      } catch (error) {
        // uq_customer_workspace_person_key (migration 014) closes the race
        // between the lookup above and the insert, including a cédula and
        // its personal RIF registered at the same moment.
        if (isUniqueViolation(error)) {
          throw duplicateCustomerError(fiscalId.value);
        }
        throw error;
      }

      await logAudit(ctx.db, ctx.user, {
        workspaceId: ctx.workspace.workspaceId,
        action: "customer.create",
        entity: "customer",
        entityId: created?.id,
        newValue: {
          name: input.name,
          identification: fiscalId.value,
          type: input.customerType,
        },
      });
      return created;
    }),

  /**
   * Corrects a customer's data. The payload must meet the same SENIAT buyer
   * requirements as `createCustomer`, which is how legacy or seed customers
   * with incomplete fiscal data become invoice-ready.
   */
  updateCustomer: wsPermissionProcedure("customers", "update")
    .input(updateCustomerSchema)
    .mutation(async ({ ctx, input }) => {
      const fiscalId = normalizeFiscalId(input.idType, input.identification);
      if (!fiscalId.ok) {
        // Unreachable after schema validation; kept as a server-side guard.
        throw new TRPCError({ code: "BAD_REQUEST", message: fiscalId.message });
      }

      const [current] = await ctx.db
        .select()
        .from(Customer)
        .where(
          and(
            eq(Customer.id, input.id),
            eq(Customer.workspaceId, ctx.workspace.workspaceId),
          ),
        )
        .limit(1);
      if (!current) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cliente no encontrado",
        });
      }

      if (
        changesCredit(input, current) &&
        !can(ctx.workspace.role, "customers", "approve")
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Solo la gerencia puede otorgar crédito a un cliente",
        });
      }

      // An unchanged document cannot collide (person_key is unique per
      // workspace), so only a new one is looked up for a friendly message;
      // the unique index still rejects a concurrent duplicate below.
      if (fiscalId.value !== current.identification) {
        const existing = await findCustomerByFiscalId(
          ctx.db,
          ctx.workspace.workspaceId,
          fiscalId.value,
          current.id,
        );
        if (existing) {
          throw duplicateCustomerError(
            existing.identification ?? fiscalId.value,
            existing.name,
          );
        }
      }

      const changes = {
        name: input.name,
        // Blank optional fields (already trimmed) clear the stored value.
        legalName: blankToNull(input.legalName),
        identification: fiscalId.value,
        address: input.address,
        customerType: input.customerType,
        phone: blankToNull(input.phone),
        email: blankToNull(input.email),
        creditLimit: input.creditLimit ?? current.creditLimit,
        creditDays: input.creditDays ?? current.creditDays,
      };

      let updated: typeof Customer.$inferSelect | undefined;
      try {
        [updated] = await ctx.db
          .update(Customer)
          .set(changes)
          .where(
            and(
              eq(Customer.id, current.id),
              eq(Customer.workspaceId, ctx.workspace.workspaceId),
            ),
          )
          .returning();
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw duplicateCustomerError(fiscalId.value);
        }
        throw error;
      }

      await logAudit(ctx.db, ctx.user, {
        workspaceId: ctx.workspace.workspaceId,
        action: "customer.update",
        entity: "customer",
        entityId: current.id,
        oldValue: {
          name: current.name,
          identification: current.identification,
          address: current.address,
          type: current.customerType,
          creditLimit: current.creditLimit,
          creditDays: current.creditDays,
        },
        newValue: {
          name: changes.name,
          identification: changes.identification,
          address: changes.address,
          type: changes.customerType,
          creditLimit: changes.creditLimit,
          creditDays: changes.creditDays,
        },
      });
      return updated;
    }),

  // ─── Orders (PRD §14-16) ─────────────────────

  listOrders: wsReadPermissionProcedure("orders", "read")
    .input(listOrdersInputSchema)
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(SalesOrder.workspaceId, ctx.workspace.workspaceId),
      ];
      const vendorId = vendorScopeId(ctx);
      if (vendorId) {
        conditions.push(eq(SalesOrder.createdBy, vendorId));
      }

      // Status filters (multi-status takes precedence, fallback to single status)
      if (input.statuses && input.statuses.length > 0) {
        conditions.push(inArray(SalesOrder.status, input.statuses));
      } else if (input.status) {
        conditions.push(eq(SalesOrder.status, input.status));
      }

      // Channel filters (multi-channel takes precedence, fallback to single channel)
      if (input.channels && input.channels.length > 0) {
        conditions.push(inArray(SalesOrder.channel, input.channels));
      } else if (input.channel) {
        conditions.push(eq(SalesOrder.channel, input.channel));
      }

      // Date range filters
      if (input.dateFrom) {
        const fromDate =
          typeof input.dateFrom === "string"
            ? new Date(input.dateFrom)
            : input.dateFrom;
        conditions.push(gte(SalesOrder.createdAt, fromDate));
      }
      if (input.dateTo) {
        const toDate =
          typeof input.dateTo === "string"
            ? new Date(input.dateTo)
            : input.dateTo;
        conditions.push(lte(SalesOrder.createdAt, toDate));
      }

      // Search filter (orderNumber, customer name, notes)
      if (input.search) {
        const escaped = input.search
          .replace(/\\/g, "\\\\")
          .replace(/%/g, "\\%")
          .replace(/_/g, "\\_");
        const orCond = or(
          ilike(SalesOrder.orderNumber, `%${escaped}%`),
          ilike(Customer.name, `%${escaped}%`),
          ilike(SalesOrder.notes, `%${escaped}%`),
        );
        if (orCond) conditions.push(orCond);
      }

      // Sorting
      let orderByClause = desc(SalesOrder.createdAt);
      if (input.sort) {
        switch (input.sort) {
          case "createdAt:asc":
            orderByClause = asc(SalesOrder.createdAt);
            break;
          case "createdAt:desc":
            orderByClause = desc(SalesOrder.createdAt);
            break;
          case "total:asc":
            orderByClause = asc(SalesOrder.total);
            break;
          case "total:desc":
            orderByClause = desc(SalesOrder.total);
            break;
          case "orderNumber:asc":
            orderByClause = asc(SalesOrder.orderNumber);
            break;
          case "orderNumber:desc":
            orderByClause = desc(SalesOrder.orderNumber);
            break;
        }
      }

      const where = and(...conditions);

      return ctx.db
        .select({
          id: SalesOrder.id,
          orderNumber: SalesOrder.orderNumber,
          customerId: SalesOrder.customerId,
          customerName: Customer.name,
          channel: SalesOrder.channel,
          status: SalesOrder.status,
          subtotal: SalesOrder.subtotal,
          discount: SalesOrder.discount,
          total: SalesOrder.total,
          totalPaid: SalesOrder.totalPaid,
          createdAt: SalesOrder.createdAt,
        })
        .from(SalesOrder)
        .leftJoin(Customer, eq(SalesOrder.customerId, Customer.id))
        .where(where)
        .orderBy(orderByClause)
        .limit(input.limit)
        .offset(input.cursor ?? input.offset);
    }),

  orderById: wsReadPermissionProcedure("orders", "read")
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const vendorId = vendorScopeId(ctx);
      const [order] = await ctx.db
        .select()
        .from(SalesOrder)
        .where(
          and(
            eq(SalesOrder.id, input.id),
            eq(SalesOrder.workspaceId, ctx.workspace.workspaceId),
            vendorId ? eq(SalesOrder.createdBy, vendorId) : undefined,
          ),
        )
        .limit(1);

      if (!order) return null;

      const [items, payments] = await Promise.all([
        ctx.db
          .select({
            id: OrderItem.id,
            workspaceId: OrderItem.workspaceId,
            orderId: OrderItem.orderId,
            productId: OrderItem.productId,
            productName: Product.name,
            sku: Product.sku,
            quantity: OrderItem.quantity,
            unitPrice: OrderItem.unitPrice,
            discount: OrderItem.discount,
            lineTotal: OrderItem.lineTotal,
          })
          .from(OrderItem)
          .leftJoin(Product, eq(OrderItem.productId, Product.id))
          .where(
            and(
              eq(OrderItem.orderId, input.id),
              eq(OrderItem.workspaceId, ctx.workspace.workspaceId),
            ),
          ),
        ctx.db
          .select()
          .from(Payment)
          .where(
            and(
              eq(Payment.orderId, input.id),
              eq(Payment.workspaceId, ctx.workspace.workspaceId),
            ),
          ),
      ]);

      return { ...order, items, payments };
    }),

  createOrder: wsPermissionProcedure("orders", "create")
    .input(
      z.object({
        customerId: z.string().uuid().optional(),
        channel: z.enum(salesChannelEnum.enumValues),
        notes: z.string().optional(),
        items: z.array(
          z.object({
            productId: z.string().uuid(),
            quantity: z.number().int().positive(),
            unitPrice: z.number().nonnegative(),
            discount: z.number().nonnegative().default(0),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertVendorCustomer(ctx, input.customerId);

      const subtotal = input.items.reduce(
        (sum, i) => sum + i.unitPrice * i.quantity,
        0,
      );
      const totalDiscount = input.items.reduce(
        (sum, i) => sum + i.discount * i.quantity,
        0,
      );
      const total = subtotal - totalDiscount;

      const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`;

      const [order] = await ctx.db
        .insert(SalesOrder)
        .values({
          workspaceId: ctx.workspace.workspaceId,
          orderNumber,
          customerId: input.customerId,
          channel: input.channel,
          subtotal,
          discount: totalDiscount,
          total,
          notes: input.notes,
          createdBy: ctx.user.id,
        })
        .returning();

      if (order && input.items.length > 0) {
        await ctx.db.insert(OrderItem).values(
          input.items.map((item) => ({
            workspaceId: ctx.workspace.workspaceId,
            orderId: order.id,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount,
            lineTotal: (item.unitPrice - item.discount) * item.quantity,
          })),
        );
      }

      await logAudit(ctx.db, ctx.user, {
        action: "order.create",
        entity: "sales_order",
        entityId: order?.id,
        newValue: { orderNumber, channel: input.channel, total },
      });

      return order;
    }),

  updateOrderStatus: wsPermissionProcedure("orders", "update")
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum(orderStatusEnum.enumValues),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Fetch the current order before updating
      const [currentOrder] = await ctx.db
        .select()
        .from(SalesOrder)
        .where(
          and(
            eq(SalesOrder.id, input.id),
            eq(SalesOrder.workspaceId, ctx.workspace.workspaceId),
          ),
        )
        .limit(1);

      if (!currentOrder) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Order not found in this workspace",
        });
      }

      if (input.status === "invoiced" && currentOrder.customerId) {
        await assertInvoiceReadyBuyer(ctx, currentOrder.customerId);
      }

      const [updated] = await ctx.db
        .update(SalesOrder)
        .set({ status: input.status })
        .where(
          and(
            eq(SalesOrder.id, input.id),
            eq(SalesOrder.workspaceId, ctx.workspace.workspaceId),
          ),
        )
        .returning();

      const { isClosing } = await applyStockLifecycle(
        ctx,
        currentOrder,
        input.status,
      );

      await logAudit(ctx.db, ctx.user, {
        action: `order.status_${input.status}`,
        entity: "sales_order",
        entityId: input.id,
        newValue: {
          status: input.status,
          stockDeducted:
            isClosing ||
            (currentOrder.stockDeducted &&
              !REVERT_STATUSES.includes(input.status)),
        },
      });

      return updated;
    }),

  /**
   * Completes a POS sale in one transaction (every wsPermissionProcedure
   * mutation runs inside one): the order and its lines, every payment, the
   * transition to "invoiced" with its stock deduction, and the audit trail.
   * Any failure rolls the whole sale back, so a cashier never ends up with an
   * order that is paid but not invoiced, or invoiced without its payments.
   */
  checkoutPos: wsPermissionProcedure("pos", "create")
    .input(posCheckoutInputSchema)
    .mutation(async ({ ctx, input }) => {
      await assertVendorCustomer(ctx, input.customerId);
      if (input.customerId) {
        await assertInvoiceReadyBuyer(ctx, input.customerId);
      }

      const productIds = [...new Set(input.items.map((i) => i.productId))];
      const found = await ctx.db
        .select({ id: Product.id })
        .from(Product)
        .where(
          and(
            eq(Product.workspaceId, ctx.workspace.workspaceId),
            inArray(Product.id, productIds),
          ),
        );
      if (found.length !== productIds.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Hay productos en el ticket que no existen en el catálogo de este negocio. Quítalos y vuelve a intentarlo.",
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
      if (input.items.some((i) => i.discount > i.unitPrice)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "El descuento de un artículo no puede superar su precio",
        });
      }
      const total = subtotal - discount;
      const received = input.payments.reduce((sum, p) => sum + p.amount, 0);
      if (received < total - MONEY_EPSILON) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Los pagos ($${received.toFixed(2)}) no cubren el total de la venta ($${total.toFixed(2)})`,
        });
      }
      const recorded = settleChange(input.payments, received - total);
      const totalPaid = recorded.reduce((sum, p) => sum + p.amount, 0);

      const [order] = await ctx.db
        .insert(SalesOrder)
        .values({
          workspaceId: ctx.workspace.workspaceId,
          // Empty: trg_order_number assigns the next number from its sequence,
          // so concurrent checkouts never collide on uq_order_number.
          orderNumber: "",
          customerId: input.customerId,
          channel: "store",
          subtotal,
          discount,
          total,
          totalPaid,
          notes: input.notes ?? "POS Mostrador",
          createdBy: ctx.user.id,
        })
        .returning();
      if (!order) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "No se pudo registrar la venta",
        });
      }

      await ctx.db.insert(OrderItem).values(
        input.items.map((item) => ({
          workspaceId: ctx.workspace.workspaceId,
          orderId: order.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
          lineTotal: (item.unitPrice - item.discount) * item.quantity,
        })),
      );

      const [buyer] = input.customerId
        ? await ctx.db
            .select({
              name: Customer.name,
              identification: Customer.identification,
            })
            .from(Customer)
            .where(
              and(
                eq(Customer.id, input.customerId),
                eq(Customer.workspaceId, ctx.workspace.workspaceId),
              ),
            )
            .limit(1)
        : [];

      // A zero-total sale (fully discounted) keeps no money: nothing to store.
      if (recorded.length > 0) {
        await ctx.db.insert(Payment).values(
          recorded.map((p) => ({
            workspaceId: ctx.workspace.workspaceId,
            orderId: order.id,
            method: p.method,
            amount: p.amount,
            reference: blankToNull(p.reference),
            bankName: blankToNull(p.bankName),
            payerName: buyer?.name ?? "Consumidor Final",
            payerIdDoc: buyer?.identification ?? null,
            notes: paymentNote(p),
          })),
        );
      }

      const [invoiced] = await ctx.db
        .update(SalesOrder)
        .set({ status: "invoiced" })
        .where(
          and(
            eq(SalesOrder.id, order.id),
            eq(SalesOrder.workspaceId, ctx.workspace.workspaceId),
          ),
        )
        .returning();
      await applyStockLifecycle(ctx, order, "invoiced");

      await logAudit(ctx.db, ctx.user, {
        workspaceId: ctx.workspace.workspaceId,
        action: "order.pos_checkout",
        entity: "sales_order",
        entityId: order.id,
        newValue: {
          orderNumber: order.orderNumber,
          customerId: input.customerId ?? null,
          total,
          totalPaid,
          received,
          change: Math.max(0, received - total),
          payments: recorded.map((p) => ({
            method: p.method,
            amount: p.amount,
            received: p.received,
          })),
        },
      });

      return {
        id: order.id,
        orderNumber: invoiced?.orderNumber ?? order.orderNumber,
        status: invoiced?.status ?? "invoiced",
        total,
        totalPaid,
        received,
        change: Math.max(0, received - total),
      };
    }),

  // ─── Payments (PRD §19) ──────────────────────

  listPayments: wsReadPermissionProcedure("payments", "read")
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(50),
        onlyPending: z.boolean().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(Payment.workspaceId, ctx.workspace.workspaceId)];
      if (input.onlyPending) {
        conditions.push(eq(Payment.isValidated, false));
      }

      return ctx.db
        .select({
          id: Payment.id,
          orderId: Payment.orderId,
          method: Payment.method,
          amount: Payment.amount,
          reference: Payment.reference,
          isValidated: Payment.isValidated,
          payerName: Payment.payerName,
          bankName: Payment.bankName,
          createdAt: Payment.createdAt,
        })
        .from(Payment)
        .where(and(...conditions))
        .orderBy(desc(Payment.createdAt))
        .limit(input.limit);
    }),

  addPayment: wsPermissionProcedure("payments", "create")
    .input(
      z.object({
        orderId: z.string().uuid(),
        method: z.enum(paymentMethodEnum.enumValues),
        amount: z.number().positive(),
        reference: z.string().max(128).optional(),
        bankName: z.string().max(128).optional(),
        payerName: z.string().max(256).optional(),
        payerIdDoc: z.string().max(32).optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify order belongs to current workspace
      const [order] = await ctx.db
        .select()
        .from(SalesOrder)
        .where(
          and(
            eq(SalesOrder.id, input.orderId),
            eq(SalesOrder.workspaceId, ctx.workspace.workspaceId),
          ),
        )
        .limit(1);

      if (!order) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Order not found in this workspace",
        });
      }

      const [payment] = await ctx.db
        .insert(Payment)
        .values({
          ...input,
          workspaceId: ctx.workspace.workspaceId,
        })
        .returning();

      // Update totalPaid on order
      await ctx.db
        .update(SalesOrder)
        .set({
          totalPaid: sql`COALESCE(${SalesOrder.totalPaid}, 0) + ${input.amount}`,
        })
        .where(
          and(
            eq(SalesOrder.id, input.orderId),
            eq(SalesOrder.workspaceId, ctx.workspace.workspaceId),
          ),
        );

      await logAudit(ctx.db, ctx.user, {
        action: "payment.create",
        entity: "payment",
        entityId: payment?.id,
        newValue: { method: input.method, amount: input.amount },
      });

      return payment;
    }),

  validatePayment: wsPermissionProcedure("payments", "approve")
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!["owner", "admin", "supervisor"].includes(ctx.workspace.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Insufficient permissions to validate payments",
        });
      }

      const [updated] = await ctx.db
        .update(Payment)
        .set({ isValidated: true, validatedBy: ctx.user.id })
        .where(
          and(
            eq(Payment.id, input.id),
            eq(Payment.workspaceId, ctx.workspace.workspaceId),
          ),
        )
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Payment not found in this workspace",
        });
      }

      await logAudit(ctx.db, ctx.user, {
        action: "payment.validate",
        entity: "payment",
        entityId: input.id,
      });

      return updated;
    }),

  // ─── Cash Closure (PRD §19.6) ────────────────

  listClosures: wsReadPermissionProcedure("cash_closure", "read").query(
    async ({ ctx }) => {
      return ctx.db
        .select({
          id: CashClosure.id,
          closureDate: CashClosure.closureDate,
          totalSales: CashClosure.totalSales,
          totalCash: CashClosure.totalCash,
          totalDigital: CashClosure.totalDigital,
          expectedTotal: CashClosure.expectedTotal,
          actualTotal: CashClosure.actualTotal,
          discrepancy: CashClosure.discrepancy,
          status: CashClosure.status,
        })
        .from(CashClosure)
        .where(eq(CashClosure.workspaceId, ctx.workspace.workspaceId))
        .orderBy(desc(CashClosure.closureDate))
        .limit(100);
    },
  ),

  createClosure: wsPermissionProcedure("cash_closure", "create")
    .input(
      z.object({
        closureDate: z.string().datetime(),
        totalSales: z.number().nonnegative(),
        totalCash: z.number().nonnegative(),
        totalDigital: z.number().nonnegative(),
        expectedTotal: z.number().nonnegative(),
        actualTotal: z.number().nonnegative(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const discrepancy = input.actualTotal - input.expectedTotal;
      const [closure] = await ctx.db
        .insert(CashClosure)
        .values({
          workspaceId: ctx.workspace.workspaceId,
          closureDate: new Date(input.closureDate),
          totalSales: input.totalSales,
          totalCash: input.totalCash,
          totalDigital: input.totalDigital,
          expectedTotal: input.expectedTotal,
          actualTotal: input.actualTotal,
          discrepancy,
          notes: input.notes,
          closedBy: ctx.user.id,
        })
        .returning();

      await logAudit(ctx.db, ctx.user, {
        action: "cash.close",
        entity: "cash_closure",
        entityId: closure?.id,
        newValue: {
          expectedTotal: input.expectedTotal,
          actualTotal: input.actualTotal,
          discrepancy,
        },
      });

      return closure;
    }),

  reviewClosure: wsPermissionProcedure("cash_closure", "approve")
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!["owner", "admin", "supervisor"].includes(ctx.workspace.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Insufficient permissions to review cash closures",
        });
      }

      const [updated] = await ctx.db
        .update(CashClosure)
        .set({
          status: "reviewed",
          reviewedBy: ctx.user.id,
        })
        .where(
          and(
            eq(CashClosure.id, input.id),
            eq(CashClosure.workspaceId, ctx.workspace.workspaceId),
          ),
        )
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cash closure not found in this workspace",
        });
      }

      await logAudit(ctx.db, ctx.user, {
        action: "cash.review",
        entity: "cash_closure",
        entityId: input.id,
      });

      return updated;
    }),
});
