"use client";

import { parseAsBoolean, parseAsString, useQueryStates } from "nuqs";

/**
 * URL-persisted state for `/accounts-receivable` (PLAN-2026-09-DESIGN-SYSTEM §T5.1).
 * `arId` opens AR detail sheet, `createAr` opens create AR invoice sheet,
 * and `recordPayment` opens AR payment record sheet.
 */
export const arParamsParsers = {
  arId: parseAsString.withDefault(""),
  createAr: parseAsBoolean.withDefault(false),
  recordPayment: parseAsBoolean.withDefault(false),
};

export function useArParams() {
  return useQueryStates(arParamsParsers);
}
