import { describe, expect, it } from "vitest";

import { inventoryFilterParsers } from "./use-inventory-filter-params";
import { orderFilterParsers } from "./use-order-filter-params";
import { productFilterParsers } from "./use-product-filter-params";

describe("orderFilterParsers (PLAN-2026-09-DESIGN-SYSTEM §T4.2)", () => {
  it("provides default values matching expected filter contracts", () => {
    expect(orderFilterParsers.search.defaultValue).toBe("");
    expect(orderFilterParsers.status.defaultValue).toBe("all");
    expect(orderFilterParsers.statuses.defaultValue).toEqual([]);
    expect(orderFilterParsers.channel.defaultValue).toBe("all");
    expect(orderFilterParsers.channels.defaultValue).toEqual([]);
    expect(orderFilterParsers.dateFrom.defaultValue).toBe("");
    expect(orderFilterParsers.dateTo.defaultValue).toBe("");
    expect(orderFilterParsers.sort.defaultValue).toBe("");
    expect(orderFilterParsers.createOrder.defaultValue).toBe(false);
  });

  it("correctly parses multi-status query parameter", () => {
    const result =
      orderFilterParsers.statuses.parseServerSide("confirmed,prepared");
    expect(result).toEqual(["confirmed", "prepared"]);
  });

  it("correctly parses multi-channel query parameter", () => {
    const result =
      orderFilterParsers.channels.parseServerSide("store,whatsapp");
    expect(result).toEqual(["store", "whatsapp"]);
  });

  it("correctly parses boolean dialog trigger", () => {
    expect(orderFilterParsers.createOrder.parseServerSide("true")).toBe(true);
    expect(orderFilterParsers.createOrder.parseServerSide("false")).toBe(false);
    expect(orderFilterParsers.createOrder.parseServerSide("")).toBe(false);
  });
});

describe("productFilterParsers (PLAN-2026-09-DESIGN-SYSTEM §T4.2)", () => {
  it("provides default values matching catalog filter contracts", () => {
    expect(productFilterParsers.search.defaultValue).toBe("");
    expect(productFilterParsers.status.defaultValue).toBe("all");
    expect(productFilterParsers.statuses.defaultValue).toEqual([]);
    expect(productFilterParsers.brandId.defaultValue).toBe("all");
    expect(productFilterParsers.brandIds.defaultValue).toEqual([]);
    expect(productFilterParsers.categoryId.defaultValue).toBe("all");
    expect(productFilterParsers.categoryIds.defaultValue).toEqual([]);
    expect(productFilterParsers.supplierId.defaultValue).toBe("all");
    expect(productFilterParsers.supplierIds.defaultValue).toEqual([]);
    expect(productFilterParsers.sort.defaultValue).toBe("");
    expect(productFilterParsers.page.defaultValue).toBe(0);
  });

  it("correctly parses multi-brand and multi-category arrays", () => {
    const brands =
      productFilterParsers.brandIds.parseServerSide("brand-1,brand-2");
    expect(brands).toEqual(["brand-1", "brand-2"]);

    const categories =
      productFilterParsers.categoryIds.parseServerSide("cat-1,cat-2,cat-3");
    expect(categories).toEqual(["cat-1", "cat-2", "cat-3"]);
  });

  it("correctly parses integer page offset", () => {
    expect(productFilterParsers.page.parseServerSide("3")).toBe(3);
    expect(productFilterParsers.page.parseServerSide("0")).toBe(0);
  });
});

describe("inventoryFilterParsers (PLAN-2026-09-DESIGN-SYSTEM §T4.2)", () => {
  it("provides default values matching inventory filter contracts", () => {
    expect(inventoryFilterParsers.search.defaultValue).toBe("");
    expect(inventoryFilterParsers.status.defaultValue).toBe("all");
    expect(inventoryFilterParsers.statuses.defaultValue).toEqual([]);
    expect(inventoryFilterParsers.warehouseId.defaultValue).toBe("");
    expect(inventoryFilterParsers.sort.defaultValue).toBe("");
  });

  it("correctly parses stock status parameter", () => {
    expect(inventoryFilterParsers.status.parseServerSide("low_stock")).toBe(
      "low_stock",
    );
    expect(inventoryFilterParsers.status.parseServerSide("out_of_stock")).toBe(
      "out_of_stock",
    );
  });

  it("correctly parses multi-status array for inventory", () => {
    const statuses =
      inventoryFilterParsers.statuses.parseServerSide("in_stock,low_stock");
    expect(statuses).toEqual(["in_stock", "low_stock"]);
  });
});
