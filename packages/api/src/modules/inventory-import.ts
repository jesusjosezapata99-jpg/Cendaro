/**
 * Cendaro — Inventory Import Router
 *
 * Bulk import of inventory stock quantities from .xlsx files.
 * Supports Replace (absolute) and Adjust (delta) import modes.
 *
 * PRD: FEATURE_PRD_INVENTORY_IMPORT.md §10, §14, §16
 */
import { TRPCError } from "@trpc/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod/v4";

import {
  AuditLog,
  Product,
  StockLedger,
  StockMovement,
  Warehouse,
} from "@cendaro/db/schema";

import { createTRPCRouter, roleRestrictedProcedure } from "../trpc";
import { logAudit } from "./audit";

// ── Import Mode ───────────────────────────────────
export const importModeSchema = z.enum(["replace", "adjust"]);
export type ImportMode = z.infer<typeof importModeSchema>;

// ── Single Row (client → server) ──────────────────
export const inventoryImportRowSchema = z.object({
  /** 1-indexed row number from the original spreadsheet */
  rowNumber: z.int().min(1),
  /** Product SKU (must exist in Product table) */
  sku: z.string().min(1).max(64),
  /** Target quantity (Replace: absolute | Adjust: delta) */
  quantity: z.int(),
  /** Optional per-row notes */
  notes: z.string().max(512).optional(),
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

// ── Router ────────────────────────────────────────

export const inventoryImportRouter = createTRPCRouter({
  /**
   * Pre-fetch all products + current stock for a warehouse.
   * Used by the client to build productMap + stockMap for validation.
   *
   * RBAC: owner, admin, supervisor (PRD §4)
   */
  getWarehouseProducts: roleRestrictedProcedure([
    "owner",
    "admin",
    "supervisor",
  ])
    .input(z.object({ warehouseId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.execute<{
        id: string;
        sku: string;
        name: string;
        quantity: number;
        is_locked: boolean;
      }>(sql`
        SELECT p.id, p.sku, p.name,
          COALESCE(sl.quantity, 0)::int AS quantity,
          COALESCE(sl.is_locked, false) AS is_locked
        FROM product p
        LEFT JOIN stock_ledger sl
          ON sl.product_id = p.id AND sl.warehouse_id = ${input.warehouseId}
        WHERE p.status != 'discontinued'
        ORDER BY p.sku
      `);

      return rows.map((r) => ({
        id: r.id,
        sku: r.sku,
        name: r.name,
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
  commit: roleRestrictedProcedure(["owner", "admin"])
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
                notes: row.notes ?? `Import ${input.mode}: ${row.sku}`,
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
});
