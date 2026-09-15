"use client";

import { parseAsBoolean, parseAsString, useQueryStates } from "nuqs";

/**
 * URL-persisted state for `/quotes` (PLAN-2026-09-DESIGN-SYSTEM §T5.1).
 * `quoteId` opens the quote detail sheet, and `createQuote` opens the create quote sheet.
 */
export const quoteParamsParsers = {
  quoteId: parseAsString.withDefault(""),
  createQuote: parseAsBoolean.withDefault(false),
};

export function useQuoteParams() {
  return useQueryStates(quoteParamsParsers);
}
