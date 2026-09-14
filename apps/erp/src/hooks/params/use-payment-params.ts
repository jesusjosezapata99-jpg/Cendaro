"use client";

import { parseAsBoolean, parseAsString, useQueryStates } from "nuqs";

/**
 * URL-persisted state for payments (PLAN-2026-09-DESIGN-SYSTEM §T5.1).
 * `registerPayment` opens the payment registration sheet, with optional pre-selected `orderId`.
 */
export const paymentParamsParsers = {
  registerPayment: parseAsBoolean.withDefault(false),
  orderId: parseAsString.withDefault(""),
};

export function usePaymentParams() {
  return useQueryStates(paymentParamsParsers);
}
