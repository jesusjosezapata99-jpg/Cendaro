/**
 * Cendaro — Catalog Import Router
 *
 * Staged spreadsheet import pipeline for catalog products.
 * Upload → Validate → Category Map → Dry-Run → Commit
 *
 * PRD: FEATURE_PRD_CATALOG_IMPORT.md §10, §15, §17
 */
import { TRPCError } from "@trpc/server";
import { and, count, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod/v4";

import {
  Brand,
  Category,
  CategoryAlias,
  ImportSession,
  ImportSessionRow,
  Product,
  StockLedger,
  StockMovement,
} from "@cendaro/db/schema";

import { createTRPCRouter, workspaceProcedure } from "../trpc";
import { logAudit } from "./audit";

// ── Zod Schemas (PRD §10) ────────────────────────

export const catalogImportRowSchema = z.object({
  rowNumber: z.int().min(1),
  sku: z.string().min(1).max(64),
  name: z.string().min(1).max(512),
  barcode: z.string().max(128).optional(),
  categoryRaw: z.string().max(256).optional(),
  brandRaw: z.string().max(256).optional(),
  cost: z.number().nonnegative().optional(),
  quantity: z.int().nonnegative().optional(),
  weight: z.number().nonnegative().optional(),
  volume: z.number().nonnegative().optional(),
  description: z.string().max(2000).optional(),
  notes: z.string().max(512).optional(),
});
export type CatalogImportRow = z.infer<typeof catalogImportRowSchema>;

export const catalogValidatedRowSchema = catalogImportRowSchema.extend({
  status: z.enum(["valid", "warning", "error"]),
  action: z.enum(["insert", "update", "skip"]).optional(),
  message: z.string().optional(),
  existingProductId: z.string().uuid().optional(),
  resolvedCategoryId: z.string().uuid().optional(),
  resolvedCategoryName: z.string().optional(),
  resolvedBrandId: z.string().uuid().optional(),
  resolvedBrandName: z.string().optional(),
  categoryMatchType: z
    .enum(["exact", "fuzzy", "alias", "unresolved", "none"])
    .optional(),
});
export type CatalogValidatedRow = z.infer<typeof catalogValidatedRowSchema>;

export const categoryMappingSchema = z.object({
  rawCategory: z.string(),
  resolvedCategoryId: z.string().uuid().nullable(),
  newCategoryName: z.string().min(1).max(256).optional(),
  matchType: z.enum(["exact", "fuzzy", "alias", "user_selected", "skipped"]),
  confidence: z.number().min(0).max(1).optional(),
});

export const catalogImportCreateSchema = z.object({
  filename: z.string().max(256),
  rows: z.array(catalogImportRowSchema).min(1).max(10000),
  idempotencyKey: z.string().uuid(),
  defaultWarehouseId: z.string().uuid().optional(),
});

export const catalogImportResultSchema = z.object({
  inserted: z.int().min(0),
  updated: z.int().min(0),
  skipped: z.int().min(0),
  failed: z.int().min(0),
  errors: z.array(
    z.object({
      rowNumber: z.int(),
      sku: z.string(),
      code: z.string(),
      message: z.string(),
    }),
  ),
  auditLogId: z.string().uuid().optional(),
});
export type CatalogImportResult = z.infer<typeof catalogImportResultSchema>;

// ── Internal types ───────────────────────────────

/** Shape of the JSONB `rawData` stored in import_session_row */
interface RawRowData {
  rowNumber?: number;
  sku?: string;
  name?: string;
  categoryRaw?: string;
  brandRaw?: string;
  cost?: number;
  quantity?: number;
  barcode?: string;
  weight?: number;
  volume?: number;
  description?: string;
  notes?: string;
}

// ── Helpers ──────────────────────────────────────

/** Generate a URL-safe slug from a string */
function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ── Router ───────────────────────────────────────

export const catalogImportRouter = createTRPCRouter({
  /**
   * Create an import session and store parsed rows.
   *
   * RBAC: owner, admin, supervisor (PRD §4)
   */
  create: workspaceProcedure
    .input(catalogImportCreateSchema)
    .mutation(async ({ ctx, input }) => {
      // Auto-cancel any existing active sessions for this user.
      // This prevents stale sessions (from browser refresh / abandoned wizard)
      // from permanently blocking new imports.
      const staleSessions = await ctx.db
        .select({ id: ImportSession.id })
        .from(ImportSession)
        .where(
          and(
            eq(ImportSession.userId, ctx.user.id),
            inArray(ImportSession.status, [
              "pending",
              "validating",
              "category_mapping",
              "dry_run",
            ]),
          ),
        );

      if (staleSessions.length > 0) {
        await ctx.db
          .update(ImportSession)
          .set({ status: "expired" })
          .where(
            inArray(
              ImportSession.id,
              staleSessions.map((s) => s.id),
            ),
          );
      }

      // Idempotency check
      const [existingIdempotency] = await ctx.db
        .select({ id: ImportSession.id, status: ImportSession.status })
        .from(ImportSession)
        .where(eq(ImportSession.idempotencyKey, input.idempotencyKey))
        .limit(1);

      if (existingIdempotency) {
        return { sessionId: existingIdempotency.id };
      }

      // Create session
      const [session] = await ctx.db
        .insert(ImportSession)
        .values({
          userId: ctx.user.id,
          type: "catalog",
          status: "pending",
          filename: input.filename,
          totalRows: input.rows.length,
          idempotencyKey: input.idempotencyKey,
          metadata: input.defaultWarehouseId
            ? { defaultWarehouseId: input.defaultWarehouseId }
            : null,
        })
        .returning({ id: ImportSession.id });

      if (!session) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "No se pudo crear la sesión de importación",
        });
      }

      // Insert rows in batches of 100
      const BATCH_SIZE = 100;
      for (let i = 0; i < input.rows.length; i += BATCH_SIZE) {
        const batch = input.rows.slice(i, i + BATCH_SIZE);
        await ctx.db.insert(ImportSessionRow).values(
          batch.map((row, batchIdx) => ({
            importSessionId: session.id,
            rowIndex: i + batchIdx,
            status: "pending" as const,
            rawData: row as unknown as Record<string, unknown>,
          })),
        );
      }

      return { sessionId: session.id };
    }),

  /**
   * Validate session rows: SKU lookup, category/brand resolution.
   *
   * RBAC: owner, admin, supervisor (PRD §4)
   */
  validate: workspaceProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Load session
      const [session] = await ctx.db
        .select()
        .from(ImportSession)
        .where(
          and(
            eq(ImportSession.id, input.sessionId),
            eq(ImportSession.userId, ctx.user.id),
          ),
        )
        .limit(1);

      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Sesión de importación no encontrada",
        });
      }

      // Check expiration
      if (new Date() > session.expiresAt) {
        await ctx.db
          .update(ImportSession)
          .set({ status: "expired" })
          .where(eq(ImportSession.id, session.id));
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Sesión de importación expirada",
        });
      }

      // Update session status
      await ctx.db
        .update(ImportSession)
        .set({ status: "validating" })
        .where(eq(ImportSession.id, session.id));

      // Load all session rows
      const sessionRows = await ctx.db
        .select()
        .from(ImportSessionRow)
        .where(eq(ImportSessionRow.importSessionId, session.id));

      // Load all products for SKU matching
      const allProducts = await ctx.db
        .select({
          id: Product.id,
          sku: Product.sku,
          name: Product.name,
          barcode: Product.barcode,
        })
        .from(Product);

      const productBySku = new Map<
        string,
        { id: string; name: string; barcode: string | null }
      >();
      for (const p of allProducts) {
        productBySku.set(p.sku.toUpperCase(), {
          id: p.id,
          name: p.name,
          barcode: p.barcode,
        });
      }

      // Load all brands for matching
      const allBrands = await ctx.db
        .select({ id: Brand.id, name: Brand.name, slug: Brand.slug })
        .from(Brand);

      const brandByName = new Map<string, { id: string; name: string }>();
      const brandBySlug = new Map<string, { id: string; name: string }>();
      for (const b of allBrands) {
        brandByName.set(b.name.toLowerCase(), { id: b.id, name: b.name });
        brandBySlug.set(b.slug.toLowerCase(), { id: b.id, name: b.name });
      }

      // Load all categories for matching
      const allCategories = await ctx.db
        .select({
          id: Category.id,
          name: Category.name,
          slug: Category.slug,
        })
        .from(Category);

      const categoryByName = new Map<string, { id: string; name: string }>();
      const categoryBySlug = new Map<string, { id: string; name: string }>();
      for (const c of allCategories) {
        categoryByName.set(c.name.toLowerCase(), { id: c.id, name: c.name });
        categoryBySlug.set(c.slug.toLowerCase(), { id: c.id, name: c.name });
      }

      // Load existing aliases
      const existingAliases = await ctx.db
        .select({
          alias: CategoryAlias.alias,
          categoryId: CategoryAlias.categoryId,
        })
        .from(CategoryAlias);

      const aliasByCategoryStr = new Map<string, string>();
      for (const a of existingAliases) {
        aliasByCategoryStr.set(a.alias.toLowerCase(), a.categoryId);
      }

      // Collect distinct unresolved categories for fuzzy matching
      const unresolvedCategories: {
        rawCategory: string;
        suggestedNewName: string | null;
        suggestions: {
          id: string;
          name: string;
          score: number;
          reason?: string;
        }[];
      }[] = [];
      const unresolvedSet = new Set<string>();

      let validRows = 0;
      let errorRows = 0;

      // Process each row
      for (const row of sessionRows) {
        const rawData = row.rawData as RawRowData;
        const sku = String(rawData.sku ?? "")
          .trim()
          .toUpperCase();
        const name = String(rawData.name ?? "").trim();
        const categoryRaw = rawData.categoryRaw
          ? String(rawData.categoryRaw).trim()
          : undefined;
        const brandRaw = rawData.brandRaw
          ? String(rawData.brandRaw).trim()
          : undefined;

        const rowErrors: { code: string; message: string }[] = [];
        let status: "valid" | "warning" | "error" = "valid";
        let action: "insert" | "update" | "skip" | null = null;
        let resolvedProductId: string | undefined;
        let resolvedCategoryId: string | undefined;
        let resolvedBrandId: string | undefined;

        // Validate required fields
        if (!sku) {
          rowErrors.push({
            code: "REQUIRED_FIELD",
            message: '"SKU" es obligatorio pero está vacío',
          });
          status = "error";
        }
        if (!name) {
          rowErrors.push({
            code: "REQUIRED_FIELD",
            message: '"Nombre" es obligatorio pero está vacío',
          });
          status = "error";
        }

        // SKU lookup → insert vs update
        if (sku) {
          const existing = productBySku.get(sku);
          if (existing) {
            action = "update";
            resolvedProductId = existing.id;
          } else {
            action = "insert";
          }
        }

        // Brand resolution
        if (brandRaw) {
          const brandMatch =
            brandByName.get(brandRaw.toLowerCase()) ??
            brandBySlug.get(slugify(brandRaw));
          if (brandMatch) {
            resolvedBrandId = brandMatch.id;
          } else if (status !== "error") {
            rowErrors.push({
              code: "BRAND_NOT_FOUND",
              message: `Marca "${brandRaw}" no encontrada — se omitirá`,
            });
            status = "warning";
          }
        }

        // Category resolution: exact → alias → mark for fuzzy
        if (categoryRaw) {
          const exactMatch =
            categoryByName.get(categoryRaw.toLowerCase()) ??
            categoryBySlug.get(slugify(categoryRaw));

          if (exactMatch) {
            resolvedCategoryId = exactMatch.id;
          } else {
            // Check alias table
            const aliasMatch = aliasByCategoryStr.get(
              categoryRaw.toLowerCase(),
            );
            if (aliasMatch) {
              resolvedCategoryId = aliasMatch;
            } else {
              // Mark for fuzzy matching
              if (!unresolvedSet.has(categoryRaw.toLowerCase())) {
                unresolvedSet.add(categoryRaw.toLowerCase());
                // Will be populated after batch fuzzy query
                unresolvedCategories.push({
                  rawCategory: categoryRaw,
                  suggestedNewName: null,
                  suggestions: [],
                });
              }
              if (status === "valid") status = "warning";
              rowErrors.push({
                code: "CATEGORY_UNRESOLVED",
                message: `Categoría "${categoryRaw}" no encontrada — requiere mapeo manual`,
              });
            }
          }
        }

        // Update the row
        const newStatus = status === "error" ? "error" : status;
        if (newStatus === "error") errorRows++;
        else validRows++;

        await ctx.db
          .update(ImportSessionRow)
          .set({
            status: newStatus,
            action: action ?? undefined,
            normalizedData: rawData,
            resolvedCategoryId: resolvedCategoryId ?? null,
            resolvedBrandId: resolvedBrandId ?? null,
            resolvedProductId: resolvedProductId ?? null,
            errors: rowErrors.length > 0 ? rowErrors : null,
          })
          .where(eq(ImportSessionRow.id, row.id));
      }

      // Build a map of product names per unresolved raw category (from this import batch)
      const productNamesByRawCategory = new Map<string, string[]>();
      for (const row of sessionRows) {
        const rawData = row.rawData as RawRowData;
        const categoryRaw = rawData.categoryRaw
          ? String(rawData.categoryRaw).trim()
          : undefined;
        const productName = String(rawData.name ?? "").trim();

        if (
          categoryRaw &&
          productName &&
          unresolvedSet.has(categoryRaw.toLowerCase())
        ) {
          const key = categoryRaw.toLowerCase();
          const existing = productNamesByRawCategory.get(key) ?? [];
          existing.push(productName);
          productNamesByRawCategory.set(key, existing);
        }
      }

      // Enhanced fuzzy match: category name similarity + product-name similarity
      for (const unresolved of unresolvedCategories) {
        try {
          // Get up to 3 representative product names for this unresolved category
          const sampleProducts = (
            productNamesByRawCategory.get(
              unresolved.rawCategory.toLowerCase(),
            ) ?? []
          ).slice(0, 3);

          // Query 1: Standard category-name fuzzy match (always runs)
          const categoryNameResults = await ctx.db.execute<{
            id: string;
            name: string;
            score: number;
          }>(sql`
            SELECT
              c.id,
              c.name,
              similarity(LOWER(c.name), LOWER(${unresolved.rawCategory})) AS score
            FROM category c
            WHERE similarity(LOWER(c.name), LOWER(${unresolved.rawCategory})) >= 0.2
            ORDER BY score DESC
            LIMIT 5
          `);

          // Query 2: Product-name-based scoring (only if we have product names)
          let productMatchResults: {
            id: string;
            name: string;
            avg_score: number;
            match_count: number;
          }[] = [];

          if (sampleProducts.length > 0) {
            // For each existing category, check how similar its already-cataloged
            // product names are to the products being imported in this batch.
            // This gives semantic relevance: "Cable USB-C" → "Cables y Conectores"
            const sampleName = sampleProducts[0] ?? "";
            productMatchResults = await ctx.db.execute<{
              id: string;
              name: string;
              avg_score: number;
              match_count: number;
            }>(sql`
              SELECT
                c.id,
                c.name,
                AVG(similarity(LOWER(p.name), LOWER(${sampleName}))) AS avg_score,
                COUNT(p.id)::int AS match_count
              FROM category c
              INNER JOIN product p ON p."categoryId" = c.id
              WHERE similarity(LOWER(p.name), LOWER(${sampleName})) >= 0.15
              GROUP BY c.id, c.name
              HAVING AVG(similarity(LOWER(p.name), LOWER(${sampleName}))) >= 0.2
              ORDER BY avg_score DESC
              LIMIT 5
            `);
          }

          // Merge results: combine category-name and product-name scores
          const mergedMap = new Map<
            string,
            {
              id: string;
              name: string;
              catNameScore: number;
              productScore: number;
              matchCount: number;
            }
          >();

          for (const r of categoryNameResults) {
            mergedMap.set(r.id, {
              id: r.id,
              name: r.name,
              catNameScore: Number(r.score),
              productScore: 0,
              matchCount: 0,
            });
          }

          for (const r of productMatchResults) {
            const existing = mergedMap.get(r.id);
            if (existing) {
              existing.productScore = Number(r.avg_score);
              existing.matchCount = Number(r.match_count);
            } else {
              mergedMap.set(r.id, {
                id: r.id,
                name: r.name,
                catNameScore: 0,
                productScore: Number(r.avg_score),
                matchCount: Number(r.match_count),
              });
            }
          }

          // Compute final score: 40% category name + 60% product similarity
          const suggestions = Array.from(mergedMap.values())
            .map((m) => {
              const finalScore =
                m.productScore > 0
                  ? 0.4 * m.catNameScore + 0.6 * m.productScore
                  : m.catNameScore;

              let reason: string;
              if (m.productScore > 0 && m.catNameScore > 0) {
                reason = `Nombre similar + ${m.matchCount} producto(s) similares en esta categoría`;
              } else if (m.productScore > 0) {
                reason = `${m.matchCount} producto(s) similares ya catalogados aquí`;
              } else {
                reason = "Nombre de categoría similar";
              }

              return {
                id: m.id,
                name: m.name,
                score: Math.round(finalScore * 100) / 100,
                reason,
              };
            })
            .filter((s) => s.score >= 0.2)
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);

          unresolved.suggestions = suggestions;
        } catch {
          // pg_trgm not available — graceful fallback (PRD §22 edge case #14)
          unresolved.suggestions = [];
        }
      }

      // ── Smart name suggestion for new categories ───────────────
      // When no good match exists, suggest a clean category name
      // based on the raw category string + product name tokens.

      const STOPWORDS = new Set([
        "de",
        "del",
        "la",
        "las",
        "el",
        "los",
        "un",
        "una",
        "unos",
        "unas",
        "y",
        "o",
        "e",
        "en",
        "con",
        "para",
        "por",
        "sin",
        "a",
        "al",
        "que",
        "es",
        "se",
        "no",
        "si",
        "su",
        "sus",
        "este",
        "esta",
        "como",
        "mas",
        "pero",
        "muy",
        "ya",
        "todo",
        "cada",
        "x",
        "mm",
        "cm",
        "kg",
        "ml",
        "lt",
        "gr",
        "oz",
        "pcs",
        "und",
      ]);

      function capitalizeWords(str: string): string {
        return str
          .split(" ")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(" ");
      }

      for (const unresolved of unresolvedCategories) {
        const bestScore = unresolved.suggestions[0]?.score ?? 0;

        if (bestScore >= 0.5) {
          // Good match exists — no need to suggest a new name
          unresolved.suggestedNewName = null;
          continue;
        }

        // Primary: clean up the rawCategory itself
        const cleanedRaw = capitalizeWords(
          unresolved.rawCategory.trim().replace(/\s+/g, " "),
        );

        // Secondary: extract dominant token from product names in this batch
        const productNames =
          productNamesByRawCategory.get(unresolved.rawCategory.toLowerCase()) ??
          [];

        if (productNames.length === 0) {
          unresolved.suggestedNewName = cleanedRaw;
          continue;
        }

        // Tokenize product names, count frequency
        const tokenFreq = new Map<string, number>();
        for (const pName of productNames) {
          const tokens = pName
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .split(/[\s,.-]+/)
            .filter((t) => t.length >= 3 && !STOPWORDS.has(t));

          for (const token of tokens) {
            tokenFreq.set(token, (tokenFreq.get(token) ?? 0) + 1);
          }
        }

        // Use rawCategory as primary suggestion (it's what the user intended)
        unresolved.suggestedNewName = cleanedRaw;
      }

      // Update session with status
      const newSessionStatus =
        unresolvedCategories.length > 0 ? "category_mapping" : "dry_run";
      await ctx.db
        .update(ImportSession)
        .set({
          status: newSessionStatus,
          validRows,
          errorRows,
        })
        .where(eq(ImportSession.id, session.id));

      return {
        validRows,
        errorRows,
        unresolvedCategories,
      };
    }),

  /**
   * Apply user's category mapping decisions + save aliases.
   *
   * RBAC: owner, admin, supervisor (PRD §4)
   */
  resolveCategories: workspaceProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        mappings: z.array(categoryMappingSchema),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [session] = await ctx.db
        .select()
        .from(ImportSession)
        .where(
          and(
            eq(ImportSession.id, input.sessionId),
            eq(ImportSession.userId, ctx.user.id),
          ),
        )
        .limit(1);

      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Sesión de importación no encontrada",
        });
      }

      if (session.status !== "category_mapping") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "La sesión no está en estado de mapeo de categorías",
        });
      }

      // Apply each mapping
      for (const mapping of input.mappings) {
        if (mapping.matchType === "skipped") {
          continue;
        }

        let categoryId = mapping.resolvedCategoryId;

        // Create new category if requested
        if (!categoryId && mapping.newCategoryName) {
          const newSlug = slugify(mapping.newCategoryName);
          const [newCat] = await ctx.db
            .insert(Category)
            .values({
              name: mapping.newCategoryName,
              slug: newSlug,
              depth: 0,
              sortOrder: 0,
            })
            .returning({ id: Category.id });

          if (newCat) {
            categoryId = newCat.id;
            await logAudit(ctx.db, ctx.user, {
              action: "category.create",
              entity: "category",
              entityId: newCat.id,
              newValue: {
                name: mapping.newCategoryName,
                source: "catalog_import",
              },
            });
          }
        }

        if (!categoryId) continue;

        // Update all session rows with this raw category
        const rows = await ctx.db
          .select({
            id: ImportSessionRow.id,
            rawData: ImportSessionRow.rawData,
          })
          .from(ImportSessionRow)
          .where(eq(ImportSessionRow.importSessionId, session.id));

        for (const row of rows) {
          const rawData = row.rawData as RawRowData;
          const categoryRaw = rawData.categoryRaw
            ? String(rawData.categoryRaw).trim()
            : undefined;

          if (
            categoryRaw?.toLowerCase() === mapping.rawCategory.toLowerCase()
          ) {
            await ctx.db
              .update(ImportSessionRow)
              .set({
                resolvedCategoryId: categoryId,
                errors: null,
              })
              .where(eq(ImportSessionRow.id, row.id));
          }
        }

        // Save alias for future auto-resolution (PRD FR-23, FR-40)
        try {
          await ctx.db
            .insert(CategoryAlias)
            .values({
              alias: mapping.rawCategory,
              categoryId: categoryId,
              createdBy: ctx.user.id,
            })
            .onConflictDoNothing();
        } catch {
          // Alias already exists — ignore
        }
      }

      // Move to dry_run status
      await ctx.db
        .update(ImportSession)
        .set({ status: "dry_run" })
        .where(eq(ImportSession.id, session.id));

      return { resolved: input.mappings.length };
    }),

  /**
   * Compute what will happen on commit: inserts, updates, skips.
   *
   * RBAC: any authenticated user (PRD §4)
   */
  dryRun: workspaceProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [session] = await ctx.db
        .select()
        .from(ImportSession)
        .where(eq(ImportSession.id, input.sessionId))
        .limit(1);

      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Sesión de importación no encontrada",
        });
      }

      // Count by action
      const [insertCount] = await ctx.db
        .select({ count: count() })
        .from(ImportSessionRow)
        .where(
          and(
            eq(ImportSessionRow.importSessionId, session.id),
            eq(ImportSessionRow.action, "insert"),
            inArray(ImportSessionRow.status, ["valid", "warning"]),
          ),
        );

      const [updateCount] = await ctx.db
        .select({ count: count() })
        .from(ImportSessionRow)
        .where(
          and(
            eq(ImportSessionRow.importSessionId, session.id),
            eq(ImportSessionRow.action, "update"),
            inArray(ImportSessionRow.status, ["valid", "warning"]),
          ),
        );

      const [skipCount] = await ctx.db
        .select({ count: count() })
        .from(ImportSessionRow)
        .where(
          and(
            eq(ImportSessionRow.importSessionId, session.id),
            eq(ImportSessionRow.status, "error"),
          ),
        );

      // Get rows for preview
      const rows = await ctx.db
        .select()
        .from(ImportSessionRow)
        .where(eq(ImportSessionRow.importSessionId, session.id))
        .orderBy(ImportSessionRow.rowIndex);

      return {
        inserts: insertCount?.count ?? 0,
        updates: updateCount?.count ?? 0,
        skips: skipCount?.count ?? 0,
        totalRows: session.totalRows,
        rows: rows.map((r) => ({
          rowIndex: r.rowIndex,
          status: r.status,
          action: r.action,
          rawData: r.rawData,
          normalizedData: r.normalizedData,
          resolvedCategoryId: r.resolvedCategoryId,
          resolvedBrandId: r.resolvedBrandId,
          resolvedProductId: r.resolvedProductId,
          errors: r.errors,
        })),
      };
    }),

  /**
   * Execute the import: batched INSERT/UPDATE products.
   *
   * RBAC: owner, admin only (PRD §4)
   */
  commit: workspaceProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [session] = await ctx.db
        .select()
        .from(ImportSession)
        .where(
          and(
            eq(ImportSession.id, input.sessionId),
            eq(ImportSession.userId, ctx.user.id),
          ),
        )
        .limit(1);

      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Sesión de importación no encontrada",
        });
      }

      // Check status
      if (session.status === "committed") {
        // Idempotency: return cached result
        return {
          inserted: session.inserted,
          updated: session.updated,
          skipped: session.skipped,
          failed: session.failed,
          errors: [] as {
            rowNumber: number;
            sku: string;
            code: string;
            message: string;
          }[],
        };
      }

      if (session.status !== "dry_run") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "La sesión debe estar en estado dry_run para confirmar la importación",
        });
      }

      // Check expiration
      if (new Date() > session.expiresAt) {
        await ctx.db
          .update(ImportSession)
          .set({ status: "expired" })
          .where(eq(ImportSession.id, session.id));
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Sesión de importación expirada",
        });
      }

      // Load valid/warning rows for commit
      const rowsToCommit = await ctx.db
        .select()
        .from(ImportSessionRow)
        .where(
          and(
            eq(ImportSessionRow.importSessionId, session.id),
            inArray(ImportSessionRow.status, ["valid", "warning"]),
          ),
        )
        .orderBy(ImportSessionRow.rowIndex);

      const BATCH_SIZE = 100;
      let inserted = 0;
      let updated = 0;
      let skipped = 0;
      let failed = 0;
      const errors: {
        rowNumber: number;
        sku: string;
        code: string;
        message: string;
      }[] = [];

      const defaultWarehouseId = (
        session.metadata as Record<string, unknown> | null
      )?.defaultWarehouseId as string | undefined;

      for (let i = 0; i < rowsToCommit.length; i += BATCH_SIZE) {
        const batch = rowsToCommit.slice(i, i + BATCH_SIZE);

        await ctx.db.transaction(async (tx) => {
          for (const row of batch) {
            const rawData = row.rawData as RawRowData;
            const sku = String(rawData.sku ?? "")
              .trim()
              .toUpperCase();
            const name = String(rawData.name ?? "").trim();
            const rowNumber = Number(rawData.rowNumber ?? row.rowIndex + 2);

            try {
              if (row.action === "insert") {
                // INSERT new product
                const costValue = rawData.cost
                  ? String(rawData.cost)
                  : undefined;
                const [newProduct] = await tx
                  .insert(Product)
                  .values({
                    sku,
                    name,
                    barcode: rawData.barcode
                      ? String(rawData.barcode).trim()
                      : null,
                    categoryId: row.resolvedCategoryId ?? null,
                    brandId: row.resolvedBrandId ?? null,
                    costAvg: costValue ?? "0",
                    weight: rawData.weight ? Number(rawData.weight) : undefined,
                    volume: rawData.volume ? Number(rawData.volume) : undefined,
                    descriptionShort: rawData.description
                      ? String(rawData.description).slice(0, 512)
                      : undefined,
                    status: "draft",
                  })
                  .returning({ id: Product.id });

                if (!newProduct) {
                  errors.push({
                    rowNumber,
                    sku,
                    code: "PRODUCT_CREATE_FAILED",
                    message: `No se pudo crear el producto "${name}"`,
                  });
                  failed++;
                  await tx
                    .update(ImportSessionRow)
                    .set({ status: "failed" })
                    .where(eq(ImportSessionRow.id, row.id));
                  continue;
                }

                // Create initial stock if quantity provided (PRD FR-35)
                if (
                  rawData.quantity &&
                  Number(rawData.quantity) > 0 &&
                  defaultWarehouseId
                ) {
                  const qty = Number(rawData.quantity);
                  await tx.insert(StockLedger).values({
                    productId: newProduct.id,
                    warehouseId: defaultWarehouseId,
                    quantity: qty,
                  });
                  await tx.insert(StockMovement).values({
                    productId: newProduct.id,
                    movementType: "initial_stock",
                    quantity: qty,
                    warehouseId: defaultWarehouseId,
                    referenceType: "catalog_import",
                    createdBy: ctx.user.id,
                  });
                }

                inserted++;
                await tx
                  .update(ImportSessionRow)
                  .set({
                    status: "committed",
                    resolvedProductId: newProduct.id,
                  })
                  .where(eq(ImportSessionRow.id, row.id));
              } else if (row.action === "update" && row.resolvedProductId) {
                // UPDATE existing product (PRD FR-34: only non-null fields)
                const updates: Record<string, unknown> = {};
                if (name) updates.name = name;
                if (rawData.barcode)
                  updates.barcode = String(rawData.barcode).trim();
                if (row.resolvedCategoryId)
                  updates.categoryId = row.resolvedCategoryId;
                if (row.resolvedBrandId) updates.brandId = row.resolvedBrandId;
                if (rawData.cost) updates.costAvg = String(rawData.cost);
                if (rawData.weight) updates.weight = Number(rawData.weight);
                if (rawData.volume) updates.volume = Number(rawData.volume);

                if (Object.keys(updates).length > 0) {
                  await tx
                    .update(Product)
                    .set(updates)
                    .where(eq(Product.id, row.resolvedProductId));
                }

                updated++;
                await tx
                  .update(ImportSessionRow)
                  .set({ status: "committed" })
                  .where(eq(ImportSessionRow.id, row.id));
              } else {
                skipped++;
                await tx
                  .update(ImportSessionRow)
                  .set({ status: "skipped" })
                  .where(eq(ImportSessionRow.id, row.id));
              }
            } catch {
              errors.push({
                rowNumber,
                sku,
                code: "COMMIT_ERROR",
                message: "Error al escribir en la base de datos",
              });
              failed++;
              await tx
                .update(ImportSessionRow)
                .set({ status: "failed" })
                .where(eq(ImportSessionRow.id, row.id));
            }
          }
        });
      }

      // Update session with results
      await ctx.db
        .update(ImportSession)
        .set({
          status: "committed",
          inserted,
          updated,
          skipped,
          failed,
          committedAt: new Date(),
        })
        .where(eq(ImportSession.id, session.id));

      // Audit log
      await logAudit(ctx.db, ctx.user, {
        action: "catalog.bulk_import",
        entity: "catalog_import",
        entityId: session.id,
        newValue: {
          sessionId: session.id,
          filename: session.filename,
          idempotencyKey: session.idempotencyKey,
          inserted,
          updated,
          skipped,
          failed,
        },
      });

      return {
        inserted,
        updated,
        skipped,
        failed,
        errors,
      };
    }),

  /**
   * Get session details + row statuses.
   *
   * RBAC: any authenticated user (PRD §4)
   */
  getSession: workspaceProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [session] = await ctx.db
        .select()
        .from(ImportSession)
        .where(eq(ImportSession.id, input.sessionId))
        .limit(1);

      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Sesión de importación no encontrada",
        });
      }

      // Check if session belongs to the user
      if (session.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "No tiene acceso a esta sesión de importación",
        });
      }

      // Lazy expiration check (PRD NFR-7)
      if (
        session.status !== "committed" &&
        session.status !== "failed" &&
        new Date() > session.expiresAt
      ) {
        await ctx.db
          .update(ImportSession)
          .set({ status: "expired" })
          .where(eq(ImportSession.id, session.id));
        return { ...session, status: "expired" as const };
      }

      return session;
    }),
});
