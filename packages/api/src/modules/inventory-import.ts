/**
 * Cendaro — Inventory Import Router
 *
 * Bulk import of inventory stock quantities from .xlsx files.
 * Supports Replace (absolute), Adjust (delta), and Initialize (create catalog + stock) modes.
 *
 * PRD: FEATURE_PRD_INVENTORY_IMPORT.md §10, §14, §16, §23
 */
import { TRPCError } from "@trpc/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod/v4";

import {
  AuditLog,
  Brand,
  Product,
  StockLedger,
  StockMovement,
  Warehouse,
} from "@cendaro/db/schema";

import { createTRPCRouter, workspaceProcedure } from "../trpc";
import { logAudit } from "./audit";

// ── Import Mode ───────────────────────────────────
export const importModeSchema = z.enum(["replace", "adjust", "initialize"]);
export type ImportMode = z.infer<typeof importModeSchema>;

// ── Single Row (client → server) ──────────────────
export const inventoryImportRowSchema = z.object({
  /** 1-indexed row number from the original spreadsheet */
  rowNumber: z.int().min(1),
  /** Product SKU (must exist in Product table) */
  sku: z.string().min(1).max(64),
  /** Target quantity (Replace: absolute | Adjust: delta) */
  quantity: z.int(),
  /** Resolved product ID (populated during client-side validation) */
  productId: z.string().uuid(),
  /** Current stock quantity (populated during client-side validation) */
  currentQuantity: z.int().min(0),
});
export type InventoryImportRow = z.infer<typeof inventoryImportRowSchema>;

// ── Validation Result (client-side) ───────────────
export const rowValidationStatus = z.enum(["valid", "warning", "error"]);

export const validatedRowSchema = inventoryImportRowSchema.extend({
  status: rowValidationStatus,
  /** Human-readable validation message */
  message: z.string().optional(),
  /** Resolved product name (for display) */
  productName: z.string().optional(),
  /** Whether the product is locked in the target warehouse */
  isLocked: z.boolean().default(false),
});
export type ValidatedRow = z.infer<typeof validatedRowSchema>;

// ── Commit Request ────────────────────────────────
export const inventoryImportCommitSchema = z.object({
  /** Target warehouse UUID */
  warehouseId: z.string().uuid(),
  /** Import mode */
  mode: importModeSchema,
  /** Validated rows to commit (only status = 'valid') */
  rows: z.array(inventoryImportRowSchema).min(1).max(10000),
  /** Original filename for audit logging */
  filename: z.string().max(256),
  /** Idempotency key to prevent double submits */
  idempotencyKey: z.string().uuid(),
  /** Whether to force-update locked products (requires owner/admin) */
  forceLocked: z.boolean().default(false),
});
export type InventoryImportCommit = z.infer<typeof inventoryImportCommitSchema>;

// ── Commit Result ─────────────────────────────────
export const importResultSchema = z.object({
  /** Number of rows successfully committed */
  committed: z.int().min(0),
  /** Number of rows skipped (locked, duplicate, etc.) */
  skipped: z.int().min(0),
  /** Number of rows that failed during commit */
  failed: z.int().min(0),
  /** Total quantity delta applied */
  totalDelta: z.int(),
  /** Error details for failed rows */
  errors: z.array(
    z.object({
      rowNumber: z.int(),
      sku: z.string(),
      code: z.string(),
      message: z.string(),
    }),
  ),
  /** Audit log entry ID */
  auditLogId: z.string().uuid().optional(),
});
export type ImportResult = z.infer<typeof importResultSchema>;

// ── Initialize Mode Schemas ──────────────────────

/** Single row for Initialize import (client → server) */
export const initializeRowSchema = z.object({
  /** 1-indexed row number from the original spreadsheet */
  rowNumber: z.int().min(1),
  /** Brand name (will be created if not exists) */
  brand: z.string().min(1).max(256),
  /** Product SKU (must be unique) */
  sku: z.string().min(1).max(64),
  /** Product name */
  productName: z.string().min(1).max(512),
  /** Number of bultos */
  bultos: z.int().min(0),
  /** Cajas per bulto (null = no inner boxes) */
  cajasPerBulk: z.int().min(1).nullable().default(null),
  /** Units per caja */
  unidPerCaja: z.int().min(1).nullable().default(null),
  /** Presentation quantity */
  presentacion: z.int().min(1).default(1),
  /** Total units (pre-calculated by client) */
  totalUnits: z.int().min(0),
});
export type InitializeRow = z.infer<typeof initializeRowSchema>;

/** Commit request for Initialize mode */
export const initializeCommitSchema = z.object({
  /** Target warehouse UUID */
  warehouseId: z.string().uuid(),
  /** Validated rows to commit */
  rows: z.array(initializeRowSchema).min(1).max(10000),
  /** Original filename for audit logging */
  filename: z.string().max(256),
  /** Idempotency key to prevent double submits */
  idempotencyKey: z.string().uuid(),
});
export type InitializeCommitInput = z.infer<typeof initializeCommitSchema>;

/** Result of an Initialize import */
export const initializeResultSchema = z.object({
  /** Number of brands created */
  brandsCreated: z.int().min(0),
  /** Number of products created */
  productsCreated: z.int().min(0),
  /** Number of stock entries committed */
  stockEntries: z.int().min(0),
  /** Number of rows skipped */
  skipped: z.int().min(0),
  /** Number of rows that failed */
  failed: z.int().min(0),
  /** Total units initialized */
  totalUnits: z.int().min(0),
  /** Error details */
  errors: z.array(
    z.object({
      rowNumber: z.int(),
      sku: z.string(),
      code: z.string(),
      message: z.string(),
    }),
  ),
  /** Audit log entry ID */
  auditLogId: z.string().uuid().optional(),
});
export type InitializeResult = z.infer<typeof initializeResultSchema>;

// ── Helpers ───────────────────────────────────────

/** Generate a URL-safe slug from a brand name */
function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ── Router ────────────────────────────────────────

export const inventoryImportRouter = createTRPCRouter({
  /**
   * Pre-fetch all products + current stock for a warehouse.
   * Used by the client to build productMap + stockMap for validation.
   *
   * RBAC: owner, admin, supervisor (PRD §4)
   */
  getWarehouseProducts: workspaceProcedure
    .input(z.object({ warehouseId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.execute<{
        id: string;
        sku: string;
        name: string;
        brand_name: string;
        units_per_box: number | null;
        boxes_per_bulk: number | null;
        presentation_qty: number;
        quantity: number;
        is_locked: boolean;
      }>(sql`
        SELECT p.id, p.sku, p.name,
          COALESCE(b.name, '') AS brand_name,
          p.units_per_box,
          p.boxes_per_bulk,
          p.presentation_qty,
          COALESCE(sl.quantity, 0)::int AS quantity,
          COALESCE(sl.is_locked, false) AS is_locked
        FROM product p
        LEFT JOIN brand b ON b.id = p.brand_id
        LEFT JOIN stock_ledger sl
          ON sl.product_id = p.id AND sl.warehouse_id = ${input.warehouseId}
        WHERE p.status != 'discontinued'
        ORDER BY b.name NULLS LAST, p.sku
      `);

      return rows.map((r) => ({
        id: r.id,
        sku: r.sku,
        name: r.name,
        brandName: r.brand_name,
        unitsPerBox: r.units_per_box,
        boxesPerBulk: r.boxes_per_bulk,
        presentationQty: r.presentation_qty,
        quantity: r.quantity,
        isLocked: r.is_locked,
      }));
    }),

  /**
   * Commit validated import rows to the database.
   * Batched UPSERT to StockLedger + INSERT StockMovement + AuditLog.
   *
   * RBAC: owner, admin only (PRD §4)
   */
  commit: workspaceProcedure
    .input(inventoryImportCommitSchema)
    .mutation(async ({ ctx, input }) => {
      // 1. Validate warehouse exists and is active
      const [wh] = await ctx.db
        .select({ id: Warehouse.id, isActive: Warehouse.isActive })
        .from(Warehouse)
        .where(eq(Warehouse.id, input.warehouseId))
        .limit(1);

      if (!wh?.isActive) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Almacén no está activo",
        });
      }

      // 2. Idempotency check — search AuditLog for existing idempotency key
      const existingAudit = await ctx.db
        .select({ id: AuditLog.id, newValue: AuditLog.newValue })
        .from(AuditLog)
        .where(
          and(
            eq(AuditLog.action, "inventory.bulk_import"),
            eq(AuditLog.entity, "inventory_import"),
          ),
        )
        .limit(100);

      const previousResult = existingAudit.find((a) => {
        const val = a.newValue as Record<string, unknown> | null;
        return val?.idempotencyKey === input.idempotencyKey;
      });

      if (previousResult) {
        const val = previousResult.newValue as Record<string, unknown> | null;
        return {
          committed: Number(val?.committed ?? 0),
          skipped: Number(val?.skipped ?? 0),
          failed: Number(val?.failed ?? 0),
          totalDelta: Number(val?.totalDelta ?? 0),
          errors: [] as {
            rowNumber: number;
            sku: string;
            code: string;
            message: string;
          }[],
          auditLogId: previousResult.id,
        };
      }

      // 3. Process rows in batches of 100
      const BATCH_SIZE = 100;
      let committed = 0;
      let skipped = 0;
      let failed = 0;
      let totalDelta = 0;
      const errors: {
        rowNumber: number;
        sku: string;
        code: string;
        message: string;
      }[] = [];

      for (let i = 0; i < input.rows.length; i += BATCH_SIZE) {
        const batch = input.rows.slice(i, i + BATCH_SIZE);

        await ctx.db.transaction(async (tx) => {
          for (const row of batch) {
            try {
              // Re-check lock status on server (PRD §17: Locked product bypass)
              if (!input.forceLocked) {
                const [sl] = await tx
                  .select({ isLocked: StockLedger.isLocked })
                  .from(StockLedger)
                  .where(
                    and(
                      eq(StockLedger.productId, row.productId),
                      eq(StockLedger.warehouseId, input.warehouseId),
                    ),
                  )
                  .limit(1);

                if (sl?.isLocked) {
                  skipped++;
                  continue;
                }
              }

              // Verify product exists
              const [product] = await tx
                .select({ id: Product.id })
                .from(Product)
                .where(eq(Product.id, row.productId))
                .limit(1);

              if (!product) {
                errors.push({
                  rowNumber: row.rowNumber,
                  sku: row.sku,
                  code: "PRODUCT_NOT_FOUND",
                  message: `Producto con SKU "${row.sku}" no encontrado`,
                });
                failed++;
                continue;
              }

              // Compute delta and new quantity
              const delta =
                input.mode === "replace"
                  ? row.quantity - row.currentQuantity
                  : row.quantity;

              const newQuantity =
                input.mode === "replace"
                  ? row.quantity
                  : row.currentQuantity + row.quantity;

              // Validate non-negative result
              if (newQuantity < 0) {
                errors.push({
                  rowNumber: row.rowNumber,
                  sku: row.sku,
                  code: "NEGATIVE_RESULT",
                  message: `La cantidad resultante sería negativa (${newQuantity})`,
                });
                failed++;
                continue;
              }

              // Upsert StockLedger
              await tx
                .insert(StockLedger)
                .values({
                  productId: row.productId,
                  warehouseId: input.warehouseId,
                  quantity: newQuantity,
                })
                .onConflictDoUpdate({
                  target: [StockLedger.productId, StockLedger.warehouseId],
                  set: { quantity: newQuantity },
                });

              // Record StockMovement
              await tx.insert(StockMovement).values({
                productId: row.productId,
                movementType: delta >= 0 ? "adjustment_in" : "adjustment_out",
                quantity: Math.abs(delta),
                warehouseId: input.warehouseId,
                referenceType: "inventory_import",
                notes: `Import ${input.mode}: ${row.sku}`,
                createdBy: ctx.user.id,
              });

              totalDelta += delta;
              committed++;
            } catch {
              // Individual row failure — record and continue
              errors.push({
                rowNumber: row.rowNumber,
                sku: row.sku,
                code: "COMMIT_ERROR",
                message: "Error al escribir en la base de datos",
              });
              failed++;
            }
          }
        });
      }

      // 4. Audit log
      const auditPayload = {
        warehouseId: input.warehouseId,
        mode: input.mode,
        filename: input.filename,
        idempotencyKey: input.idempotencyKey,
        committed,
        skipped,
        failed,
        totalDelta,
      };

      await logAudit(ctx.db, ctx.user, {
        action: "inventory.bulk_import",
        entity: "inventory_import",
        entityId: input.warehouseId,
        newValue: auditPayload,
      });

      // 5. Get the audit log ID for reference
      const [auditEntry] = await ctx.db
        .select({ id: AuditLog.id })
        .from(AuditLog)
        .where(
          and(
            eq(AuditLog.action, "inventory.bulk_import"),
            eq(AuditLog.entity, "inventory_import"),
            eq(AuditLog.entityId, input.warehouseId),
          ),
        )
        .orderBy(sql`${AuditLog.createdAt} DESC`)
        .limit(1);

      return {
        committed,
        skipped,
        failed,
        totalDelta,
        errors,
        auditLogId: auditEntry?.id,
      };
    }),

  /**
   * Initialize import — create brands + products + stock from scratch.
   * Used for first-time inventory setup or periodic full reset.
   *
   * Flow: Batch INSERT brands → Batch INSERT products → Batch UPSERT stock → Audit
   *
   * RBAC: owner, admin only
   */
  initializeCommit: workspaceProcedure
    .input(initializeCommitSchema)
    .mutation(async ({ ctx, input }) => {
      // 1. Validate warehouse exists and is active
      const [wh] = await ctx.db
        .select({ id: Warehouse.id, isActive: Warehouse.isActive })
        .from(Warehouse)
        .where(eq(Warehouse.id, input.warehouseId))
        .limit(1);

      if (!wh?.isActive) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Almacén no está activo",
        });
      }

      // 2. Idempotency check
      const existingAudit = await ctx.db
        .select({ id: AuditLog.id, newValue: AuditLog.newValue })
        .from(AuditLog)
        .where(
          and(
            eq(AuditLog.action, "inventory.initialize_import"),
            eq(AuditLog.entity, "inventory_import"),
          ),
        )
        .limit(100);

      const previousResult = existingAudit.find((a) => {
        const val = a.newValue as Record<string, unknown> | null;
        return val?.idempotencyKey === input.idempotencyKey;
      });

      if (previousResult) {
        const val = previousResult.newValue as Record<string, unknown> | null;
        return {
          brandsCreated: Number(val?.brandsCreated ?? 0),
          productsCreated: Number(val?.productsCreated ?? 0),
          stockEntries: Number(val?.stockEntries ?? 0),
          skipped: Number(val?.skipped ?? 0),
          failed: Number(val?.failed ?? 0),
          totalUnits: Number(val?.totalUnits ?? 0),
          errors: [] as {
            rowNumber: number;
            sku: string;
            code: string;
            message: string;
          }[],
          auditLogId: previousResult.id,
        };
      }

      // 3. Extract unique brands and create them
      const uniqueBrands = [...new Set(input.rows.map((r) => r.brand))];

      const brandMap = new Map<string, string>(); // name → id
      let brandsCreated = 0;

      for (const brandName of uniqueBrands) {
        const slug = slugify(brandName);
        if (!slug) continue;

        // Check if brand already exists (by slug)
        const [existing] = await ctx.db
          .select({ id: Brand.id, name: Brand.name })
          .from(Brand)
          .where(eq(Brand.slug, slug))
          .limit(1);

        if (existing) {
          brandMap.set(brandName, existing.id);
        } else {
          const [created] = await ctx.db
            .insert(Brand)
            .values({ name: brandName, slug })
            .returning({ id: Brand.id });
          if (created) {
            brandMap.set(brandName, created.id);
            brandsCreated++;
          }
        }
      }

      // 4. Process rows in batches — create products + stock
      const BATCH_SIZE = 100;
      let productsCreated = 0;
      let stockEntries = 0;
      let skipped = 0;
      let failed = 0;
      let totalUnits = 0;
      const errors: {
        rowNumber: number;
        sku: string;
        code: string;
        message: string;
      }[] = [];

      // Deduplicate: keep last occurrence of each SKU
      const skuLastRow = new Map<string, number>();
      for (let i = 0; i < input.rows.length; i++) {
        const row = input.rows[i];
        if (row) skuLastRow.set(row.sku.toUpperCase(), i);
      }

      for (let i = 0; i < input.rows.length; i += BATCH_SIZE) {
        const batch = input.rows.slice(i, i + BATCH_SIZE);

        await ctx.db.transaction(async (tx) => {
          for (const row of batch) {
            try {
              // Skip duplicate SKUs (keep last occurrence only)
              const rowIndex = input.rows.indexOf(row);
              const lastIndex = skuLastRow.get(row.sku.toUpperCase());
              if (lastIndex !== undefined && rowIndex !== lastIndex) {
                skipped++;
                continue;
              }

              const brandId = brandMap.get(row.brand);
              if (!brandId) {
                errors.push({
                  rowNumber: row.rowNumber,
                  sku: row.sku,
                  code: "BRAND_NOT_FOUND",
                  message: `Marca "${row.brand}" no pudo ser creada`,
                });
                failed++;
                continue;
              }

              // Check if product already exists by SKU
              const [existingProduct] = await tx
                .select({ id: Product.id })
                .from(Product)
                .where(eq(Product.sku, row.sku))
                .limit(1);

              let productId: string;

              if (existingProduct) {
                productId = existingProduct.id;
              } else {
                // Create product
                const [created] = await tx
                  .insert(Product)
                  .values({
                    sku: row.sku,
                    name: row.productName,
                    brandId,
                    unitsPerBox: row.unidPerCaja,
                    boxesPerBulk: row.cajasPerBulk,
                    presentationQty: row.presentacion,
                    status: "active",
                  })
                  .returning({ id: Product.id });

                if (!created) {
                  errors.push({
                    rowNumber: row.rowNumber,
                    sku: row.sku,
                    code: "PRODUCT_CREATE_FAILED",
                    message: `No se pudo crear el producto "${row.productName}"`,
                  });
                  failed++;
                  continue;
                }

                productId = created.id;
                productsCreated++;
              }

              // Upsert StockLedger
              await tx
                .insert(StockLedger)
                .values({
                  productId,
                  warehouseId: input.warehouseId,
                  quantity: row.totalUnits,
                })
                .onConflictDoUpdate({
                  target: [StockLedger.productId, StockLedger.warehouseId],
                  set: { quantity: row.totalUnits },
                });

              // Record StockMovement
              await tx.insert(StockMovement).values({
                productId,
                movementType: "initial_stock",
                quantity: row.totalUnits,
                warehouseId: input.warehouseId,
                referenceType: "inventory_initialize",
                notes: `Initialize: ${row.sku} (${row.brand})`,
                createdBy: ctx.user.id,
              });

              totalUnits += row.totalUnits;
              stockEntries++;
            } catch {
              errors.push({
                rowNumber: row.rowNumber,
                sku: row.sku,
                code: "COMMIT_ERROR",
                message: "Error al escribir en la base de datos",
              });
              failed++;
            }
          }
        });
      }

      // 5. Audit log
      const auditPayload = {
        warehouseId: input.warehouseId,
        mode: "initialize",
        filename: input.filename,
        idempotencyKey: input.idempotencyKey,
        brandsCreated,
        productsCreated,
        stockEntries,
        skipped,
        failed,
        totalUnits,
      };

      await logAudit(ctx.db, ctx.user, {
        action: "inventory.initialize_import",
        entity: "inventory_import",
        entityId: input.warehouseId,
        newValue: auditPayload,
      });

      // 6. Get audit log ID
      const [auditEntry] = await ctx.db
        .select({ id: AuditLog.id })
        .from(AuditLog)
        .where(
          and(
            eq(AuditLog.action, "inventory.initialize_import"),
            eq(AuditLog.entity, "inventory_import"),
            eq(AuditLog.entityId, input.warehouseId),
          ),
        )
        .orderBy(sql`${AuditLog.createdAt} DESC`)
        .limit(1);

      return {
        brandsCreated,
        productsCreated,
        stockEntries,
        skipped,
        failed,
        totalUnits,
        errors,
        auditLogId: auditEntry?.id,
      };
    }),
});
