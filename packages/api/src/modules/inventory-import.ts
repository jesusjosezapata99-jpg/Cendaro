/**
 * Cendaro — Inventory Import Router
 *
 * Bulk import of inventory stock quantities from .xlsx files.
 * Supports Replace (absolute), Adjust (delta), and Initialize (create catalog + stock) modes.
 *
 * PRD: FEATURE_PRD_INVENTORY_IMPORT.md §10, §14, §16, §23
 */
import { TRPCError } from "@trpc/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod/v4";

import {
  AuditLog,
  Brand,
  Product,
  StockLedger,
  StockMovement,
  Warehouse,
} from "@cendaro/db/schema";

import type { createTRPCContext, UserRole } from "../trpc";
import type { LedgerSnapshot } from "./inventory-import-plan";
import { createTRPCRouter, wsPermissionProcedure } from "../trpc";
import { logAudit } from "./audit";
import {
  dedupeInitializeRows,
  planInitializeMovement,
  planStockAdjustments,
} from "./inventory-import-plan";

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

type Db = ReturnType<typeof createTRPCContext>["db"];
type NewMovement = typeof StockMovement.$inferInsert;

interface BrandedRow {
  row: InitializeRow;
  brandId: string;
}

const BULK_IMPORT_ACTION = "inventory.bulk_import";
const INITIALIZE_IMPORT_ACTION = "inventory.initialize_import";
const IMPORT_AUDIT_ENTITY = "inventory_import";

/** Rows per multi-row statement, far below Postgres' 65 535 bind parameters. */
const WRITE_CHUNK_SIZE = 500;

/** Overwriting locked stock or resetting a warehouse needs one of these roles. */
const STOCK_OVERRIDE_ROLES: readonly UserRole[] = ["owner", "admin"];

function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function assertStockOverrideRole(role: UserRole, message: string): void {
  if (!STOCK_OVERRIDE_ROLES.includes(role)) {
    throw new TRPCError({ code: "FORBIDDEN", message });
  }
}

async function assertActiveWarehouse(
  db: Db,
  workspaceId: string,
  warehouseId: string,
): Promise<void> {
  const [warehouse] = await db
    .select({ isActive: Warehouse.isActive })
    .from(Warehouse)
    .where(
      and(
        eq(Warehouse.id, warehouseId),
        eq(Warehouse.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  if (!warehouse?.isActive) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Almacén no está activo",
    });
  }
}

/**
 * Transaction-scoped advisory locks, always taken in the same order (key,
 * then warehouse) so two imports cannot deadlock:
 *  - the idempotency key: a double submit waits for the first run and then
 *    finds its audit entry instead of applying the file twice;
 *  - the warehouse: two imports cannot both start from "no ledger row" for
 *    the same product (FOR UPDATE cannot lock a row that does not exist yet).
 */
async function lockImport(
  db: Db,
  workspaceId: string,
  warehouseId: string,
  action: string,
  idempotencyKey: string,
): Promise<void> {
  await db.execute(
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${action}:${workspaceId}:${idempotencyKey}`}, 0))`,
  );
  await db.execute(
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${`stock_import:${workspaceId}:${warehouseId}`}, 0))`,
  );
}

/** Audit entry of an earlier run with this idempotency key, if any. */
async function findPreviousImport(
  db: Db,
  workspaceId: string,
  action: string,
  idempotencyKey: string,
): Promise<{ id: string; newValue: unknown } | undefined> {
  const [previous] = await db
    .select({ id: AuditLog.id, newValue: AuditLog.newValue })
    .from(AuditLog)
    .where(
      and(
        eq(AuditLog.workspaceId, workspaceId),
        eq(AuditLog.action, action),
        eq(AuditLog.entity, IMPORT_AUDIT_ENTITY),
        sql`${AuditLog.newValue} ->> 'idempotencyKey' = ${idempotencyKey}`,
      ),
    )
    .limit(1);
  return previous;
}

/**
 * A replayed idempotency key only returns the first run's result when it is
 * the same import. The same key for another warehouse or mode means the client
 * reused it by mistake: answering with an unrelated result would report stock
 * as applied when nothing was written.
 */
function assertSameImport(
  previousValue: Record<string, unknown>,
  warehouseId: string,
  mode: string,
): void {
  if (
    previousValue.warehouseId !== warehouseId ||
    previousValue.mode !== mode
  ) {
    throw new TRPCError({
      code: "CONFLICT",
      message:
        "Esta clave de importación ya se usó con otro almacén o modo. Vuelve a cargar el archivo.",
    });
  }
}

/** Ledger rows of `productIds` in one warehouse, locked until the import ends. */
async function readLockedLedger(
  db: Db,
  workspaceId: string,
  warehouseId: string,
  productIds: readonly string[],
): Promise<Map<string, LedgerSnapshot>> {
  if (productIds.length === 0) return new Map();
  const rows = await db
    .select({
      productId: StockLedger.productId,
      quantity: StockLedger.quantity,
      isLocked: StockLedger.isLocked,
    })
    .from(StockLedger)
    .where(
      and(
        eq(StockLedger.workspaceId, workspaceId),
        eq(StockLedger.warehouseId, warehouseId),
        inArray(StockLedger.productId, [...productIds]),
      ),
    )
    .for("update");
  return new Map(
    rows.map((r) => [
      r.productId,
      { quantity: r.quantity, isLocked: r.isLocked },
    ]),
  );
}

async function writeLedgerQuantities(
  db: Db,
  workspaceId: string,
  warehouseId: string,
  quantities: ReadonlyMap<string, number>,
): Promise<void> {
  const rows = [...quantities].map(([productId, quantity]) => ({
    workspaceId,
    productId,
    warehouseId,
    quantity,
  }));
  for (const part of chunk(rows, WRITE_CHUNK_SIZE)) {
    await db
      .insert(StockLedger)
      .values(part)
      .onConflictDoUpdate({
        target: [
          StockLedger.workspaceId,
          StockLedger.productId,
          StockLedger.warehouseId,
        ],
        set: { quantity: sql`excluded.quantity`, updatedAt: sql`now()` },
      });
  }
}

async function insertMovements(
  db: Db,
  movements: readonly NewMovement[],
): Promise<void> {
  for (const part of chunk(movements, WRITE_CHUNK_SIZE)) {
    await db.insert(StockMovement).values(part);
  }
}

/** Brand id by slug for `names`, creating the missing ones. */
async function ensureBrands(
  db: Db,
  workspaceId: string,
  names: readonly string[],
): Promise<{ idsBySlug: Map<string, string>; created: number }> {
  const nameBySlug = new Map<string, string>();
  for (const name of names) {
    const slug = slugify(name);
    if (slug && !nameBySlug.has(slug)) nameBySlug.set(slug, name);
  }
  const slugs = [...nameBySlug.keys()];
  if (slugs.length === 0) return { idsBySlug: new Map(), created: 0 };

  const selectBySlug = (wanted: string[]) =>
    db
      .select({ id: Brand.id, slug: Brand.slug })
      .from(Brand)
      .where(
        and(eq(Brand.workspaceId, workspaceId), inArray(Brand.slug, wanted)),
      );

  const idsBySlug = new Map(
    (await selectBySlug(slugs)).map((b) => [b.slug, b.id]),
  );
  const missing = slugs.filter((slug) => !idsBySlug.has(slug));
  let created = 0;
  for (const part of chunk(missing, WRITE_CHUNK_SIZE)) {
    const inserted = await db
      .insert(Brand)
      .values(
        part.map((slug) => ({
          workspaceId,
          name: nameBySlug.get(slug) ?? slug,
          slug,
        })),
      )
      .onConflictDoNothing({ target: [Brand.workspaceId, Brand.slug] })
      .returning({ id: Brand.id, slug: Brand.slug });
    for (const brand of inserted) idsBySlug.set(brand.slug, brand.id);
    created += inserted.length;
  }

  // Created concurrently by someone else (skipped by ON CONFLICT): read it.
  const raced = missing.filter((slug) => !idsBySlug.has(slug));
  if (raced.length > 0) {
    for (const brand of await selectBySlug(raced)) {
      idsBySlug.set(brand.slug, brand.id);
    }
  }
  return { idsBySlug, created };
}

/** Product id by SKU for `rows`, creating the missing products. */
async function ensureProducts(
  db: Db,
  workspaceId: string,
  rows: readonly BrandedRow[],
): Promise<{ idsBySku: Map<string, string>; created: number }> {
  const skus = rows.map((r) => r.row.sku);
  if (skus.length === 0) return { idsBySku: new Map(), created: 0 };

  const selectBySku = (wanted: string[]) =>
    db
      .select({ id: Product.id, sku: Product.sku })
      .from(Product)
      .where(
        and(eq(Product.workspaceId, workspaceId), inArray(Product.sku, wanted)),
      );

  const idsBySku = new Map((await selectBySku(skus)).map((p) => [p.sku, p.id]));
  const missing = rows.filter((r) => !idsBySku.has(r.row.sku));
  let created = 0;
  for (const part of chunk(missing, WRITE_CHUNK_SIZE)) {
    const inserted = await db
      .insert(Product)
      .values(
        part.map(({ row, brandId }) => ({
          workspaceId,
          sku: row.sku,
          name: row.productName,
          brandId,
          unitsPerBox: row.unidPerCaja,
          boxesPerBulk: row.cajasPerBulk,
          presentationQty: row.presentacion,
          status: "active" as const,
        })),
      )
      .onConflictDoNothing({ target: [Product.workspaceId, Product.sku] })
      .returning({ id: Product.id, sku: Product.sku });
    for (const product of inserted) idsBySku.set(product.sku, product.id);
    created += inserted.length;
  }

  const raced = missing
    .map((r) => r.row.sku)
    .filter((sku) => !idsBySku.has(sku));
  if (raced.length > 0) {
    for (const product of await selectBySku(raced)) {
      idsBySku.set(product.sku, product.id);
    }
  }
  return { idsBySku, created };
}

// ── Router ────────────────────────────────────────

export const inventoryImportRouter = createTRPCRouter({
  /**
   * Pre-fetch all products + current stock for a warehouse.
   * Used by the client to build productMap + stockMap for validation.
   *
   * RBAC: owner, admin, supervisor (PRD §4)
   */
  getWarehouseProducts: wsPermissionProcedure("inventory", "update")
    .input(z.object({ warehouseId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { rows } = await ctx.db.execute<{
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
   * Apply validated rows to one warehouse (Replace = absolute, Adjust = delta).
   *
   * Runs inside the procedure's RLS transaction. The stock of every product in
   * the file is read FOR UPDATE and the new levels are computed from it, never
   * from the preview the browser sends, then written in bulk. Expected per-row
   * problems (unknown product, negative result, locked stock) are reported
   * without writing those rows; any database error aborts the whole import, so
   * a file is applied completely or not at all.
   *
   * RBAC: inventory.update (owner, admin, supervisor); overwriting locked stock
   * (`forceLocked`) is owner/admin only.
   */
  commit: wsPermissionProcedure("inventory", "update")
    .input(inventoryImportCommitSchema)
    .mutation(async ({ ctx, input }): Promise<ImportResult> => {
      if (input.forceLocked) {
        assertStockOverrideRole(
          ctx.workspace.role,
          "Solo dueños y administradores pueden importar sobre productos bloqueados",
        );
      }
      if (input.mode === "initialize") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "El modo Inicializar usa su propia confirmación",
        });
      }

      const workspaceId = ctx.workspace.workspaceId;
      await assertActiveWarehouse(ctx.db, workspaceId, input.warehouseId);
      await lockImport(
        ctx.db,
        workspaceId,
        input.warehouseId,
        BULK_IMPORT_ACTION,
        input.idempotencyKey,
      );

      const previous = await findPreviousImport(
        ctx.db,
        workspaceId,
        BULK_IMPORT_ACTION,
        input.idempotencyKey,
      );
      if (previous) {
        const val = asRecord(previous.newValue);
        assertSameImport(val, input.warehouseId, input.mode);
        return {
          committed: Number(val.committed ?? 0),
          skipped: Number(val.skipped ?? 0),
          failed: Number(val.failed ?? 0),
          totalDelta: Number(val.totalDelta ?? 0),
          errors: [],
          auditLogId: previous.id,
        };
      }

      const productIds = [...new Set(input.rows.map((r) => r.productId))];
      const products = await ctx.db
        .select({ id: Product.id })
        .from(Product)
        .where(
          and(
            eq(Product.workspaceId, workspaceId),
            inArray(Product.id, productIds),
          ),
        );
      const ledger = await readLockedLedger(
        ctx.db,
        workspaceId,
        input.warehouseId,
        productIds,
      );

      const plan = planStockAdjustments({
        mode: input.mode,
        rows: input.rows,
        knownProductIds: new Set(products.map((p) => p.id)),
        ledger,
        forceLocked: input.forceLocked,
      });

      await writeLedgerQuantities(
        ctx.db,
        workspaceId,
        input.warehouseId,
        plan.finalQuantities,
      );
      await insertMovements(
        ctx.db,
        plan.movements.map((m) => ({
          workspaceId,
          productId: m.productId,
          movementType: m.delta > 0 ? "adjustment_in" : "adjustment_out",
          quantity: Math.abs(m.delta),
          warehouseId: input.warehouseId,
          referenceType: "inventory_import",
          notes: `Import ${input.mode}: ${m.sku}`,
          createdBy: ctx.user.id,
        })),
      );

      const auditLogId = await logAudit(ctx.db, ctx.user, {
        workspaceId,
        action: BULK_IMPORT_ACTION,
        entity: IMPORT_AUDIT_ENTITY,
        entityId: input.warehouseId,
        newValue: {
          warehouseId: input.warehouseId,
          mode: input.mode,
          filename: input.filename,
          idempotencyKey: input.idempotencyKey,
          committed: plan.committed,
          skipped: plan.skipped,
          failed: plan.failed,
          totalDelta: plan.totalDelta,
          forceLocked: input.forceLocked,
          lockedOverridden: plan.lockedOverridden,
          staleBaseRows: plan.staleBaseRows,
        },
      });

      return {
        committed: plan.committed,
        skipped: plan.skipped,
        failed: plan.failed,
        totalDelta: plan.totalDelta,
        errors: [...plan.errors],
        auditLogId,
      };
    }),

  /**
   * Initialize import — create missing brands and products, then set the
   * warehouse stock to the file's totals. Used for first-time setup or a
   * periodic full reset, so it overwrites locked stock by design.
   *
   * Same guarantees as `commit`: bulk writes inside the RLS transaction, stock
   * read FOR UPDATE, idempotency key serialized by an advisory lock. Products
   * that already had stock in the warehouse record only the difference as a
   * movement, so the movement history keeps adding up to the ledger.
   *
   * RBAC: owner/admin only — a reset is not an ordinary stock update.
   */
  initializeCommit: wsPermissionProcedure("inventory", "update")
    .input(initializeCommitSchema)
    .mutation(async ({ ctx, input }): Promise<InitializeResult> => {
      assertStockOverrideRole(
        ctx.workspace.role,
        "Solo dueños y administradores pueden inicializar el inventario de un almacén",
      );

      const workspaceId = ctx.workspace.workspaceId;
      await assertActiveWarehouse(ctx.db, workspaceId, input.warehouseId);
      await lockImport(
        ctx.db,
        workspaceId,
        input.warehouseId,
        INITIALIZE_IMPORT_ACTION,
        input.idempotencyKey,
      );

      const previous = await findPreviousImport(
        ctx.db,
        workspaceId,
        INITIALIZE_IMPORT_ACTION,
        input.idempotencyKey,
      );
      if (previous) {
        const val = asRecord(previous.newValue);
        assertSameImport(val, input.warehouseId, "initialize");
        return {
          brandsCreated: Number(val.brandsCreated ?? 0),
          productsCreated: Number(val.productsCreated ?? 0),
          stockEntries: Number(val.stockEntries ?? 0),
          skipped: Number(val.skipped ?? 0),
          failed: Number(val.failed ?? 0),
          totalUnits: Number(val.totalUnits ?? 0),
          errors: [],
          auditLogId: previous.id,
        };
      }

      const { kept, skipped } = dedupeInitializeRows(input.rows);
      const errors: InitializeResult["errors"] = [];

      const brands = await ensureBrands(
        ctx.db,
        workspaceId,
        kept.map((r) => r.brand),
      );
      const withBrand: BrandedRow[] = [];
      for (const row of kept) {
        const brandId = brands.idsBySlug.get(slugify(row.brand));
        if (brandId) {
          withBrand.push({ row, brandId });
        } else {
          errors.push({
            rowNumber: row.rowNumber,
            sku: row.sku,
            code: "BRAND_NOT_FOUND",
            message: `Marca "${row.brand}" no pudo ser creada`,
          });
        }
      }

      const products = await ensureProducts(ctx.db, workspaceId, withBrand);
      const productIds = [...products.idsBySku.values()];
      const ledger = await readLockedLedger(
        ctx.db,
        workspaceId,
        input.warehouseId,
        productIds,
      );

      const finalQuantities = new Map<string, number>();
      const movements: NewMovement[] = [];
      let totalUnits = 0;
      for (const { row } of withBrand) {
        const productId = products.idsBySku.get(row.sku);
        if (!productId) {
          errors.push({
            rowNumber: row.rowNumber,
            sku: row.sku,
            code: "PRODUCT_CREATE_FAILED",
            message: `No se pudo crear el producto "${row.productName}"`,
          });
          continue;
        }
        finalQuantities.set(productId, row.totalUnits);
        totalUnits += row.totalUnits;
        const movement = planInitializeMovement(
          ledger.get(productId)?.quantity,
          row.totalUnits,
        );
        if (movement) {
          movements.push({
            workspaceId,
            productId,
            movementType: movement.movementType,
            quantity: movement.quantity,
            warehouseId: input.warehouseId,
            referenceType: "inventory_initialize",
            notes: `Initialize: ${row.sku} (${row.brand})`,
            createdBy: ctx.user.id,
          });
        }
      }

      await writeLedgerQuantities(
        ctx.db,
        workspaceId,
        input.warehouseId,
        finalQuantities,
      );
      await insertMovements(ctx.db, movements);

      const summary = {
        brandsCreated: brands.created,
        productsCreated: products.created,
        stockEntries: finalQuantities.size,
        skipped,
        failed: errors.length,
        totalUnits,
      };

      const auditLogId = await logAudit(ctx.db, ctx.user, {
        workspaceId,
        action: INITIALIZE_IMPORT_ACTION,
        entity: IMPORT_AUDIT_ENTITY,
        entityId: input.warehouseId,
        newValue: {
          warehouseId: input.warehouseId,
          mode: "initialize",
          filename: input.filename,
          idempotencyKey: input.idempotencyKey,
          ...summary,
        },
      });

      return { ...summary, errors, auditLogId };
    }),
});
