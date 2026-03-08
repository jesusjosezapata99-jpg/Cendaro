/**
 * Cendaro — Catalog Router
 *
 * CRUD + search + filters for products, brands, categories, suppliers.
 * PRD §10: 5000+ SKUs, full-text search, hierarchical categories.
 */
import { z } from "zod/v4";
import { desc, eq, ilike, or, and, count } from "drizzle-orm";

import {
  Product,
  Brand,
  Category,
  Supplier,
  ProductAttribute,
  ProductPrice,
  productStatusEnum,
  priceTypeEnum,
} from "@cendaro/db/schema";

import {
  createTRPCRouter,
  protectedProcedure,
  roleRestrictedProcedure,
} from "../trpc";
import { logAudit } from "./audit";

export const catalogRouter = createTRPCRouter({
  // ─── Products ────────────────────────────────

  /** List products with search, filters, and pagination */
  listProducts: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(25),
        offset: z.number().int().min(0).default(0),
        search: z.string().max(256).optional(),
        brandId: z.string().uuid().optional(),
        categoryId: z.string().uuid().optional(),
        supplierId: z.string().uuid().optional(),
        status: z.enum(productStatusEnum.enumValues).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [];

      if (input.search) {
        conditions.push(
          or(
            ilike(Product.name, `%${input.search}%`),
            ilike(Product.sku, `%${input.search}%`),
            ilike(Product.barcode, `%${input.search}%`),
          ),
        );
      }
      if (input.brandId) conditions.push(eq(Product.brandId, input.brandId));
      if (input.categoryId) conditions.push(eq(Product.categoryId, input.categoryId));
      if (input.supplierId) conditions.push(eq(Product.supplierId, input.supplierId));
      if (input.status) conditions.push(eq(Product.status, input.status));

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
          .orderBy(desc(Product.createdAt))
          .limit(input.limit)
          .offset(input.offset),
        ctx.db
          .select({ total: count() })
          .from(Product)
          .where(where),
      ]);

      return {
        items: rows,
        total: totalResult[0]?.total ?? 0,
      };
    }),

  /** Get product by ID with relations */
  productById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [product] = await ctx.db
        .select()
        .from(Product)
        .where(eq(Product.id, input.id))
        .limit(1);

      if (!product) return null;

      const [attributes, prices] = await Promise.all([
        ctx.db.select().from(ProductAttribute).where(eq(ProductAttribute.productId, input.id)),
        ctx.db.select().from(ProductPrice).where(eq(ProductPrice.productId, input.id)),
      ]);

      return { ...product, attributes, prices };
    }),

  /** Create product (admin, owner, supervisor) */
  createProduct: roleRestrictedProcedure(["owner", "admin", "supervisor"])
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
        status: z.enum(productStatusEnum.enumValues).default("draft"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [product] = await ctx.db
        .insert(Product)
        .values(input)
        .returning();

      await logAudit(ctx.db, ctx.user, {
        action: "product.create",
        entity: "product",
        entityId: product?.id,
        newValue: { sku: input.sku, name: input.name },
      });

      return product;
    }),

  /** Update product (admin, owner, supervisor) */
  updateProduct: roleRestrictedProcedure(["owner", "admin", "supervisor"])
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

  listBrands: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(Brand).orderBy(Brand.name).limit(200);
  }),

  createBrand: roleRestrictedProcedure(["owner", "admin", "supervisor"])
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
      return brand;
    }),

  // ─── Categories ──────────────────────────────

  listCategories: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(Category).orderBy(Category.sortOrder, Category.name).limit(500);
  }),

  createCategory: roleRestrictedProcedure(["owner", "admin", "supervisor"])
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
      return category;
    }),

  // ─── Suppliers ───────────────────────────────

  listSuppliers: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(Supplier).orderBy(Supplier.name).limit(200);
  }),

  createSupplier: roleRestrictedProcedure(["owner", "admin", "supervisor"])
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
      const [supplier] = await ctx.db.insert(Supplier).values(input).returning();
      await logAudit(ctx.db, ctx.user, {
        action: "supplier.create",
        entity: "supplier",
        entityId: supplier?.id,
        newValue: { name: input.name },
      });
      return supplier;
    }),

  // ─── Product Prices ──────────────────────────

  setPrice: roleRestrictedProcedure(["owner", "admin", "supervisor"])
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

  setAttributes: roleRestrictedProcedure(["owner", "admin", "supervisor"])
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
