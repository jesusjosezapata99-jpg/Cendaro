/**
 * Cendaro — Inventory Router
 *
 * Stock management, channel allocations, movements, and cycle counts.
 * PRD §9: multichannel stock, blocking, transfers, cycle counts.
 */
import { and, desc, eq, sql, sum } from "drizzle-orm";
import { z } from "zod/v4";

import {
  ChannelAllocation,
  InventoryCount,
  InventoryCountItem,
  InventoryDiscrepancy,
  movementTypeEnum,
  salesChannelEnum,
  StockLedger,
  StockMovement,
  Warehouse,
  warehouseTypeEnum,
} from "@cendaro/db/schema";

import { createTRPCRouter, workspaceProcedure } from "../trpc";
import { logAudit } from "./audit";

export const inventoryRouter = createTRPCRouter({
  // ─── Warehouses ──────────────────────────────

  listWarehouses: workspaceProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: Warehouse.id,
        name: Warehouse.name,
        type: Warehouse.type,
        location: Warehouse.location,
      })
      .from(Warehouse)
      .orderBy(Warehouse.name);
  }),

  createWarehouse: workspaceProcedure
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

  stockOverview: workspaceProcedure
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
      const searchPattern = input.search
        ? `%${input.search.toLowerCase().replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_")}%`
        : null;

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

  channelSummary: workspaceProcedure.query(async ({ ctx }) => {
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

  stockByProduct: workspaceProcedure
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

  transferStock: workspaceProcedure
    .input(
      z.object({
        productId: z.string().uuid(),
        fromChannel: z.enum(salesChannelEnum.enumValues),
        toChannel: z.enum(salesChannelEnum.enumValues),
        quantity: z.number().int().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Deduct from source channel
      await ctx.db
        .update(ChannelAllocation)
        .set({ quantity: sql`quantity - ${input.quantity}` })
        .where(
          and(
            eq(ChannelAllocation.productId, input.productId),
            eq(ChannelAllocation.channel, input.fromChannel),
          ),
        );

      // Add to target channel (upsert)
      await ctx.db
        .insert(ChannelAllocation)
        .values({
          productId: input.productId,
          channel: input.toChannel,
          quantity: input.quantity,
        })
        .onConflictDoUpdate({
          target: [ChannelAllocation.productId, ChannelAllocation.channel],
          set: {
            quantity: sql`channel_allocation.quantity + ${input.quantity}`,
          },
        });

      // Record movement for traceability
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

  toggleLock: workspaceProcedure
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

  listMovements: workspaceProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(25),
        offset: z.number().int().min(0).default(0),
        productId: z.string().uuid().optional(),
        movementType: z.enum(movementTypeEnum.enumValues).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      let query = ctx.db
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
        .$dynamic();

      if (input.productId) {
        query = query.where(eq(StockMovement.productId, input.productId));
      }

      const rows = await query
        .orderBy(desc(StockMovement.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return rows;
    }),

  // ─── Warehouse Detail ───────────────────────

  getWarehouseDetail: workspaceProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.execute<{
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
        LEFT JOIN stock_ledger sl ON sl.warehouse_id = w.id
        WHERE w.id = ${input.id}
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

  warehouseStock: workspaceProcedure
    .input(
      z.object({
        warehouseId: z.string().uuid(),
        search: z.string().max(256).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const searchPattern = input.search
        ? `%${input.search.toLowerCase().replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_")}%`
        : null;

      const rows = await ctx.db.execute<{
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
        JOIN product p ON p.id = sl.product_id
        WHERE sl.warehouse_id = ${input.warehouseId}
          AND (${searchPattern}::text IS NULL OR (LOWER(p.name) LIKE ${searchPattern} OR LOWER(p.sku) LIKE ${searchPattern}))
        ORDER BY p.name
        LIMIT 500
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

  updateStockQuantity: workspaceProcedure
    .input(
      z.object({
        stockLedgerId: z.string().uuid(),
        newQuantity: z.number().int().min(0),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Get current value for audit
      const [current] = await ctx.db
        .select({ quantity: StockLedger.quantity })
        .from(StockLedger)
        .where(eq(StockLedger.id, input.stockLedgerId))
        .limit(1);

      const [updated] = await ctx.db
        .update(StockLedger)
        .set({ quantity: input.newQuantity })
        .where(eq(StockLedger.id, input.stockLedgerId))
        .returning();

      await logAudit(ctx.db, ctx.user, {
        action: "stock.manual_adjustment",
        entity: "stock_ledger",
        entityId: input.stockLedgerId,
        oldValue: { quantity: current?.quantity },
        newValue: { quantity: input.newQuantity },
      });

      return updated;
    }),

  // ─── Inventory Counts (PRD §9.7) ─────────────

  listCounts: workspaceProcedure.query(async ({ ctx }) => {
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

  createCount: workspaceProcedure
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

  approveCount: workspaceProcedure
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

  // ─── Count Items ─────────────────────────────

  listCountItems: workspaceProcedure
    .input(z.object({ countId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.execute<{
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
        JOIN product p ON p.id = ici.product_id
        WHERE ici.count_id = ${input.countId}
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

  addCountItems: workspaceProcedure
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
        .where(eq(InventoryCount.id, input.countId))
        .limit(1);

      if (!countRecord) throw new Error("Count not found");

      const stockRows = await ctx.db
        .select({
          productId: StockLedger.productId,
          quantity: StockLedger.quantity,
        })
        .from(StockLedger)
        .where(eq(StockLedger.warehouseId, countRecord.warehouseId));

      const stockMap = new Map(stockRows.map((r) => [r.productId, r.quantity]));

      await ctx.db.insert(InventoryCountItem).values(
        input.productIds.map((productId) => ({
          countId: input.countId,
          productId,
          systemQty: stockMap.get(productId) ?? 0,
        })),
      );

      return { success: true, itemsAdded: input.productIds.length };
    }),

  submitCountItem: workspaceProcedure
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
        .where(eq(InventoryCountItem.id, input.itemId))
        .limit(1);

      const difference = input.countedQty - (item?.systemQty ?? 0);

      const [updated] = await ctx.db
        .update(InventoryCountItem)
        .set({
          countedQty: input.countedQty,
          difference,
          notes: input.notes,
        })
        .where(eq(InventoryCountItem.id, input.itemId))
        .returning();

      return updated;
    }),

  finalizeCount: workspaceProcedure
    .input(z.object({ countId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Get all items with discrepancies
      const items = await ctx.db
        .select()
        .from(InventoryCountItem)
        .where(eq(InventoryCountItem.countId, input.countId));

      const discrepancies = items.filter(
        (item) =>
          item.countedQty !== null &&
          item.difference !== null &&
          item.difference !== 0,
      );

      // Create discrepancy records
      if (discrepancies.length > 0) {
        await ctx.db.insert(InventoryDiscrepancy).values(
          discrepancies.map((item) => ({
            countId: input.countId,
            productId: item.productId,
            systemQty: item.systemQty,
            countedQty: item.countedQty ?? 0,
            difference: item.difference ?? 0,
          })),
        );
      }

      // Mark count as completed
      const [updated] = await ctx.db
        .update(InventoryCount)
        .set({
          status: "completed",
          completedAt: new Date(),
        })
        .where(eq(InventoryCount.id, input.countId))
        .returning();

      await logAudit(ctx.db, ctx.user, {
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
});
