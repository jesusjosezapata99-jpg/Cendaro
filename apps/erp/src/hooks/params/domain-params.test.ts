import { describe, expect, it } from "vitest";

import {
  arParamsParsers,
  brandParamsParsers,
  categoryParamsParsers,
  closureParamsParsers,
  containerParamsParsers,
  customerParamsParsers,
  orderParamsParsers,
  paymentParamsParsers,
  productParamsParsers,
  quoteParamsParsers,
  supplierParamsParsers,
  userParamsParsers,
} from "./index";

describe("T5.1 — Domain Params Parsers Suite", () => {
  it("orderParamsParsers has orderId and createOrder with correct defaults", () => {
    expect(orderParamsParsers.orderId.parseServerSide("ord_123")).toBe(
      "ord_123",
    );
    expect(orderParamsParsers.orderId.parseServerSide(undefined)).toBe("");
    expect(orderParamsParsers.createOrder.parseServerSide("true")).toBe(true);
    expect(orderParamsParsers.createOrder.parseServerSide(undefined)).toBe(
      false,
    );
  });

  it("quoteParamsParsers has quoteId and createQuote with correct defaults", () => {
    expect(quoteParamsParsers.quoteId.parseServerSide("q_456")).toBe("q_456");
    expect(quoteParamsParsers.quoteId.parseServerSide(undefined)).toBe("");
    expect(quoteParamsParsers.createQuote.parseServerSide("true")).toBe(true);
    expect(quoteParamsParsers.createQuote.parseServerSide(undefined)).toBe(
      false,
    );
  });

  it("customerParamsParsers has customerId and createCustomer with correct defaults", () => {
    expect(customerParamsParsers.customerId.parseServerSide("cust_789")).toBe(
      "cust_789",
    );
    expect(customerParamsParsers.customerId.parseServerSide(undefined)).toBe(
      "",
    );
    expect(customerParamsParsers.createCustomer.parseServerSide("true")).toBe(
      true,
    );
    expect(
      customerParamsParsers.createCustomer.parseServerSide(undefined),
    ).toBe(false);
  });

  it("productParamsParsers has productId, createProduct, and editProduct with correct defaults", () => {
    expect(productParamsParsers.productId.parseServerSide("prod_101")).toBe(
      "prod_101",
    );
    expect(productParamsParsers.productId.parseServerSide(undefined)).toBe("");
    expect(productParamsParsers.createProduct.parseServerSide("true")).toBe(
      true,
    );
    expect(productParamsParsers.createProduct.parseServerSide(undefined)).toBe(
      false,
    );
    expect(productParamsParsers.editProduct.parseServerSide("prod_edit")).toBe(
      "prod_edit",
    );
    expect(productParamsParsers.editProduct.parseServerSide(undefined)).toBe(
      "",
    );
  });

  it("paymentParamsParsers has registerPayment and orderId with correct defaults", () => {
    expect(paymentParamsParsers.registerPayment.parseServerSide("true")).toBe(
      true,
    );
    expect(
      paymentParamsParsers.registerPayment.parseServerSide(undefined),
    ).toBe(false);
    expect(paymentParamsParsers.orderId.parseServerSide("ord_999")).toBe(
      "ord_999",
    );
    expect(paymentParamsParsers.orderId.parseServerSide(undefined)).toBe("");
  });

  it("containerParamsParsers has containerId and createContainer with correct defaults", () => {
    expect(containerParamsParsers.containerId.parseServerSide("cnt_555")).toBe(
      "cnt_555",
    );
    expect(containerParamsParsers.containerId.parseServerSide(undefined)).toBe(
      "",
    );
    expect(containerParamsParsers.createContainer.parseServerSide("true")).toBe(
      true,
    );
    expect(
      containerParamsParsers.createContainer.parseServerSide(undefined),
    ).toBe(false);
  });

  it("userParamsParsers has userId, createUser, and editUser with correct defaults", () => {
    expect(userParamsParsers.userId.parseServerSide("usr_333")).toBe("usr_333");
    expect(userParamsParsers.userId.parseServerSide(undefined)).toBe("");
    expect(userParamsParsers.createUser.parseServerSide("true")).toBe(true);
    expect(userParamsParsers.createUser.parseServerSide(undefined)).toBe(false);
    expect(userParamsParsers.editUser.parseServerSide("usr_edit")).toBe(
      "usr_edit",
    );
    expect(userParamsParsers.editUser.parseServerSide(undefined)).toBe("");
  });

  it("supplierParamsParsers has supplierId and createSupplier with correct defaults", () => {
    expect(supplierParamsParsers.supplierId.parseServerSide("sup_123")).toBe(
      "sup_123",
    );
    expect(supplierParamsParsers.supplierId.parseServerSide(undefined)).toBe(
      "",
    );
    expect(supplierParamsParsers.createSupplier.parseServerSide("true")).toBe(
      true,
    );
    expect(
      supplierParamsParsers.createSupplier.parseServerSide(undefined),
    ).toBe(false);
  });

  it("brandParamsParsers has brandId and createBrand with correct defaults", () => {
    expect(brandParamsParsers.brandId.parseServerSide("brd_123")).toBe(
      "brd_123",
    );
    expect(brandParamsParsers.brandId.parseServerSide(undefined)).toBe("");
    expect(brandParamsParsers.createBrand.parseServerSide("true")).toBe(true);
    expect(brandParamsParsers.createBrand.parseServerSide(undefined)).toBe(
      false,
    );
  });

  it("categoryParamsParsers has categoryId and createCategory with correct defaults", () => {
    expect(categoryParamsParsers.categoryId.parseServerSide("cat_123")).toBe(
      "cat_123",
    );
    expect(categoryParamsParsers.categoryId.parseServerSide(undefined)).toBe(
      "",
    );
    expect(categoryParamsParsers.createCategory.parseServerSide("true")).toBe(
      true,
    );
    expect(
      categoryParamsParsers.createCategory.parseServerSide(undefined),
    ).toBe(false);
  });

  it("arParamsParsers has arId, createAr, and recordPayment with correct defaults", () => {
    expect(arParamsParsers.arId.parseServerSide("ar_123")).toBe("ar_123");
    expect(arParamsParsers.arId.parseServerSide(undefined)).toBe("");
    expect(arParamsParsers.createAr.parseServerSide("true")).toBe(true);
    expect(arParamsParsers.createAr.parseServerSide(undefined)).toBe(false);
    expect(arParamsParsers.recordPayment.parseServerSide("true")).toBe(true);
    expect(arParamsParsers.recordPayment.parseServerSide(undefined)).toBe(
      false,
    );
  });

  it("closureParamsParsers has createClosure with correct defaults", () => {
    expect(closureParamsParsers.createClosure.parseServerSide("true")).toBe(
      true,
    );
    expect(closureParamsParsers.createClosure.parseServerSide(undefined)).toBe(
      false,
    );
  });
});
