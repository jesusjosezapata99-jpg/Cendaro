/**
 * Cendaro — Validators Unit Tests
 *
 * Tests business logic validation schemas from @cendaro/validators.
 * Ensures RIF, Cédula, money, exchange rate, and role schemas
 * accept valid inputs and reject invalid ones.
 */
import { describe, it, expect } from "vitest";
import {
  rifSchema,
  cedulaSchema,
  moneySchema,
  exchangeRateSchema,
  percentageSchema,
  skuCodeSchema,
  barcodeSchema,
  userRoleSchema,
  USER_ROLES,
} from "../index";

describe("rifSchema", () => {
  it("accepts valid RIFs", () => {
    expect(() => rifSchema.parse("J-12345678-9")).not.toThrow();
    expect(() => rifSchema.parse("V-00000001-0")).not.toThrow();
    expect(() => rifSchema.parse("G-99999999-1")).not.toThrow();
    expect(() => rifSchema.parse("E-12345678-5")).not.toThrow();
    expect(() => rifSchema.parse("P-87654321-3")).not.toThrow();
  });

  it("rejects invalid RIFs", () => {
    expect(() => rifSchema.parse("")).toThrow();
    expect(() => rifSchema.parse("J12345678-9")).toThrow();     // missing first dash
    expect(() => rifSchema.parse("J-1234567-9")).toThrow();     // 7 digits instead of 8
    expect(() => rifSchema.parse("J-123456789-9")).toThrow();   // 9 digits instead of 8
    expect(() => rifSchema.parse("X-12345678-9")).toThrow();     // invalid prefix
    expect(() => rifSchema.parse("J-12345678")).toThrow();       // missing check digit
  });
});

describe("cedulaSchema", () => {
  it("accepts valid cédulas", () => {
    expect(() => cedulaSchema.parse("V-1234567")).not.toThrow();
    expect(() => cedulaSchema.parse("V-12345678")).not.toThrow();
    expect(() => cedulaSchema.parse("E-123456")).not.toThrow();
  });

  it("rejects invalid cédulas", () => {
    expect(() => cedulaSchema.parse("")).toThrow();
    expect(() => cedulaSchema.parse("V-12345")).toThrow();       // too short
    expect(() => cedulaSchema.parse("V-123456789")).toThrow();   // too long
    expect(() => cedulaSchema.parse("J-1234567")).toThrow();     // wrong prefix
  });
});

describe("moneySchema", () => {
  it("accepts valid amounts", () => {
    expect(() => moneySchema.parse(0)).not.toThrow();
    expect(() => moneySchema.parse(100.50)).not.toThrow();
    expect(() => moneySchema.parse(0.01)).not.toThrow();
    expect(() => moneySchema.parse(999999.99)).not.toThrow();
  });

  it("rejects invalid amounts", () => {
    expect(() => moneySchema.parse(-1)).toThrow();
    expect(() => moneySchema.parse(0.001)).toThrow();   // more than 2 decimals
  });
});

describe("exchangeRateSchema", () => {
  it("accepts valid rates", () => {
    expect(() => exchangeRateSchema.parse(1)).not.toThrow();
    expect(() => exchangeRateSchema.parse(36.5812)).not.toThrow();
    expect(() => exchangeRateSchema.parse(0.0001)).not.toThrow();
  });

  it("rejects invalid rates", () => {
    expect(() => exchangeRateSchema.parse(0)).toThrow();
    expect(() => exchangeRateSchema.parse(-5)).toThrow();
    expect(() => exchangeRateSchema.parse(1.00001)).toThrow();  // 5 decimals
  });
});

describe("percentageSchema", () => {
  it("accepts 0-100", () => {
    expect(() => percentageSchema.parse(0)).not.toThrow();
    expect(() => percentageSchema.parse(50)).not.toThrow();
    expect(() => percentageSchema.parse(100)).not.toThrow();
  });

  it("rejects out of range", () => {
    expect(() => percentageSchema.parse(-1)).toThrow();
    expect(() => percentageSchema.parse(101)).toThrow();
  });
});

describe("skuCodeSchema", () => {
  it("accepts valid SKUs", () => {
    expect(() => skuCodeSchema.parse("SKU-001")).not.toThrow();
    expect(() => skuCodeSchema.parse("A")).not.toThrow();
  });

  it("rejects empty or too long", () => {
    expect(() => skuCodeSchema.parse("")).toThrow();
    expect(() => skuCodeSchema.parse("X".repeat(65))).toThrow();
  });
});

describe("barcodeSchema", () => {
  it("accepts valid barcodes or undefined", () => {
    expect(() => barcodeSchema.parse("7501234567890")).not.toThrow();
    expect(() => barcodeSchema.parse(undefined)).not.toThrow();
  });

  it("rejects too long", () => {
    expect(() => barcodeSchema.parse("X".repeat(129))).toThrow();
  });
});

describe("userRoleSchema", () => {
  it("accepts all valid roles", () => {
    for (const role of USER_ROLES) {
      expect(() => userRoleSchema.parse(role)).not.toThrow();
    }
  });

  it("rejects unknown roles", () => {
    expect(() => userRoleSchema.parse("superadmin")).toThrow();
    expect(() => userRoleSchema.parse("")).toThrow();
    expect(() => userRoleSchema.parse("root")).toThrow();
  });

  it("has exactly 6 roles", () => {
    expect(USER_ROLES).toHaveLength(6);
  });
});
