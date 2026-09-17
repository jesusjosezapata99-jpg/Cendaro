/**
 * Cendaro — Inventory Router
 *
 * Stock management, channel allocations, movements, and cycle counts.
 * PRD §9: multichannel stock, blocking, transfers, cycle counts.
 */
import { TRPCError } from "@trpc/server";
import { and, desc, eq, sql, sum } from "drizzle-orm";
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
      // Single SQL query with LEFT JOIN + GROUP BY — pushes all aggregation
      // to the database instead of loading all rows into JS memory.
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
            return sql`COALESCE(SUM(sl.quantity), 0) ASC, p.name ASC`;
          case "totalStock:desc":
            return sql`COALESCE(SUM(sl.quantity), 0) DESC, p.name ASC`;
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
          COALESCE(SUM(sl.quantity), 0)::text AS total_stock,
          COALESCE(BOOL_OR(sl.is_locked), false) AS locked,
          COALESCE(SUM(CASE WHEN ca.channel = 'store' THEN ca.quantity ELSE 0 END), 0)::text AS store_stock,
          COALESCE(SUM(CASE WHEN ca.channel = 'mercadolibre' THEN ca.quantity ELSE 0 END), 0)::text AS ml_stock,
          COALESCE(SUM(CASE WHEN ca.channel = 'vendors' THEN ca.quantity ELSE 0 END), 0)::text AS vendor_stock
        FROM product p
        LEFT JOIN stock_ledger sl ON sl.product_id = p.id AND sl.workspace_id = ${ctx.workspace.workspaceId}
        LEFT JOIN channel_allocation ca ON ca.product_id = p.id AND ca.workspace_id = ${ctx.workspace.workspaceId}
        WHERE
          p.workspace_id = ${ctx.workspace.workspaceId}
          AND (${searchPattern}::text IS NULL OR (LOWER(p.name) LIKE ${searchPattern} OR LOWER(p.sku) LIKE ${searchPattern}))
          AND (${input.onlyLocked ?? false} = false OR EXISTS (
            SELECT 1 FROM stock_ledger sl2 WHERE sl2.product_id = p.id AND sl2.is_locked = true AND sl2.workspace_id = ${ctx.workspace.workspaceId}
          ))
        GROUP BY p.id, p.sku, p.name, p.status
        HAVING (${!hasStatusFilter} = true OR (
          (${selectedStatuses.has("in_stock")} = true AND COALESCE(SUM(sl.quantity), 0) > 5)
          OR (${selectedStatuses.has("low_stock")} = true AND COALESCE(SUM(sl.quantity), 0) > 0 AND COALESCE(SUM(sl.quantity), 0) <= 5)
          OR (${selectedStatuses.has("out_of_stock")} = true AND COALESCE(SUM(sl.quantity), 0) <= 0)
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
          message: "Product not found in this workspace",
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

      // Get current value for audit
      const [current] = await ctx.db
        .select({ quantity: StockLedger.quantity })
        .from(StockLedger)
        .where(
          and(
            eq(StockLedger.id, input.stockLedgerId),
            eq(StockLedger.workspaceId, ctx.workspace.workspaceId),
          ),
        )
        .limit(1);

      if (!current) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Stock ledger item not found in this workspace",
        });
      }

      const [updated] = await ctx.db
        .update(StockLedger)
        .set({ quantity: input.newQuantity })
        .where(
          and(
            eq(StockLedger.id, input.stockLedgerId),
            eq(StockLedger.workspaceId, ctx.workspace.workspaceId),
          ),
        )
        .returning();

      await logAudit(ctx.db, ctx.user, {
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

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Inventory count not found in this workspace",
        });
      }

      await logAudit(ctx.db, ctx.user, {
        action: "count.approve",
        entity: "inventory_count",
        entityId: input.id,
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
        .select({ id: InventoryCount.id })
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

      // Create discrepancy records
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
