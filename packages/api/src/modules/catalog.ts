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
  priceTypeEnum,
  Product,
  ProductAttribute,
  ProductPrice,
  productStatusEnum,
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
  catalogMemoryCache.set(key, { data, expiry: now + CACHE_TTL });
  return data;
}

function invalidateCacheKey(workspaceId: string, entity: string) {
  const key = getCacheKey(workspaceId, entity);
  catalogMemoryCache.delete(key);
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

      return {
        items: rows,
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

      const [attributes, prices, stockLedger, channelAllocations] =
        await Promise.all([
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
        ]);

      return {
        ...product,
        attributes,
        prices,
        stockLedger,
        channelAllocations,
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
      const [product] = await ctx.db.insert(Product).values(input).returning();

      await logAudit(ctx.db, ctx.user, {
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
        .where(eq(Product.id, id))
        .returning();

      await logAudit(ctx.db, ctx.user, {
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
      const [brand] = await ctx.db.insert(Brand).values(input).returning();
      await logAudit(ctx.db, ctx.user, {
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
          attributesTemplate: input.attributesTemplate ?? null,
        })
        .returning();
      await logAudit(ctx.db, ctx.user, {
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
        .values(input)
        .returning();
      await logAudit(ctx.db, ctx.user, {
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
      const [price] = await ctx.db
        .insert(ProductPrice)
        .values(input)
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

      await logAudit(ctx.db, ctx.user, {
        action: "price.set",
        entity: "product_price",
        entityId: input.productId,
        newValue: { priceType: input.priceType, amountUsd: input.amountUsd },
      });

      return price;
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
        .where(eq(ProductAttribute.productId, input.productId));

      if (input.attributes.length > 0) {
        await ctx.db.insert(ProductAttribute).values(
          input.attributes.map((attr) => ({
            productId: input.productId,
            key: attr.key,
            value: attr.value,
          })),
        );
      }

      await logAudit(ctx.db, ctx.user, {
        action: "product.attributes_update",
        entity: "product_attribute",
        entityId: input.productId,
        newValue: { count: input.attributes.length },
      });

      return { success: true };
    }),
});
