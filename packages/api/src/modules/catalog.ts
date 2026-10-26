/**
 * Cendaro — Catalog Router
 *
 * CRUD + search + filters for products, brands, categories, suppliers.
 * PRD §10: 5000+ SKUs, full-text search, hierarchical categories.
 */
import { and, asc, count, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { z } from "zod/v4";

import {
  Brand,
  Category,
  ChannelAllocation,
  PriceHistory,
  priceTypeEnum,
  Product,
  ProductAttribute,
  ProductPrice,
  productStatusEnum,
  ProductSupplier,
  ProductUomEquivalence,
  StockLedger,
  Supplier,
} from "@cendaro/db/schema";

import {
  createTRPCRouter,
  wsPermissionProcedure,
  wsReadPermissionProcedure,
} from "../trpc";
import { logAudit } from "./audit";

// ─── Query Cache (Workspace-Scoped) ───────────
interface CacheEntry<T> {
  data: T;
  expiry: number;
}

const catalogMemoryCache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL = 3600_000; // 1-hour cache
const CATALOG_CACHE_MAX = 500;

function getCacheKey(workspaceId: string, entity: string): string {
  return `${workspaceId}:${entity}`;
}

async function getCachedData<T>(
  workspaceId: string,
  entity: string,
  fetchFn: () => Promise<T>,
): Promise<T> {
  const key = getCacheKey(workspaceId, entity);
  const now = Date.now();
  const cached = catalogMemoryCache.get(key);

  if (cached && cached.expiry > now) {
    return cached.data as T;
  }

  const data = await fetchFn();
  if (catalogMemoryCache.size >= CATALOG_CACHE_MAX) {
    const oldest = catalogMemoryCache.keys().next().value;
    if (oldest) catalogMemoryCache.delete(oldest);
  }
  catalogMemoryCache.set(key, { data, expiry: now + CACHE_TTL });
  return data;
}

export function invalidateCacheKey(workspaceId: string, entity: string): void {
  const key = getCacheKey(workspaceId, entity);
  catalogMemoryCache.delete(key);
}

export function invalidateCatalogCache(workspaceId: string): void {
  for (const entity of ["brands", "categories", "suppliers"]) {
    invalidateCacheKey(workspaceId, entity);
  }
}

export const listProductsInputSchema = z.object({
  limit: z.number().int().min(1).max(100).default(25),
  offset: z.number().int().min(0).default(0),
  cursor: z.number().int().min(0).nullish(),
  search: z.string().max(256).optional(),
  brandId: z.string().uuid().optional(),
  brandIds: z.array(z.string().uuid()).optional(),
  categoryId: z.string().uuid().optional(),
  categoryIds: z.array(z.string().uuid()).optional(),
  supplierId: z.string().uuid().optional(),
  supplierIds: z.array(z.string().uuid()).optional(),
  status: z.enum(productStatusEnum.enumValues).optional(),
  statuses: z.array(z.enum(productStatusEnum.enumValues)).optional(),
  sort: z
    .enum([
      "createdAt:asc",
      "createdAt:desc",
      "name:asc",
      "name:desc",
      "sku:asc",
      "sku:desc",
    ])
    .optional(),
});
export type ListProductsInput = z.infer<typeof listProductsInputSchema>;

export const catalogRouter = createTRPCRouter({
  // ─── Products ────────────────────────────────

  /** List products with search, filters, and pagination */
  listProducts: wsReadPermissionProcedure("catalog", "read")
    .input(listProductsInputSchema)
    .query(async ({ ctx, input }) => {
      const conditions = [eq(Product.workspaceId, ctx.workspace.workspaceId)];

      if (input.search) {
        // Escape LIKE wildcards to prevent pattern injection
        const escaped = input.search
          .replace(/\\/g, "\\\\")
          .replace(/%/g, "\\%")
          .replace(/_/g, "\\_");
        const orCond = or(
          ilike(Product.name, `%${escaped}%`),
          ilike(Product.sku, `%${escaped}%`),
          ilike(Product.barcode, `%${escaped}%`),
        );
        if (orCond) conditions.push(orCond);
      }

      if (input.statuses && input.statuses.length > 0) {
        conditions.push(inArray(Product.status, input.statuses));
      } else if (input.status) {
        conditions.push(eq(Product.status, input.status));
      }

      if (input.brandIds && input.brandIds.length > 0) {
        conditions.push(inArray(Product.brandId, input.brandIds));
      } else if (input.brandId) {
        conditions.push(eq(Product.brandId, input.brandId));
      }

      if (input.categoryIds && input.categoryIds.length > 0) {
        conditions.push(inArray(Product.categoryId, input.categoryIds));
      } else if (input.categoryId) {
        conditions.push(eq(Product.categoryId, input.categoryId));
      }

      if (input.supplierIds && input.supplierIds.length > 0) {
        conditions.push(inArray(Product.supplierId, input.supplierIds));
      } else if (input.supplierId) {
        conditions.push(eq(Product.supplierId, input.supplierId));
      }

      // Sorting
      let orderByClause = desc(Product.createdAt);
      if (input.sort) {
        switch (input.sort) {
          case "createdAt:asc":
            orderByClause = asc(Product.createdAt);
            break;
          case "createdAt:desc":
            orderByClause = desc(Product.createdAt);
            break;
          case "name:asc":
            orderByClause = asc(Product.name);
            break;
          case "name:desc":
            orderByClause = desc(Product.name);
            break;
          case "sku:asc":
            orderByClause = asc(Product.sku);
            break;
          case "sku:desc":
            orderByClause = desc(Product.sku);
            break;
        }
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [rows, totalResult] = await Promise.all([
        ctx.db
          .select({
            id: Product.id,
            sku: Product.sku,
            name: Product.name,
            barcode: Product.barcode,
            imageUrl: Product.imageUrl,
            status: Product.status,
            brandId: Product.brandId,
            categoryId: Product.categoryId,
            supplierId: Product.supplierId,
            createdAt: Product.createdAt,
          })
          .from(Product)
          .where(where)
          .orderBy(orderByClause)
          .limit(input.limit)
          .offset(input.cursor ?? input.offset),
        ctx.db.select({ total: count() }).from(Product).where(where),
      ]);

      const productIds = rows.map((r) => r.id).filter(Boolean);
      const priceMap = new Map<
        string,
        { basePriceUsd: number | null; posPriceUsd: number | null }
      >();

      if (productIds.length > 0) {
        const prices = await ctx.db
          .select({
            productId: ProductPrice.productId,
            priceType: ProductPrice.priceType,
            amountUsd: ProductPrice.amountUsd,
          })
          .from(ProductPrice)
          .where(
            and(
              eq(ProductPrice.workspaceId, ctx.workspace.workspaceId),
              inArray(ProductPrice.productId, productIds),
            ),
          );

        for (const p of prices) {
          if (!p.productId || typeof p.amountUsd !== "number") continue;
          const entry = priceMap.get(p.productId) ?? {
            basePriceUsd: null,
            posPriceUsd: null,
          };
          if (p.priceType === "wholesale") {
            entry.basePriceUsd = p.amountUsd;
          } else if (p.priceType === "store") {
            entry.posPriceUsd = p.amountUsd;
            entry.basePriceUsd ??= p.amountUsd;
          } else {
            entry.basePriceUsd ??= p.amountUsd;
          }
          priceMap.set(p.productId, entry);
        }
      }

      const items = rows.map((r) => {
        const prices = priceMap.get(r.id);
        return {
          ...r,
          basePriceUsd: prices?.basePriceUsd ?? null,
          posPriceUsd: prices?.posPriceUsd ?? null,
        };
      });

      return {
        items,
        total: totalResult[0]?.total ?? 0,
      };
    }),

  /** Get product by ID with relations */
  productById: wsReadPermissionProcedure("catalog", "read")
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [product] = await ctx.db
        .select()
        .from(Product)
        .where(
          and(
            eq(Product.id, input.id),
            eq(Product.workspaceId, ctx.workspace.workspaceId),
          ),
        )
        .limit(1);

      if (!product) return null;

      const [
        attributes,
        prices,
        stockLedger,
        channelAllocations,
        uomEquivalences,
        productSuppliers,
      ] = await Promise.all([
        ctx.db
          .select()
          .from(ProductAttribute)
          .where(eq(ProductAttribute.productId, input.id)),
        ctx.db
          .select()
          .from(ProductPrice)
          .where(eq(ProductPrice.productId, input.id)),
        ctx.db
          .select()
          .from(StockLedger)
          .where(eq(StockLedger.productId, input.id)),
        ctx.db
          .select()
          .from(ChannelAllocation)
          .where(eq(ChannelAllocation.productId, input.id)),
        ctx.db
          .select()
          .from(ProductUomEquivalence)
          .where(eq(ProductUomEquivalence.productId, input.id)),
        ctx.db
          .select()
          .from(ProductSupplier)
          .where(eq(ProductSupplier.productId, input.id)),
      ]);

      return {
        ...product,
        attributes,
        prices,
        stockLedger,
        channelAllocations,
        uomEquivalences,
        productSuppliers,
      };
    }),

  /** Create product — catalog-level only (owner, admin, supervisor) */
  createProduct: wsPermissionProcedure("catalog", "create")
    .input(
      z.object({
        sku: z.string().min(1).max(64),
        barcode: z.string().max(128).optional(),
        name: z.string().min(1).max(512),
        descriptionShort: z.string().max(512).optional(),
        descriptionLong: z.string().optional(),
        brandId: z.string().uuid().optional(),
        categoryId: z.string().uuid().optional(),
        supplierId: z.string().uuid().optional(),
        imageUrl: z.string().url().optional(),
        weight: z.number().nonnegative().optional(),
        volume: z.number().nonnegative().optional(),
        baseUom: z.enum(["unit", "box", "bulk", "pack"]).default("unit"),
        unitsPerBox: z.number().int().positive().optional(),
        boxesPerBulk: z.number().int().positive().optional(),
        sellingUnit: z
          .enum(["unit", "box", "dozen", "half_dozen", "bulk"])
          .default("unit"),
        status: z.enum(productStatusEnum.enumValues).default("draft"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [product] = await ctx.db
        .insert(Product)
        .values({ ...input, workspaceId: ctx.workspace.workspaceId })
        .returning();

      await logAudit(ctx.db, ctx.user, {
        workspaceId: ctx.workspace.workspaceId,
        action: "product.create",
        entity: "product",
        entityId: product?.id,
        newValue: {
          sku: input.sku,
          name: input.name,
          baseUom: input.baseUom,
          sellingUnit: input.sellingUnit,
        },
      });

      return product;
    }),

  updateProduct: wsPermissionProcedure("catalog", "update")
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(512).optional(),
        barcode: z.string().max(128).optional(),
        descriptionShort: z.string().max(512).optional(),
        descriptionLong: z.string().optional(),
        brandId: z.string().uuid().optional(),
        categoryId: z.string().uuid().optional(),
        supplierId: z.string().uuid().optional(),
        imageUrl: z.string().url().optional(),
        weight: z.number().nonnegative().optional(),
        volume: z.number().nonnegative().optional(),
        status: z.enum(productStatusEnum.enumValues).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;

      const [updated] = await ctx.db
        .update(Product)
        .set(updates)
        .where(
          and(
            eq(Product.id, id),
            eq(Product.workspaceId, ctx.workspace.workspaceId),
          ),
        )
        .returning();

      await logAudit(ctx.db, ctx.user, {
        workspaceId: ctx.workspace.workspaceId,
        action: "product.update",
        entity: "product",
        entityId: id,
        newValue: updates,
      });

      return updated;
    }),

  // ─── Brands ──────────────────────────────────

  listBrands: wsReadPermissionProcedure("catalog", "read").query(
    async ({ ctx }) => {
      return getCachedData(ctx.workspace.workspaceId, "brands", () =>
        ctx.db
          .select({
            id: Brand.id,
            name: Brand.name,
            slug: Brand.slug,
            logoUrl: Brand.logoUrl,
            description: Brand.description,
          })
          .from(Brand)
          .where(eq(Brand.workspaceId, ctx.workspace.workspaceId))
          .orderBy(Brand.name)
          .limit(200),
      );
    },
  ),

  createBrand: wsPermissionProcedure("catalog", "create")
    .input(
      z.object({
        name: z.string().min(1).max(256),
        slug: z.string().min(1).max(256),
        logoUrl: z.string().url().optional(),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [brand] = await ctx.db
        .insert(Brand)
        .values({ ...input, workspaceId: ctx.workspace.workspaceId })
        .returning();
      await logAudit(ctx.db, ctx.user, {
        workspaceId: ctx.workspace.workspaceId,
        action: "brand.create",
        entity: "brand",
        entityId: brand?.id,
        newValue: { name: input.name },
      });
      invalidateCacheKey(ctx.workspace.workspaceId, "brands");
      return brand;
    }),

  // ─── Categories ──────────────────────────────

  listCategories: wsReadPermissionProcedure("catalog", "read").query(
    async ({ ctx }) => {
      return getCachedData(ctx.workspace.workspaceId, "categories", () =>
        ctx.db
          .select({
            id: Category.id,
            name: Category.name,
            slug: Category.slug,
            parentId: Category.parentId,
            depth: Category.depth,
            sortOrder: Category.sortOrder,
          })
          .from(Category)
          .where(eq(Category.workspaceId, ctx.workspace.workspaceId))
          .orderBy(Category.sortOrder, Category.name)
          .limit(500),
      );
    },
  ),

  createCategory: wsPermissionProcedure("catalog", "create")
    .input(
      z.object({
        name: z.string().min(1).max(256),
        slug: z.string().min(1).max(256),
        parentId: z.string().uuid().optional(),
        depth: z.number().int().min(0).default(0),
        sortOrder: z.number().int().default(0),
        attributesTemplate: z.record(z.string(), z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [category] = await ctx.db
        .insert(Category)
        .values({
          ...input,
          workspaceId: ctx.workspace.workspaceId,
          attributesTemplate: input.attributesTemplate ?? null,
        })
        .returning();
      await logAudit(ctx.db, ctx.user, {
        workspaceId: ctx.workspace.workspaceId,
        action: "category.create",
        entity: "category",
        entityId: category?.id,
        newValue: { name: input.name },
      });
      invalidateCacheKey(ctx.workspace.workspaceId, "categories");
      return category;
    }),

  // ─── Suppliers ───────────────────────────────

  listSuppliers: wsReadPermissionProcedure("catalog", "read").query(
    async ({ ctx }) => {
      return getCachedData(ctx.workspace.workspaceId, "suppliers", () =>
        ctx.db
          .select({
            id: Supplier.id,
            name: Supplier.name,
            country: Supplier.country,
            contactName: Supplier.contactName,
            contactEmail: Supplier.contactEmail,
            status: Supplier.status,
          })
          .from(Supplier)
          .where(eq(Supplier.workspaceId, ctx.workspace.workspaceId))
          .orderBy(Supplier.name)
          .limit(200),
      );
    },
  ),

  createSupplier: wsPermissionProcedure("catalog", "create")
    .input(
      z.object({
        name: z.string().min(1).max(256),
        rif: z.string().max(32).optional(),
        country: z.string().length(2).default("CN"),
        contactName: z.string().max(256).optional(),
        contactEmail: z.email().optional(),
        contactPhone: z.string().max(32).optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [supplier] = await ctx.db
        .insert(Supplier)
        .values({ ...input, workspaceId: ctx.workspace.workspaceId })
        .returning();
      await logAudit(ctx.db, ctx.user, {
        workspaceId: ctx.workspace.workspaceId,
        action: "supplier.create",
        entity: "supplier",
        entityId: supplier?.id,
        newValue: { name: input.name },
      });
      invalidateCacheKey(ctx.workspace.workspaceId, "suppliers");
      return supplier;
    }),

  // ─── Product Prices ──────────────────────────

  setPrice: wsPermissionProcedure("pricing", "update")
    .input(
      z.object({
        productId: z.string().uuid(),
        priceType: z.enum(priceTypeEnum.enumValues),
        amountUsd: z.number().nonnegative(),
        amountBs: z.number().nonnegative().optional(),
        rateUsed: z.number().positive().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select({
          amountUsd: ProductPrice.amountUsd,
        })
        .from(ProductPrice)
        .where(
          and(
            eq(ProductPrice.workspaceId, ctx.workspace.workspaceId),
            eq(ProductPrice.productId, input.productId),
            eq(ProductPrice.priceType, input.priceType),
          ),
        )
        .limit(1);

      const oldAmountUsd =
        typeof existing?.amountUsd === "number" ? existing.amountUsd : null;

      const [price] = await ctx.db
        .insert(ProductPrice)
        .values({ ...input, workspaceId: ctx.workspace.workspaceId })
        .onConflictDoUpdate({
          target: [ProductPrice.productId, ProductPrice.priceType],
          set: {
            amountUsd: input.amountUsd,
            amountBs: input.amountBs,
            rateUsed: input.rateUsed,
            updatedAt: new Date(),
          },
        })
        .returning();

      await ctx.db.insert(PriceHistory).values({
        workspaceId: ctx.workspace.workspaceId,
        productId: input.productId,
        priceType: input.priceType,
        oldAmountUsd,
        newAmountUsd: input.amountUsd,
        rateUsed: input.rateUsed,
        trigger: "manual",
        userId: ctx.user.id,
      });

      await logAudit(ctx.db, ctx.user, {
        workspaceId: ctx.workspace.workspaceId,
        action: "price.set",
        entity: "product_price",
        entityId: input.productId,
        oldValue:
          oldAmountUsd !== null ? { amountUsd: oldAmountUsd } : undefined,
        newValue: { priceType: input.priceType, amountUsd: input.amountUsd },
      });

      return price;
    }),

  // ─── UoM Equivalences & Product Suppliers ────

  setUomEquivalences: wsPermissionProcedure("catalog", "update")
    .input(
      z.object({
        productId: z.string().uuid(),
        equivalences: z.array(
          z.object({
            baseUom: z.enum(["unit", "box", "bulk", "pack"]).default("unit"),
            altUom: z.enum(["unit", "box", "bulk", "pack"]),
            conversionFactor: z.number().positive(),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(ProductUomEquivalence)
        .where(
          and(
            eq(ProductUomEquivalence.workspaceId, ctx.workspace.workspaceId),
            eq(ProductUomEquivalence.productId, input.productId),
          ),
        );

      if (input.equivalences.length > 0) {
        await ctx.db.insert(ProductUomEquivalence).values(
          input.equivalences.map((eqv) => ({
            workspaceId: ctx.workspace.workspaceId,
            productId: input.productId,
            baseUom: eqv.baseUom,
            altUom: eqv.altUom,
            conversionFactor: eqv.conversionFactor,
          })),
        );
      }

      await logAudit(ctx.db, ctx.user, {
        workspaceId: ctx.workspace.workspaceId,
        action: "product.uom_equivalences_update",
        entity: "product_uom_equivalence",
        entityId: input.productId,
        newValue: { count: input.equivalences.length },
      });

      return { success: true };
    }),

  linkProductSupplier: wsPermissionProcedure("catalog", "update")
    .input(
      z.object({
        productId: z.string().uuid(),
        supplierId: z.string().uuid(),
        supplierSku: z.string().max(128).optional(),
        cost: z.number().nonnegative().optional(),
        leadTimeDays: z.number().int().nonnegative().optional(),
        isPrimary: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .insert(ProductSupplier)
        .values({
          workspaceId: ctx.workspace.workspaceId,
          productId: input.productId,
          supplierId: input.supplierId,
          supplierSku: input.supplierSku,
          cost: input.cost,
          leadTimeDays: input.leadTimeDays,
          isPrimary: input.isPrimary,
        })
        .onConflictDoUpdate({
          target: [
            ProductSupplier.workspaceId,
            ProductSupplier.productId,
            ProductSupplier.supplierId,
          ],
          set: {
            supplierSku: input.supplierSku,
            cost: input.cost,
            leadTimeDays: input.leadTimeDays,
            isPrimary: input.isPrimary,
          },
        })
        .returning();

      await logAudit(ctx.db, ctx.user, {
        workspaceId: ctx.workspace.workspaceId,
        action: "product.supplier_link",
        entity: "product_supplier",
        entityId: row?.id ?? input.productId,
        newValue: {
          productId: input.productId,
          supplierId: input.supplierId,
          isPrimary: input.isPrimary,
        },
      });

      return row;
    }),

  // ─── Product Attributes ──────────────────────

  setAttributes: wsPermissionProcedure("catalog", "update")
    .input(
      z.object({
        productId: z.string().uuid(),
        attributes: z.array(
          z.object({
            key: z.string().min(1).max(128),
            value: z.string().min(1).max(512),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Delete existing and insert new
      await ctx.db
        .delete(ProductAttribute)
        .where(
          and(
            eq(ProductAttribute.productId, input.productId),
            eq(ProductAttribute.workspaceId, ctx.workspace.workspaceId),
          ),
        );

      if (input.attributes.length > 0) {
        await ctx.db.insert(ProductAttribute).values(
          input.attributes.map((attr) => ({
            workspaceId: ctx.workspace.workspaceId,
            productId: input.productId,
            key: attr.key,
            value: attr.value,
          })),
        );
      }

      await logAudit(ctx.db, ctx.user, {
        workspaceId: ctx.workspace.workspaceId,
        action: "product.attributes_update",
        entity: "product_attribute",
        entityId: input.productId,
        newValue: { count: input.attributes.length },
      });

      return { success: true };
    }),
});
