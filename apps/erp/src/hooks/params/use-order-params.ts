"use client";

import { parseAsBoolean, parseAsString, useQueryStates } from "nuqs";

/**
 * URL-persisted state for `/orders` (PLAN-2026-09-DESIGN-SYSTEM §T5.1).
 * `orderId` opens the order detail sheet, `createOrder` opens the create order sheet,
 * and `status` migrates the list's local filter.
 */
export const orderParamsParsers = {
  orderId: parseAsString.withDefault(""),
  createOrder: parseAsBoolean.withDefault(false),
  status: parseAsString.withDefault("all"),
};

export function useOrderParams() {
  return useQueryStates(orderParamsParsers);
}
