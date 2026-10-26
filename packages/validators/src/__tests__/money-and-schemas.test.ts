import { describe, expect, it } from "vitest";

import {
  addMoney,
  calculatePercentage,
  computeWeightedAverageCost,
  convertUsdToVes,
  convertVesToUsd,
  createQuoteSchema,
  multiplyMoney,
  roundMoney2,
  roundMoney4,
  seniatRifSchema,
  subtractMoney,
  venezolanaCedulaSchema,
} from "../index";

describe("Deterministic monetary helpers (money.ts)", () => {
  it("eliminates IEEE-754 float drift on addition and subtraction", () => {
    expect(addMoney(0.1, 0.2)).toBe(0.3);
    expect(addMoney(19.99, 0.01)).toBe(20);
    expect(subtractMoney(100.1, 99.8)).toBe(0.3);
  });

  it("rounds 2 and 4 decimals accurately", () => {
    expect(roundMoney2(12.345)).toBe(12.35);
    expect(roundMoney2(12.344)).toBe(12.34);
    expect(roundMoney4(36.54326)).toBe(36.5433);
  });

  it("multiplies quantity and unit price and converts USD <-> VES", () => {
    expect(multiplyMoney(3, 19.99)).toBe(59.97);
    expect(convertUsdToVes(100, 36.5123)).toBe(3651.23);
    expect(convertVesToUsd(3651.23, 36.5123)).toBe(100);
    expect(calculatePercentage(250, 16)).toBe(40);
  });

  it("computes weighted average unit cost on container receipt", () => {
    // 100 units @ $10.00 + 100 units @ $14.00 => 200 units @ $12.00
    expect(computeWeightedAverageCost(100, 10, 100, 14)).toBe(12);
    // 0 existing stock + 50 units @ $8.255 => $8.255
    expect(computeWeightedAverageCost(0, 0, 50, 8.255)).toBe(8.255);
  });
});

describe("Unified fiscal and quote schemas (index.ts)", () => {
  it("validates and canonicalizes SENIAT RIFs with check digit via seniatRifSchema", () => {
    // J-00006372-9 is BCV's official RIF
    const parsed = seniatRifSchema.safeParse("j000063729");
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toBe("J-00006372-9");
    }

    // Invalid check digit must fail
    const badCheck = seniatRifSchema.safeParse("J-00006372-0");
    expect(badCheck.success).toBe(false);
  });

  it("validates and canonicalizes Venezuelan cédulas via venezolanaCedulaSchema", () => {
    const parsed = venezolanaCedulaSchema.safeParse("v12345678");
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toBe("V-12345678");
    }
  });

  it("accepts validUntil on createQuoteSchema", () => {
    const parsed = createQuoteSchema.safeParse({
      customerId: "a0000000-0000-4000-8000-000000000001",
      validUntil: "2026-12-31T23:59:59.000Z",
      channel: "store",
      items: [
        {
          productId: "b0000000-0000-4000-8000-000000000002",
          quantity: 2,
          unitPrice: 15.5,
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });
});
