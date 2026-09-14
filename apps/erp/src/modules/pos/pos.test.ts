import { describe, expect, it } from "vitest";

import type { CartLine, ProductItem } from "./types";

function calculateCartTotals(cart: CartLine[]) {
  const subtotal = cart.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );
  const discount = cart.reduce(
    (sum, item) => sum + item.discount * item.quantity,
    0,
  );
  const total = Math.max(0, subtotal - discount);
  const totalUnits = cart.reduce((sum, item) => sum + item.quantity, 0);
  return { subtotal, discount, total, totalUnits };
}

function filterProducts(
  products: ProductItem[],
  selectedCategory: string,
  searchQuery: string,
) {
  const q = searchQuery.toLowerCase().trim();
  return products.filter((p) => {
    const matchCat =
      selectedCategory === "all" || p.categoryId === selectedCategory;
    if (!matchCat) return false;
    if (!q) return true;
    return (
      p.sku.toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q) ||
      Boolean(p.barcode?.toLowerCase().includes(q))
    );
  });
}

describe("POS Core Logic", () => {
  const sampleProducts: ProductItem[] = [
    {
      id: "prod-1",
      sku: "LUB-5W30",
      name: "Aceite Sintético 5W-30",
      barcode: "7591234567890",
      categoryId: "cat-lub",
      status: "active",
      imageUrl: null,
    },
    {
      id: "prod-2",
      sku: "FIL-OIL-01",
      name: "Filtro de Aceite Automotriz",
      barcode: "7591234567891",
      categoryId: "cat-fil",
      status: "active",
      imageUrl: null,
    },
    {
      id: "prod-3",
      sku: "PAST-FR-CER",
      name: "Pastillas Cerámicas D1044",
      barcode: null,
      categoryId: "cat-fre",
      status: "active",
      imageUrl: null,
    },
  ];

  it("calculates cart subtotal, discount, and total accurately", () => {
    const cart: CartLine[] = [
      {
        id: "prod-1",
        sku: "LUB-5W30",
        name: "Aceite Sintético 5W-30",
        quantity: 2,
        unitPrice: 20,
        discount: 2,
        lineTotal: 36,
      },
      {
        id: "prod-2",
        sku: "FIL-OIL-01",
        name: "Filtro de Aceite Automotriz",
        quantity: 1,
        unitPrice: 10,
        discount: 0,
        lineTotal: 10,
      },
    ];

    const totals = calculateCartTotals(cart);
    expect(totals.subtotal).toBe(50);
    expect(totals.discount).toBe(4);
    expect(totals.total).toBe(46);
    expect(totals.totalUnits).toBe(3);
  });

  it("returns zero totals when cart is empty", () => {
    const totals = calculateCartTotals([]);
    expect(totals.subtotal).toBe(0);
    expect(totals.discount).toBe(0);
    expect(totals.total).toBe(0);
    expect(totals.totalUnits).toBe(0);
  });

  it("filters products by category", () => {
    const lubs = filterProducts(sampleProducts, "cat-lub", "");
    expect(lubs).toHaveLength(1);
    expect(lubs[0]?.sku).toBe("LUB-5W30");

    const all = filterProducts(sampleProducts, "all", "");
    expect(all).toHaveLength(3);
  });

  it("filters products by search query matching SKU, name, or barcode", () => {
    const bySku = filterProducts(sampleProducts, "all", "lub-5w30");
    expect(bySku).toHaveLength(1);

    const byName = filterProducts(sampleProducts, "all", "cerámicas");
    expect(byName).toHaveLength(1);
    expect(byName[0]?.id).toBe("prod-3");

    const byBarcode = filterProducts(sampleProducts, "all", "7591234567891");
    expect(byBarcode).toHaveLength(1);
    expect(byBarcode[0]?.id).toBe("prod-2");
  });
});
