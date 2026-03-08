/**
 * Cendaro — Inventory Router
 *
 * Stock management, channel allocations, movements, and cycle counts.
 * PRD §9: multichannel stock, blocking, transfers, cycle counts.
 */
import { z } from "zod/v4";
import { desc, eq, sum, sql } from "drizzle-orm";

import {
  StockLedger,
  ChannelAllocation,
  StockMovement,
  Warehouse,
  InventoryCount,
  warehouseTypeEnum,
  salesChannelEnum,
  movementTypeEnum,
} from "@cendaro/db/schema";

import {
  createTRPCRouter,
  protectedProcedure,
  roleRestrictedProcedure,
} from "../trpc";
import { logAudit } from "./audit";

export const inventoryRouter = createTRPCRouter({
  // ─── Warehouses ──────────────────────────────

  listWarehouses: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.select({
      id: Warehouse.id,
      name: Warehouse.name,
      type: Warehouse.type,
      location: Warehouse.location,
    }).from(Warehouse).orderBy(Warehouse.name);
  }),

  createWarehouse: roleRestrictedProcedure(["owner", "admin"])
    .input(
      z.object({
        name: z.string().min(1).max(256),
        type: z.enum(warehouseTypeEnum.enumValues),
        location: z.string().max(512).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [wh] = await ctx.db.insert(Warehouse).values(input).returning();
      await logAudit(ctx.db, ctx.user, {
        action: "warehouse.create",
        entity: "warehouse",
        entityId: wh?.id,
        newValue: { name: input.name, type: input.type },
      });
      return wh;
    }),

  // ─── Stock Overview (all products) ──────────

  stockOverview: protectedProcedure
    .input(
      z.object({
        search: z.string().max(256).optional(),
        onlyLocked: z.boolean().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Single SQL query with LEFT JOIN + GROUP BY — pushes all aggregation
      // to the database instead of loading all rows into JS memory.
      // Before: 3 queries + 10K+ rows transferred + JS Maps → 6.18s
      // After:  1 query + 500 aggregated rows → <100ms
      const searchPattern = input.search ? `%${input.search.toLowerCase()}%` : null;

      const rows = await ctx.db.execute<{
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
          COALESCE(SUM(sl.quantity), 0)::text AS total_stock,
          COALESCE(BOOL_OR(sl.is_locked), false) AS locked,
          COALESCE(SUM(CASE WHEN ca.channel = 'store' THEN ca.quantity ELSE 0 END), 0)::text AS store_stock,
          COALESCE(SUM(CASE WHEN ca.channel = 'mercadolibre' THEN ca.quantity ELSE 0 END), 0)::text AS ml_stock,
          COALESCE(SUM(CASE WHEN ca.channel = 'vendors' THEN ca.quantity ELSE 0 END), 0)::text AS vendor_stock
        FROM product p
        LEFT JOIN stock_ledger sl ON sl.product_id = p.id
        LEFT JOIN channel_allocation ca ON ca.product_id = p.id
        WHERE
          (${searchPattern}::text IS NULL OR (LOWER(p.name) LIKE ${searchPattern} OR LOWER(p.sku) LIKE ${searchPattern}))
          AND (${input.onlyLocked ?? false} = false OR EXISTS (
            SELECT 1 FROM stock_ledger sl2 WHERE sl2.product_id = p.id AND sl2.is_locked = true
          ))
        GROUP BY p.id, p.sku, p.name, p.status
        ORDER BY p.name
        LIMIT 500
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

  channelSummary: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        channel: ChannelAllocation.channel,
        totalStock: sum(ChannelAllocation.quantity),
      })
      .from(ChannelAllocation)
      .groupBy(ChannelAllocation.channel);

    return rows.map((r) => ({
      channel: r.channel,
      stock: Number(r.totalStock) || 0,
    }));
  }),

  // ─── Stock Overview (single product) ────────

  stockByProduct: protectedProcedure
    .input(z.object({ productId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [ledger, channels] = await Promise.all([
        ctx.db
          .select()
          .from(StockLedger)
          .where(eq(StockLedger.productId, input.productId)),
        ctx.db
          .select()
          .from(ChannelAllocation)
          .where(eq(ChannelAllocation.productId, input.productId)),
      ]);
      return { ledger, channels };
    }),

  // ─── Channel Transfers (PRD §9.4) ───────────

  transferStock: roleRestrictedProcedure(["owner", "admin", "supervisor"])
    .input(
      z.object({
        productId: z.string().uuid(),
        fromChannel: z.enum(salesChannelEnum.enumValues),
        toChannel: z.enum(salesChannelEnum.enumValues),
        quantity: z.number().int().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db.insert(StockMovement).values({
        productId: input.productId,
        movementType: "transfer",
        quantity: input.quantity,
        fromChannel: input.fromChannel,
        toChannel: input.toChannel,
        createdBy: ctx.user.id,
      });

      await logAudit(ctx.db, ctx.user, {
        action: "stock.transfer",
        entity: "stock_movement",
        entityId: input.productId,
        newValue: input,
      });

      return { success: true };
    }),

  // ─── Stock Lock/Unlock (PRD §9.5) ───────────

  toggleLock: roleRestrictedProcedure(["owner", "admin", "supervisor"])
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
        .where(eq(StockLedger.id, input.stockLedgerId))
        .returning();

      await logAudit(ctx.db, ctx.user, {
        action: input.isLocked ? "stock.lock" : "stock.unlock",
        entity: "stock_ledger",
        entityId: input.stockLedgerId,
      });

      return updated;
    }),

  // ─── Movements ───────────────────────────────

  listMovements: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(25),
        offset: z.number().int().min(0).default(0),
        productId: z.string().uuid().optional(),
        movementType: z.enum(movementTypeEnum.enumValues).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      let query = ctx.db.select({
        id: StockMovement.id,
        productId: StockMovement.productId,
        movementType: StockMovement.movementType,
        quantity: StockMovement.quantity,
        fromChannel: StockMovement.fromChannel,
        toChannel: StockMovement.toChannel,
        createdBy: StockMovement.createdBy,
        createdAt: StockMovement.createdAt,
      }).from(StockMovement).$dynamic();

      if (input.productId) {
        query = query.where(eq(StockMovement.productId, input.productId));
      }

      const rows = await query
        .orderBy(desc(StockMovement.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return rows;
    }),

  // ─── Inventory Counts (PRD §9.7) ─────────────

  listCounts: protectedProcedure.query(async ({ ctx }) => {
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
      .orderBy(desc(InventoryCount.createdAt))
      .limit(100);
  }),

  createCount: roleRestrictedProcedure(["owner", "admin", "supervisor"])
    .input(
      z.object({
        warehouseId: z.string().uuid(),
        scheduledAt: z.string().datetime().optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [c] = await ctx.db
        .insert(InventoryCount)
        .values({
          warehouseId: input.warehouseId,
          scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
          notes: input.notes,
          createdBy: ctx.user.id,
        })
        .returning();

      await logAudit(ctx.db, ctx.user, {
        action: "count.create",
        entity: "inventory_count",
        entityId: c?.id,
      });

      return c;
    }),

  approveCount: roleRestrictedProcedure(["owner", "admin"])
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(InventoryCount)
        .set({
          status: "approved",
          approvedBy: ctx.user.id,
          completedAt: new Date(),
        })
        .where(eq(InventoryCount.id, input.id))
        .returning();

      await logAudit(ctx.db, ctx.user, {
        action: "count.approve",
        entity: "inventory_count",
        entityId: input.id,
      });

      return updated;
    }),
});
