/**
 * Cendaro — Inventory Router
 *
 * Stock management, channel allocations, movements, and cycle counts.
 * PRD §9: multichannel stock, blocking, transfers, cycle counts.
 */
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, sql, sum } from "drizzle-orm";
import { z } from "zod/v4";

import {
  ChannelAllocation,
  InventoryCount,
  InventoryCountItem,
  InventoryDiscrepancy,
  movementTypeEnum,
  Product,
  salesChannelEnum,
  StockLedger,
  StockMovement,
  Warehouse,
  warehouseTypeEnum,
} from "@cendaro/db/schema";

import {
  createTRPCRouter,
  wsPermissionProcedure,
  wsReadPermissionProcedure,
} from "../trpc";
import { logAudit } from "./audit";

export const stockOverviewInputSchema = z.object({
  limit: z.number().int().min(1).max(500).optional(),
  offset: z.number().int().min(0).default(0).optional(),
  cursor: z.number().int().min(0).nullish(),
  search: z.string().max(256).optional(),
  onlyLocked: z.boolean().optional(),
  status: z.enum(["in_stock", "low_stock", "out_of_stock", "all"]).optional(),
  statuses: z
    .array(z.enum(["in_stock", "low_stock", "out_of_stock", "all"]))
    .optional(),
  sort: z
    .enum([
      "name:asc",
      "name:desc",
      "sku:asc",
      "sku:desc",
      "totalStock:asc",
      "totalStock:desc",
    ])
    .optional(),
});
export type StockOverviewInput = z.infer<typeof stockOverviewInputSchema>;

export const warehouseStockInputSchema = z.object({
  warehouseId: z.string().uuid(),
  limit: z.number().int().min(1).max(500).optional(),
  offset: z.number().int().min(0).default(0).optional(),
  cursor: z.number().int().min(0).nullish(),
  search: z.string().max(256).optional(),
  sort: z
    .enum([
      "name:asc",
      "name:desc",
      "sku:asc",
      "sku:desc",
      "quantity:asc",
      "quantity:desc",
    ])
    .optional(),
});
export type WarehouseStockInput = z.infer<typeof warehouseStockInputSchema>;

export const inventoryRouter = createTRPCRouter({
  // ─── Warehouses ──────────────────────────────

  listWarehouses: wsReadPermissionProcedure("inventory", "read").query(
    async ({ ctx }) => {
      return ctx.db
        .select({
          id: Warehouse.id,
          name: Warehouse.name,
          type: Warehouse.type,
          location: Warehouse.location,
        })
        .from(Warehouse)
        .where(eq(Warehouse.workspaceId, ctx.workspace.workspaceId))
        .orderBy(Warehouse.name);
    },
  ),

  createWarehouse: wsPermissionProcedure("inventory", "create")
    .input(
      z.object({
        name: z.string().min(1).max(256),
        type: z.enum(warehouseTypeEnum.enumValues),
        location: z.string().max(512).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [wh] = await ctx.db
        .insert(Warehouse)
        .values({
          ...input,
          workspaceId: ctx.workspace.workspaceId,
        })
        .returning();
      await logAudit(ctx.db, ctx.user, {
        workspaceId: ctx.workspace.workspaceId,
        action: "warehouse.create",
        entity: "warehouse",
        entityId: wh?.id,
        newValue: { name: input.name, type: input.type },
      });
      return wh;
    }),

  // ─── Stock Overview (all products) ──────────

  stockOverview: wsReadPermissionProcedure("inventory", "read")
    .input(stockOverviewInputSchema)
    .query(async ({ ctx, input }) => {
      // Single SQL query with independent pre-aggregated subqueries (sl_agg and ca_agg)
      // to eliminate Cartesian multiplication across warehouses × channels.
      const searchPattern = input.search
        ? `%${input.search.toLowerCase().replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_")}%`
        : null;

      const limitVal = input.limit ?? 500;
      const offsetVal = input.cursor ?? input.offset ?? 0;

      const selectedStatuses = new Set<string>();
      if (input.statuses && input.statuses.length > 0) {
        for (const s of input.statuses) {
          if (s !== "all") selectedStatuses.add(s);
        }
      } else if (input.status && input.status !== "all") {
        selectedStatuses.add(input.status);
      }
      const hasStatusFilter = selectedStatuses.size > 0;

      const orderBySql = (() => {
        switch (input.sort) {
          case "name:asc":
            return sql`p.name ASC`;
          case "name:desc":
            return sql`p.name DESC`;
          case "sku:asc":
            return sql`p.sku ASC`;
          case "sku:desc":
            return sql`p.sku DESC`;
          case "totalStock:asc":
            return sql`COALESCE(sl_agg.total_stock, 0) ASC, p.name ASC`;
          case "totalStock:desc":
            return sql`COALESCE(sl_agg.total_stock, 0) DESC, p.name ASC`;
          default:
            return sql`p.name ASC`;
        }
      })();

      const { rows } = await ctx.db.execute<{
        id: string;
        sku: string;
        name: string;
        status: string;
        total_stock: string;
        locked: boolean;
        store_stock: string;
        ml_stock: string;
        vendor_stock: string;
      }>(sql`
        SELECT
          p.id,
          p.sku,
          p.name,
          p.status,
          COALESCE(sl_agg.total_stock, 0)::text AS total_stock,
          COALESCE(sl_agg.locked, false) AS locked,
          COALESCE(ca_agg.store_stock, 0)::text AS store_stock,
          COALESCE(ca_agg.ml_stock, 0)::text AS ml_stock,
          COALESCE(ca_agg.vendor_stock, 0)::text AS vendor_stock
        FROM product p
        LEFT JOIN (
          SELECT
            product_id,
            SUM(quantity) AS total_stock,
            BOOL_OR(is_locked) AS locked
          FROM stock_ledger
          WHERE workspace_id = ${ctx.workspace.workspaceId}
          GROUP BY product_id
        ) sl_agg ON sl_agg.product_id = p.id
        LEFT JOIN (
          SELECT
            product_id,
            SUM(CASE WHEN channel = 'store' THEN quantity ELSE 0 END) AS store_stock,
            SUM(CASE WHEN channel = 'mercadolibre' THEN quantity ELSE 0 END) AS ml_stock,
            SUM(CASE WHEN channel = 'vendors' THEN quantity ELSE 0 END) AS vendor_stock
          FROM channel_allocation
          WHERE workspace_id = ${ctx.workspace.workspaceId}
          GROUP BY product_id
        ) ca_agg ON ca_agg.product_id = p.id
        WHERE
          p.workspace_id = ${ctx.workspace.workspaceId}
          AND (${searchPattern}::text IS NULL OR (LOWER(p.name) LIKE ${searchPattern} OR LOWER(p.sku) LIKE ${searchPattern}))
          AND (${input.onlyLocked ?? false} = false OR COALESCE(sl_agg.locked, false) = true)
          AND (${!hasStatusFilter} = true OR (
            (${selectedStatuses.has("in_stock")} = true AND COALESCE(sl_agg.total_stock, 0) > 5)
            OR (${selectedStatuses.has("low_stock")} = true AND COALESCE(sl_agg.total_stock, 0) > 0 AND COALESCE(sl_agg.total_stock, 0) <= 5)
            OR (${selectedStatuses.has("out_of_stock")} = true AND COALESCE(sl_agg.total_stock, 0) <= 0)
          ))
        ORDER BY ${orderBySql}
        LIMIT ${limitVal}
        OFFSET ${offsetVal}
      `);

      return rows.map((r) => ({
        id: r.id,
        sku: r.sku,
        name: r.name,
        status: r.status,
        totalStock: Number(r.total_stock),
        locked: r.locked,
        storeStock: Number(r.store_stock),
        mlStock: Number(r.ml_stock),
        vendorStock: Number(r.vendor_stock),
      }));
    }),

  channelSummary: wsReadPermissionProcedure("inventory", "read").query(
    async ({ ctx }) => {
      const rows = await ctx.db
        .select({
          channel: ChannelAllocation.channel,
          totalStock: sum(ChannelAllocation.quantity),
        })
        .from(ChannelAllocation)
        .where(eq(ChannelAllocation.workspaceId, ctx.workspace.workspaceId))
        .groupBy(ChannelAllocation.channel);

      return rows.map((r) => ({
        channel: r.channel,
        stock: Number(r.totalStock) || 0,
      }));
    },
  ),

  // ─── Stock Overview (single product) ────────

  stockByProduct: wsReadPermissionProcedure("inventory", "read")
    .input(z.object({ productId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [ledger, channels] = await Promise.all([
        ctx.db
          .select()
          .from(StockLedger)
          .where(
            and(
              eq(StockLedger.productId, input.productId),
              eq(StockLedger.workspaceId, ctx.workspace.workspaceId),
            ),
          ),
        ctx.db
          .select()
          .from(ChannelAllocation)
          .where(
            and(
              eq(ChannelAllocation.productId, input.productId),
              eq(ChannelAllocation.workspaceId, ctx.workspace.workspaceId),
            ),
          ),
      ]);
      return { ledger, channels };
    }),

  // ─── Channel Transfers (PRD §9.4) ───────────

  transferStock: wsPermissionProcedure("inventory", "update")
    .input(
      z.object({
        productId: z.string().uuid(),
        fromChannel: z.enum(salesChannelEnum.enumValues),
        toChannel: z.enum(salesChannelEnum.enumValues),
        quantity: z.number().int().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.fromChannel === input.toChannel) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "El canal de origen y destino deben ser diferentes",
        });
      }

      // Verify product belongs to current workspace
      const [product] = await ctx.db
        .select({ id: Product.id })
        .from(Product)
        .where(
          and(
            eq(Product.id, input.productId),
            eq(Product.workspaceId, ctx.workspace.workspaceId),
          ),
        )
        .limit(1);

      if (!product) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Producto no encontrado en este espacio de trabajo",
        });
      }

      // Reject transfer if product has locked stock in any warehouse
      const [lockedRow] = await ctx.db
        .select({ id: StockLedger.id })
        .from(StockLedger)
        .where(
          and(
            eq(StockLedger.workspaceId, ctx.workspace.workspaceId),
            eq(StockLedger.productId, input.productId),
            eq(StockLedger.isLocked, true),
          ),
        )
        .limit(1);

      if (lockedRow) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "El producto tiene stock bloqueado en inventario y no puede transferirse",
        });
      }

      // Lock and verify available stock in source channel
      const [sourceAlloc] = await ctx.db
        .select({
          id: ChannelAllocation.id,
          quantity: ChannelAllocation.quantity,
        })
        .from(ChannelAllocation)
        .where(
          and(
            eq(ChannelAllocation.workspaceId, ctx.workspace.workspaceId),
            eq(ChannelAllocation.productId, input.productId),
            eq(ChannelAllocation.channel, input.fromChannel),
          ),
        )
        .limit(1)
        .for("update");

      if (!sourceAlloc || sourceAlloc.quantity < input.quantity) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Stock insuficiente en canal ${input.fromChannel}: disponible ${sourceAlloc?.quantity ?? 0}, solicitado ${input.quantity}`,
        });
      }

      // Deduct from source channel
      await ctx.db
        .update(ChannelAllocation)
        .set({ quantity: sql`quantity - ${input.quantity}` })
        .where(
          and(
            eq(ChannelAllocation.workspaceId, ctx.workspace.workspaceId),
            eq(ChannelAllocation.productId, input.productId),
            eq(ChannelAllocation.channel, input.fromChannel),
          ),
        );

      // Add to target channel (upsert)
      await ctx.db
        .insert(ChannelAllocation)
        .values({
          workspaceId: ctx.workspace.workspaceId,
          productId: input.productId,
          channel: input.toChannel,
          quantity: input.quantity,
        })
        .onConflictDoUpdate({
          target: [
            ChannelAllocation.workspaceId,
            ChannelAllocation.productId,
            ChannelAllocation.channel,
          ],
          set: {
            quantity: sql`channel_allocation.quantity + ${input.quantity}`,
          },
        });

      // Record movement for traceability
      await ctx.db.insert(StockMovement).values({
        workspaceId: ctx.workspace.workspaceId,
        productId: input.productId,
        movementType: "transfer",
        quantity: input.quantity,
        fromChannel: input.fromChannel,
        toChannel: input.toChannel,
        createdBy: ctx.user.id,
      });

      await logAudit(ctx.db, ctx.user, {
        workspaceId: ctx.workspace.workspaceId,
        action: "stock.transfer",
        entity: "stock_movement",
        entityId: input.productId,
        newValue: input,
      });

      return { success: true };
    }),

  // ─── Stock Lock/Unlock (PRD §9.5) ───────────

  toggleLock: wsPermissionProcedure("inventory", "update")
    .input(
      z.object({
        stockLedgerId: z.string().uuid(),
        isLocked: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(StockLedger)
        .set({ isLocked: input.isLocked })
        .where(
          and(
            eq(StockLedger.id, input.stockLedgerId),
            eq(StockLedger.workspaceId, ctx.workspace.workspaceId),
          ),
        )
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Stock ledger item not found in this workspace",
        });
      }

      await logAudit(ctx.db, ctx.user, {
        workspaceId: ctx.workspace.workspaceId,
        action: input.isLocked ? "stock.lock" : "stock.unlock",
        entity: "stock_ledger",
        entityId: input.stockLedgerId,
      });

      return updated;
    }),

  // ─── Movements ───────────────────────────────

  listMovements: wsReadPermissionProcedure("inventory", "read")
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(25),
        offset: z.number().int().min(0).default(0),
        productId: z.string().uuid().optional(),
        movementType: z.enum(movementTypeEnum.enumValues).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(StockMovement.workspaceId, ctx.workspace.workspaceId),
      ];

      if (input.productId) {
        conditions.push(eq(StockMovement.productId, input.productId));
      }
      if (input.movementType) {
        conditions.push(eq(StockMovement.movementType, input.movementType));
      }

      const rows = await ctx.db
        .select({
          id: StockMovement.id,
          productId: StockMovement.productId,
          movementType: StockMovement.movementType,
          quantity: StockMovement.quantity,
          fromChannel: StockMovement.fromChannel,
          toChannel: StockMovement.toChannel,
          createdBy: StockMovement.createdBy,
          createdAt: StockMovement.createdAt,
        })
        .from(StockMovement)
        .where(and(...conditions))
        .orderBy(desc(StockMovement.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return rows;
    }),

  // ─── Warehouse Detail ───────────────────────

  getWarehouseDetail: wsReadPermissionProcedure("inventory", "read")
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { rows } = await ctx.db.execute<{
        id: string;
        name: string;
        type: string;
        location: string | null;
        is_active: boolean;
        total_products: string;
        total_stock: string;
        low_stock_count: string;
        locked_count: string;
      }>(sql`
        SELECT
          w.id,
          w.name,
          w.type,
          w.location,
          w.is_active,
          COUNT(DISTINCT sl.product_id)::text AS total_products,
          COALESCE(SUM(sl.quantity), 0)::text AS total_stock,
          COUNT(DISTINCT CASE WHEN sl.quantity > 0 AND sl.quantity <= 5 THEN sl.product_id END)::text AS low_stock_count,
          COUNT(DISTINCT CASE WHEN sl.is_locked = true THEN sl.product_id END)::text AS locked_count
        FROM warehouse w
        LEFT JOIN stock_ledger sl ON sl.warehouse_id = w.id AND sl.workspace_id = ${ctx.workspace.workspaceId}
        WHERE w.id = ${input.id} AND w.workspace_id = ${ctx.workspace.workspaceId}
        GROUP BY w.id, w.name, w.type, w.location, w.is_active
      `);

      const row = rows[0];
      if (!row) return null;

      return {
        id: row.id,
        name: row.name,
        type: row.type,
        location: row.location,
        isActive: row.is_active,
        totalProducts: Number(row.total_products),
        totalStock: Number(row.total_stock),
        lowStockCount: Number(row.low_stock_count),
        lockedCount: Number(row.locked_count),
      };
    }),

  warehouseStock: wsReadPermissionProcedure("inventory", "read")
    .input(warehouseStockInputSchema)
    .query(async ({ ctx, input }) => {
      const searchPattern = input.search
        ? `%${input.search.toLowerCase().replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_")}%`
        : null;

      const limitVal = input.limit ?? 500;
      const offsetVal = input.cursor ?? input.offset ?? 0;

      const orderBySql = (() => {
        switch (input.sort) {
          case "name:asc":
            return sql`p.name ASC`;
          case "name:desc":
            return sql`p.name DESC`;
          case "sku:asc":
            return sql`p.sku ASC`;
          case "sku:desc":
            return sql`p.sku DESC`;
          case "quantity:asc":
            return sql`sl.quantity ASC, p.name ASC`;
          case "quantity:desc":
            return sql`sl.quantity DESC, p.name ASC`;
          default:
            return sql`p.name ASC`;
        }
      })();

      const { rows } = await ctx.db.execute<{
        id: string;
        product_id: string;
        product_name: string;
        product_sku: string;
        product_status: string;
        quantity: number;
        is_locked: boolean;
        updated_at: string;
      }>(sql`
        SELECT
          sl.id,
          sl.product_id,
          p.name AS product_name,
          p.sku AS product_sku,
          p.status AS product_status,
          sl.quantity,
          sl.is_locked,
          sl.updated_at::text
        FROM stock_ledger sl
        JOIN product p ON p.id = sl.product_id AND p.workspace_id = ${ctx.workspace.workspaceId}
        JOIN warehouse w ON w.id = sl.warehouse_id AND w.workspace_id = ${ctx.workspace.workspaceId}
        WHERE sl.warehouse_id = ${input.warehouseId}
          AND sl.workspace_id = ${ctx.workspace.workspaceId}
          AND (${searchPattern}::text IS NULL OR (LOWER(p.name) LIKE ${searchPattern} OR LOWER(p.sku) LIKE ${searchPattern}))
        ORDER BY ${orderBySql}
        LIMIT ${limitVal}
        OFFSET ${offsetVal}
      `);

      return rows.map((r) => ({
        id: r.id,
        productId: r.product_id,
        productName: r.product_name,
        productSku: r.product_sku,
        productStatus: r.product_status,
        quantity: r.quantity,
        isLocked: r.is_locked,
        updatedAt: r.updated_at,
      }));
    }),

  updateStockQuantity: wsPermissionProcedure("inventory", "update")
    .input(
      z.object({
        stockLedgerId: z.string().uuid(),
        newQuantity: z.number().int().min(0),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!["owner", "admin", "supervisor"].includes(ctx.workspace.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Insufficient permissions to adjust stock quantity",
        });
      }

      // Lock and read current stock_ledger row
      const [current] = await ctx.db
        .select({
          id: StockLedger.id,
          productId: StockLedger.productId,
          warehouseId: StockLedger.warehouseId,
          quantity: StockLedger.quantity,
          isLocked: StockLedger.isLocked,
        })
        .from(StockLedger)
        .where(
          and(
            eq(StockLedger.id, input.stockLedgerId),
            eq(StockLedger.workspaceId, ctx.workspace.workspaceId),
          ),
        )
        .limit(1)
        .for("update");

      if (!current) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Stock ledger item not found in this workspace",
        });
      }

      if (current.isLocked) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "El stock de este producto está bloqueado. Desbloquéalo antes de ajustar la cantidad.",
        });
      }

      const [updated] = await ctx.db
        .update(StockLedger)
        .set({ quantity: input.newQuantity, updatedAt: new Date() })
        .where(
          and(
            eq(StockLedger.id, input.stockLedgerId),
            eq(StockLedger.workspaceId, ctx.workspace.workspaceId),
          ),
        )
        .returning();

      const delta = input.newQuantity - current.quantity;
      if (delta !== 0) {
        await ctx.db.insert(StockMovement).values({
          workspaceId: ctx.workspace.workspaceId,
          productId: current.productId,
          warehouseId: current.warehouseId,
          movementType: delta > 0 ? "adjustment_in" : "adjustment_out",
          quantity: Math.abs(delta),
          referenceType: "manual_adjustment",
          referenceId: current.id,
          notes: `Ajuste manual de ${current.quantity} a ${input.newQuantity}`,
          createdBy: ctx.user.id,
        });
      }

      await logAudit(ctx.db, ctx.user, {
        workspaceId: ctx.workspace.workspaceId,
        action: "stock.manual_adjustment",
        entity: "stock_ledger",
        entityId: input.stockLedgerId,
        oldValue: { quantity: current.quantity },
        newValue: { quantity: input.newQuantity },
      });

      return updated;
    }),

  // ─── Inventory Counts (PRD §9.7) ─────────────

  listCounts: wsReadPermissionProcedure("inventory", "read").query(
    async ({ ctx }) => {
      return ctx.db
        .select({
          id: InventoryCount.id,
          warehouseId: InventoryCount.warehouseId,
          status: InventoryCount.status,
          scheduledAt: InventoryCount.scheduledAt,
          createdBy: InventoryCount.createdBy,
          createdAt: InventoryCount.createdAt,
        })
        .from(InventoryCount)
        .where(eq(InventoryCount.workspaceId, ctx.workspace.workspaceId))
        .orderBy(desc(InventoryCount.createdAt))
        .limit(100);
    },
  ),

  createCount: wsPermissionProcedure("inventory", "update")
    .input(
      z.object({
        warehouseId: z.string().uuid(),
        scheduledAt: z.string().datetime().optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify warehouse belongs to workspace
      const [warehouse] = await ctx.db
        .select({ id: Warehouse.id })
        .from(Warehouse)
        .where(
          and(
            eq(Warehouse.id, input.warehouseId),
            eq(Warehouse.workspaceId, ctx.workspace.workspaceId),
          ),
        )
        .limit(1);

      if (!warehouse) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Warehouse not found in this workspace",
        });
      }

      const [c] = await ctx.db
        .insert(InventoryCount)
        .values({
          workspaceId: ctx.workspace.workspaceId,
          warehouseId: input.warehouseId,
          scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
          notes: input.notes,
          createdBy: ctx.user.id,
        })
        .returning();

      await logAudit(ctx.db, ctx.user, {
        workspaceId: ctx.workspace.workspaceId,
        action: "count.create",
        entity: "inventory_count",
        entityId: c?.id,
      });

      return c;
    }),

  approveCount: wsPermissionProcedure("inventory", "approve")
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!["owner", "admin", "supervisor"].includes(ctx.workspace.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Insufficient permissions to approve inventory counts",
        });
      }

      const [countRecord] = await ctx.db
        .select()
        .from(InventoryCount)
        .where(
          and(
            eq(InventoryCount.id, input.id),
            eq(InventoryCount.workspaceId, ctx.workspace.workspaceId),
          ),
        )
        .limit(1)
        .for("update");

      if (!countRecord) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Inventory count not found in this workspace",
        });
      }

      if (countRecord.status === "approved") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Este conteo físico ya fue aprobado",
        });
      }

      // Apply all counted items to stock_ledger and record stock_movement
      const items = await ctx.db
        .select()
        .from(InventoryCountItem)
        .where(
          and(
            eq(InventoryCountItem.countId, input.id),
            eq(InventoryCountItem.workspaceId, ctx.workspace.workspaceId),
          ),
        );

      let adjustmentsApplied = 0;
      for (const item of items) {
        if (item.countedQty === null) continue;
        const delta = item.countedQty - item.systemQty;

        await ctx.db
          .insert(StockLedger)
          .values({
            workspaceId: ctx.workspace.workspaceId,
            productId: item.productId,
            warehouseId: countRecord.warehouseId,
            quantity: item.countedQty,
            isLocked: false,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [
              StockLedger.workspaceId,
              StockLedger.productId,
              StockLedger.warehouseId,
            ],
            set: {
              quantity: item.countedQty,
              isLocked: false,
              updatedAt: new Date(),
            },
          });

        if (delta !== 0) {
          adjustmentsApplied++;
          await ctx.db.insert(StockMovement).values({
            workspaceId: ctx.workspace.workspaceId,
            productId: item.productId,
            warehouseId: countRecord.warehouseId,
            movementType: delta > 0 ? "adjustment_in" : "adjustment_out",
            quantity: Math.abs(delta),
            referenceType: "inventory_count",
            referenceId: input.id,
            notes: `Ajuste por aprobación de conteo físico (sistema: ${item.systemQty}, contado: ${item.countedQty})`,
            createdBy: ctx.user.id,
          });
        }
      }

      // Mark any discrepancies for this count as resolved
      await ctx.db
        .update(InventoryDiscrepancy)
        .set({
          resolvedBy: ctx.user.id,
          resolvedAt: new Date(),
          resolution: "approved",
        })
        .where(
          and(
            eq(InventoryDiscrepancy.countId, input.id),
            eq(InventoryDiscrepancy.workspaceId, ctx.workspace.workspaceId),
          ),
        );

      const [updated] = await ctx.db
        .update(InventoryCount)
        .set({
          status: "approved",
          approvedBy: ctx.user.id,
          completedAt: new Date(),
        })
        .where(
          and(
            eq(InventoryCount.id, input.id),
            eq(InventoryCount.workspaceId, ctx.workspace.workspaceId),
          ),
        )
        .returning();

      await logAudit(ctx.db, ctx.user, {
        workspaceId: ctx.workspace.workspaceId,
        action: "count.approve",
        entity: "inventory_count",
        entityId: input.id,
        newValue: { adjustmentsApplied },
      });

      return updated;
    }),

  // ─── Count Items ─────────────────────────────

  listCountItems: wsReadPermissionProcedure("inventory", "read")
    .input(z.object({ countId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { rows } = await ctx.db.execute<{
        id: string;
        count_id: string;
        product_id: string;
        product_name: string;
        product_sku: string;
        system_qty: number;
        counted_qty: number | null;
        difference: number | null;
        notes: string | null;
      }>(sql`
        SELECT
          ici.id,
          ici.count_id,
          ici.product_id,
          p.name AS product_name,
          p.sku AS product_sku,
          ici.system_qty,
          ici.counted_qty,
          ici.difference,
          ici.notes
        FROM inventory_count_item ici
        JOIN product p ON p.id = ici.product_id AND p.workspace_id = ${ctx.workspace.workspaceId}
        JOIN inventory_count ic ON ic.id = ici.count_id AND ic.workspace_id = ${ctx.workspace.workspaceId}
        WHERE ici.count_id = ${input.countId}
          AND ici.workspace_id = ${ctx.workspace.workspaceId}
        ORDER BY p.name
      `);

      return rows.map((r) => ({
        id: r.id,
        countId: r.count_id,
        productId: r.product_id,
        productName: r.product_name,
        productSku: r.product_sku,
        systemQty: r.system_qty,
        countedQty: r.counted_qty,
        difference: r.difference,
        notes: r.notes,
      }));
    }),

  addCountItems: wsPermissionProcedure("inventory", "update")
    .input(
      z.object({
        countId: z.string().uuid(),
        productIds: z.array(z.string().uuid()).min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Get current system quantities from stock_ledger for the count's warehouse
      const [countRecord] = await ctx.db
        .select({ warehouseId: InventoryCount.warehouseId })
        .from(InventoryCount)
        .where(
          and(
            eq(InventoryCount.id, input.countId),
            eq(InventoryCount.workspaceId, ctx.workspace.workspaceId),
          ),
        )
        .limit(1);

      if (!countRecord) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Count not found in this workspace",
        });
      }

      const stockRows = await ctx.db
        .select({
          productId: StockLedger.productId,
          quantity: StockLedger.quantity,
        })
        .from(StockLedger)
        .where(
          and(
            eq(StockLedger.warehouseId, countRecord.warehouseId),
            eq(StockLedger.workspaceId, ctx.workspace.workspaceId),
          ),
        );

      const stockMap = new Map(stockRows.map((r) => [r.productId, r.quantity]));

      await ctx.db.insert(InventoryCountItem).values(
        input.productIds.map((productId) => ({
          workspaceId: ctx.workspace.workspaceId,
          countId: input.countId,
          productId,
          systemQty: stockMap.get(productId) ?? 0,
        })),
      );

      return { success: true, itemsAdded: input.productIds.length };
    }),

  submitCountItem: wsPermissionProcedure("inventory", "update")
    .input(
      z.object({
        itemId: z.string().uuid(),
        countedQty: z.number().int().min(0),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Get system qty to compute difference
      const [item] = await ctx.db
        .select({ systemQty: InventoryCountItem.systemQty })
        .from(InventoryCountItem)
        .where(
          and(
            eq(InventoryCountItem.id, input.itemId),
            eq(InventoryCountItem.workspaceId, ctx.workspace.workspaceId),
          ),
        )
        .limit(1);

      if (!item) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Count item not found in this workspace",
        });
      }

      const difference = input.countedQty - item.systemQty;

      const [updated] = await ctx.db
        .update(InventoryCountItem)
        .set({
          countedQty: input.countedQty,
          difference,
          notes: input.notes,
        })
        .where(
          and(
            eq(InventoryCountItem.id, input.itemId),
            eq(InventoryCountItem.workspaceId, ctx.workspace.workspaceId),
          ),
        )
        .returning();

      return updated;
    }),

  finalizeCount: wsPermissionProcedure("inventory", "approve")
    .input(z.object({ countId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Verify count belongs to workspace
      const [countRecord] = await ctx.db
        .select({
          id: InventoryCount.id,
          warehouseId: InventoryCount.warehouseId,
          status: InventoryCount.status,
        })
        .from(InventoryCount)
        .where(
          and(
            eq(InventoryCount.id, input.countId),
            eq(InventoryCount.workspaceId, ctx.workspace.workspaceId),
          ),
        )
        .limit(1);

      if (!countRecord) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Count not found in this workspace",
        });
      }

      if (
        countRecord.status === "completed" ||
        countRecord.status === "approved"
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Este conteo físico ya fue finalizado",
        });
      }

      // Get all items with discrepancies
      const items = await ctx.db
        .select()
        .from(InventoryCountItem)
        .where(
          and(
            eq(InventoryCountItem.countId, input.countId),
            eq(InventoryCountItem.workspaceId, ctx.workspace.workspaceId),
          ),
        );

      const discrepancies = items.filter(
        (item) =>
          item.countedQty !== null &&
          item.difference !== null &&
          item.difference !== 0,
      );

      // Create discrepancy records and lock affected stock in warehouse (PRD §9.7)
      if (discrepancies.length > 0) {
        await ctx.db.insert(InventoryDiscrepancy).values(
          discrepancies.map((item) => ({
            workspaceId: ctx.workspace.workspaceId,
            countId: input.countId,
            productId: item.productId,
            systemQty: item.systemQty,
            countedQty: item.countedQty ?? 0,
            difference: item.difference ?? 0,
          })),
        );

        const discrepancyProductIds = [
          ...new Set(discrepancies.map((d) => d.productId)),
        ];
        await ctx.db
          .update(StockLedger)
          .set({ isLocked: true, updatedAt: new Date() })
          .where(
            and(
              eq(StockLedger.workspaceId, ctx.workspace.workspaceId),
              eq(StockLedger.warehouseId, countRecord.warehouseId),
              inArray(StockLedger.productId, discrepancyProductIds),
            ),
          );
      }

      // Mark count as completed
      const [updated] = await ctx.db
        .update(InventoryCount)
        .set({
          status: "completed",
          completedAt: new Date(),
        })
        .where(
          and(
            eq(InventoryCount.id, input.countId),
            eq(InventoryCount.workspaceId, ctx.workspace.workspaceId),
          ),
        )
        .returning();

      await logAudit(ctx.db, ctx.user, {
        workspaceId: ctx.workspace.workspaceId,
        action: "count.finalize",
        entity: "inventory_count",
        entityId: input.countId,
        newValue: {
          totalItems: items.length,
          discrepancies: discrepancies.length,
        },
      });

      return {
        count: updated,
        totalItems: items.length,
        discrepancies: discrepancies.length,
      };
    }),

  // ─── National / Direct Supplier Purchase Receipt ───────────────

  receivePurchase: wsPermissionProcedure("inventory", "update")
    .input(
      z.object({
        warehouseId: z.string().uuid(),
        supplierId: z.string().uuid().optional(),
        invoiceNumber: z.string().min(1).max(128),
        notes: z.string().max(500).optional(),
        items: z
          .array(
            z.object({
              productId: z.string().uuid(),
              quantity: z.number().int().positive(),
              unitCostUsd: z.number().nonnegative(),
            }),
          )
          .min(1)
          .max(200),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [wh] = await ctx.db
        .select({ id: Warehouse.id })
        .from(Warehouse)
        .where(
          and(
            eq(Warehouse.id, input.warehouseId),
            eq(Warehouse.workspaceId, ctx.workspace.workspaceId),
          ),
        )
        .limit(1);

      if (!wh) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Almacén de destino no encontrado en este workspace",
        });
      }

      let totalUnits = 0;
      let totalCostUsd = 0;

      for (const item of input.items) {
        const [prod] = await ctx.db
          .select({ id: Product.id, costAvg: Product.costAvg })
          .from(Product)
          .where(
            and(
              eq(Product.id, item.productId),
              eq(Product.workspaceId, ctx.workspace.workspaceId),
            ),
          )
          .limit(1);

        if (!prod) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Producto ${item.productId} no encontrado en el catálogo`,
          });
        }

        const existingStockRows = await ctx.db
          .select({
            totalQty: sql<number>`coalesce(sum(${StockLedger.quantity}), 0)::int`,
          })
          .from(StockLedger)
          .where(
            and(
              eq(StockLedger.productId, item.productId),
              eq(StockLedger.workspaceId, ctx.workspace.workspaceId),
            ),
          );

        const existingQty = Math.max(
          0,
          Number(existingStockRows[0]?.totalQty ?? 0),
        );
        const existingCost = parseFloat(prod.costAvg ?? "0") || 0;
        const newTotalQty = existingQty + item.quantity;
        const weightedCostAvg =
          newTotalQty > 0
            ? (existingQty * existingCost + item.quantity * item.unitCostUsd) /
              newTotalQty
            : item.unitCostUsd;

        if (item.unitCostUsd > 0) {
          await ctx.db
            .update(Product)
            .set({ costAvg: weightedCostAvg.toFixed(4) })
            .where(
              and(
                eq(Product.id, item.productId),
                eq(Product.workspaceId, ctx.workspace.workspaceId),
              ),
            );
        }

        await ctx.db
          .insert(StockLedger)
          .values({
            workspaceId: ctx.workspace.workspaceId,
            productId: item.productId,
            warehouseId: input.warehouseId,
            quantity: item.quantity,
          })
          .onConflictDoUpdate({
            target: [
              StockLedger.workspaceId,
              StockLedger.productId,
              StockLedger.warehouseId,
            ],
            set: {
              quantity: sql`${StockLedger.quantity} + ${item.quantity}`,
              updatedAt: new Date(),
            },
          });

        // Synchronize store ChannelAllocation so received national purchase stock is immediately sellable at POS
        await ctx.db
          .insert(ChannelAllocation)
          .values({
            workspaceId: ctx.workspace.workspaceId,
            productId: item.productId,
            channel: "store",
            quantity: item.quantity,
          })
          .onConflictDoUpdate({
            target: [
              ChannelAllocation.workspaceId,
              ChannelAllocation.productId,
              ChannelAllocation.channel,
            ],
            set: {
              quantity: sql`${ChannelAllocation.quantity} + ${item.quantity}`,
              updatedAt: new Date(),
            },
          });

        await ctx.db.insert(StockMovement).values({
          workspaceId: ctx.workspace.workspaceId,
          productId: item.productId,
          warehouseId: input.warehouseId,
          movementType: "purchase",
          quantity: item.quantity,
          toChannel: "store",
          referenceId: input.supplierId,
          referenceType: "local_purchase",
          notes: `Compra Nacional Factura/Nota ${input.invoiceNumber}${input.notes ? ` — ${input.notes}` : ""}`,
          createdBy: ctx.user.id,
        });

        totalUnits += item.quantity;
        totalCostUsd += item.quantity * item.unitCostUsd;
      }

      await logAudit(ctx.db, ctx.user, {
        workspaceId: ctx.workspace.workspaceId,
        action: "inventory.receive_purchase",
        entity: "stock_movement",
        entityId: input.warehouseId,
        newValue: {
          warehouseId: input.warehouseId,
          supplierId: input.supplierId,
          invoiceNumber: input.invoiceNumber,
          itemsCount: input.items.length,
          totalUnits,
          totalCostUsd: Number(totalCostUsd.toFixed(2)),
        },
      });

      return {
        success: true,
        invoiceNumber: input.invoiceNumber,
        totalUnits,
        totalCostUsd: Number(totalCostUsd.toFixed(2)),
      };
    }),
});
