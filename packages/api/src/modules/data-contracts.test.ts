/**
 * Cendaro — Data Contracts Unit Tests (T4.0)
 *
 * Verifies pagination, filtering (multi-status, channels, date ranges),
 * and sorting contracts for sales.listOrders, catalog.listProducts,
 * inventory.stockOverview, and inventory.warehouseStock.
 */
import { describe, expect, it } from "vitest";

import { listProductsInputSchema } from "./catalog";
import {
  stockOverviewInputSchema,
  warehouseStockInputSchema,
} from "./inventory";
import { listOrdersInputSchema } from "./sales";

describe("T4.0 Data Contracts — sales.listOrders input", () => {
  it("provides sensible defaults for pagination", () => {
    const parsed = listOrdersInputSchema.parse({});
    expect(parsed.limit).toBe(25);
    expect(parsed.offset).toBe(0);
    expect(parsed.status).toBeUndefined();
    expect(parsed.statuses).toBeUndefined();
    expect(parsed.channel).toBeUndefined();
    expect(parsed.channels).toBeUndefined();
    expect(parsed.sort).toBeUndefined();
  });

  it("accepts multiple statuses array", () => {
    const parsed = listOrdersInputSchema.parse({
      statuses: ["confirmed", "prepared", "dispatched"],
    });
    expect(parsed.statuses).toEqual(["confirmed", "prepared", "dispatched"]);
  });

  it("accepts multiple channels array", () => {
    const parsed = listOrdersInputSchema.parse({
      channels: ["store", "mercadolibre"],
    });
    expect(parsed.channels).toEqual(["store", "mercadolibre"]);
  });

  it("accepts date range filters (ISO strings and Date instances)", () => {
    const fromStr = "2026-09-01T00:00:00.000Z";
    const toDate = new Date("2026-09-14T23:59:59.000Z");

    const parsed = listOrdersInputSchema.parse({
      dateFrom: fromStr,
      dateTo: toDate,
    });
    expect(parsed.dateFrom).toBe(fromStr);
    expect(parsed.dateTo).toEqual(toDate);
  });

  it("accepts all valid sort options", () => {
    const sortOptions = [
      "createdAt:asc",
      "createdAt:desc",
      "total:asc",
      "total:desc",
      "orderNumber:asc",
      "orderNumber:desc",
    ] as const;

    for (const sort of sortOptions) {
      const parsed = listOrdersInputSchema.parse({ sort });
      expect(parsed.sort).toBe(sort);
    }
  });

  it("rejects invalid status or channel", () => {
    expect(() =>
      listOrdersInputSchema.parse({
        status: "invalid_status",
      }),
    ).toThrow();

    expect(() =>
      listOrdersInputSchema.parse({
        channel: "invalid_channel",
      }),
    ).toThrow();
  });
});

describe("T4.0 Data Contracts — catalog.listProducts input", () => {
  it("provides sensible defaults for pagination", () => {
    const parsed = listProductsInputSchema.parse({});
    expect(parsed.limit).toBe(25);
    expect(parsed.offset).toBe(0);
    expect(parsed.status).toBeUndefined();
    expect(parsed.statuses).toBeUndefined();
    expect(parsed.sort).toBeUndefined();
  });

  it("accepts multiple statuses array", () => {
    const parsed = listProductsInputSchema.parse({
      statuses: ["active", "draft"],
    });
    expect(parsed.statuses).toEqual(["active", "draft"]);
  });

  it("accepts array of brandIds, categoryIds, and supplierIds", () => {
    const brandId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
    const categoryId = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";
    const supplierId = "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33";

    const parsed = listProductsInputSchema.parse({
      brandIds: [brandId],
      categoryIds: [categoryId],
      supplierIds: [supplierId],
    });
    expect(parsed.brandIds).toEqual([brandId]);
    expect(parsed.categoryIds).toEqual([categoryId]);
    expect(parsed.supplierIds).toEqual([supplierId]);
  });

  it("accepts all valid catalog sort options", () => {
    const sortOptions = [
      "createdAt:asc",
      "createdAt:desc",
      "name:asc",
      "name:desc",
      "sku:asc",
      "sku:desc",
    ] as const;

    for (const sort of sortOptions) {
      const parsed = listProductsInputSchema.parse({ sort });
      expect(parsed.sort).toBe(sort);
    }
  });
});

describe("T4.0 Data Contracts — inventory.stockOverview input", () => {
  it("accepts empty object without error (backward compatible)", () => {
    const parsed = stockOverviewInputSchema.parse({});
    expect(parsed.limit).toBeUndefined();
    expect(parsed.offset).toBe(0);
    expect(parsed.search).toBeUndefined();
    expect(parsed.onlyLocked).toBeUndefined();
  });

  it("accepts limit, offset, and cursor for virtualized table scrolling", () => {
    const parsed = stockOverviewInputSchema.parse({
      limit: 50,
      offset: 100,
      cursor: 100,
    });
    expect(parsed.limit).toBe(50);
    expect(parsed.offset).toBe(100);
    expect(parsed.cursor).toBe(100);
  });

  it("accepts status and statuses array for inventory levels", () => {
    const parsed = stockOverviewInputSchema.parse({
      statuses: ["low_stock", "out_of_stock"],
    });
    expect(parsed.statuses).toEqual(["low_stock", "out_of_stock"]);
  });

  it("accepts valid inventory sort options", () => {
    const sortOptions = [
      "name:asc",
      "name:desc",
      "sku:asc",
      "sku:desc",
      "totalStock:asc",
      "totalStock:desc",
    ] as const;

    for (const sort of sortOptions) {
      const parsed = stockOverviewInputSchema.parse({ sort });
      expect(parsed.sort).toBe(sort);
    }
  });
});

describe("T4.0 Data Contracts — inventory.warehouseStock input", () => {
  const warehouseId = "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44";

  it("requires warehouseId and defaults offset", () => {
    const parsed = warehouseStockInputSchema.parse({ warehouseId });
    expect(parsed.warehouseId).toBe(warehouseId);
    expect(parsed.offset).toBe(0);
    expect(parsed.limit).toBeUndefined();
  });

  it("accepts limit, search, cursor and sort", () => {
    const parsed = warehouseStockInputSchema.parse({
      warehouseId,
      limit: 50,
      cursor: 50,
      search: "cables",
      sort: "quantity:desc",
    });
    expect(parsed.limit).toBe(50);
    expect(parsed.cursor).toBe(50);
    expect(parsed.search).toBe("cables");
    expect(parsed.sort).toBe("quantity:desc");
  });
});
