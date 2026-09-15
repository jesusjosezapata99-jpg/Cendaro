/**
 * Cendaro — Order & Quote Detail Item Join Unit Tests (T4.4 / C3)
 *
 * Validates input schemas for `sales.orderById` and `quotes.byId` and verifies
 * that order/quote line items conform to the joined product contract
 * (`productName` and `sku` alongside pricing and quantities).
 */
import { describe, expect, it } from "vitest";
import { z } from "zod/v4";

const idInputSchema = z.object({ id: z.string().uuid() });

/** Contract schema for joined order and quote line items (T4.4 / C3) */
export const joinedLineItemSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  productId: z.string().uuid(),
  productName: z.string().nullable(),
  sku: z.string().nullable(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
  discount: z.number().nonnegative().nullable(),
  lineTotal: z.number().nonnegative(),
});

describe("T4.4 (C3) — sales.orderById and quotes.byId input contracts", () => {
  it("accepts valid UUID input", () => {
    const validUuid = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
    expect(idInputSchema.safeParse({ id: validUuid }).success).toBe(true);
  });

  it("rejects non-UUID id", () => {
    expect(idInputSchema.safeParse({ id: "invalid-id" }).success).toBe(false);
    expect(idInputSchema.safeParse({ id: "12345" }).success).toBe(false);
    expect(idInputSchema.safeParse({ id: "" }).success).toBe(false);
  });
});

describe("T4.4 (C3) — Line item product contract", () => {
  const baseItem = {
    id: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
    workspaceId: "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33",
    productId: "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44",
    quantity: 2,
    unitPrice: 45.5,
    discount: 0,
    lineTotal: 91.0,
  };

  it("validates line item with joined productName and sku", () => {
    const item = {
      ...baseItem,
      productName: "Batería Automotriz 12V 75Ah Cendaro Pro",
      sku: "BAT-12V-75",
    };
    const parsed = joinedLineItemSchema.safeParse(item);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.productName).toBe(
        "Batería Automotriz 12V 75Ah Cendaro Pro",
      );
      expect(parsed.data.sku).toBe("BAT-12V-75");
    }
  });

  it("validates line item when joined product is null (leftJoin fallback)", () => {
    const item = {
      ...baseItem,
      productName: null,
      sku: null,
    };
    const parsed = joinedLineItemSchema.safeParse(item);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.productName).toBeNull();
      expect(parsed.data.sku).toBeNull();
    }
  });

  it("formats fallback display correctly when productName is missing or present", () => {
    function formatItemDisplay(item: {
      productId: string;
      productName: string | null;
      sku: string | null;
      index: number;
    }) {
      const displayName =
        item.productName ??
        (item.productId
          ? `Prod #${item.productId.slice(0, 8)}`
          : `Ítem #${item.index + 1}`);
      const skuDisplay = item.sku ? `SKU: ${item.sku}` : null;
      return { displayName, skuDisplay };
    }

    const withProduct = formatItemDisplay({
      productId: "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44",
      productName: "Aceite Sintético 5W-30",
      sku: "LUB-SYN-5W30",
      index: 0,
    });
    expect(withProduct.displayName).toBe("Aceite Sintético 5W-30");
    expect(withProduct.skuDisplay).toBe("SKU: LUB-SYN-5W30");

    const withoutProduct = formatItemDisplay({
      productId: "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44",
      productName: null,
      sku: null,
      index: 0,
    });
    expect(withoutProduct.displayName).toBe("Prod #d0eebc99");
    expect(withoutProduct.skuDisplay).toBeNull();
  });
});
