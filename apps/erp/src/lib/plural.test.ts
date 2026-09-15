import { describe, expect, it } from "vitest";

import { formatPlural, pluralize } from "./plural";

describe("pluralize", () => {
  it("returns singular for count = 1", () => {
    expect(pluralize(1, "pedido", "pedidos")).toBe("pedido");
    expect(pluralize(1, "orden", "órdenes")).toBe("orden");
    expect(pluralize(1, "producto", "productos")).toBe("producto");
  });

  it("returns plural for count = 0", () => {
    expect(pluralize(0, "pedido", "pedidos")).toBe("pedidos");
    expect(pluralize(0, "orden", "órdenes")).toBe("órdenes");
  });

  it("returns plural for count > 1", () => {
    expect(pluralize(2, "pedido", "pedidos")).toBe("pedidos");
    expect(pluralize(50, "producto", "productos")).toBe("productos");
    expect(pluralize(1200, "orden", "órdenes")).toBe("órdenes");
  });

  it("handles negative numbers properly", () => {
    expect(pluralize(-1, "unidad", "unidades")).toBe("unidad");
    expect(pluralize(-5, "unidad", "unidades")).toBe("unidades");
  });
});

describe("formatPlural", () => {
  it("formats singular with count", () => {
    expect(formatPlural(1, "pedido", "pedidos")).toBe("1 pedido");
    expect(formatPlural(1, "orden", "órdenes")).toBe("1 orden");
  });

  it("formats plural with count and locale formatting", () => {
    expect(formatPlural(0, "pedido", "pedidos")).toBe("0 pedidos");
    expect(formatPlural(5, "producto", "productos")).toBe("5 productos");
    // With es-VE, 1200 is formatted as 1.200 or 1,200 depending on ICU runtime
    const formatted = formatPlural(1200, "orden", "órdenes");
    expect(formatted).toMatch(/1[.,]200 órdenes/);
  });
});
