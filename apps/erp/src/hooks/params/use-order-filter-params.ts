"use client";

import {
  parseAsArrayOf,
  parseAsBoolean,
  parseAsString,
  useQueryStates,
} from "nuqs";

/**
 * URL-persisted filter and sort parameters for `/orders`
 * (PLAN-2026-09-DESIGN-SYSTEM §T4.2).
 *
 * Supports single and multi-status selection, channel filtering, date range,
 * search term, sort order (`col:asc` / `col:desc`), and dialog state (`createOrder`).
 * `shallow: false` ensures server-side data fetching triggers on filter changes.
 */
export const orderFilterParsers = {
  search: parseAsString.withDefault(""),
  status: parseAsString.withDefault("all"),
  statuses: parseAsArrayOf(parseAsString).withDefault([]),
  channel: parseAsString.withDefault("all"),
  channels: parseAsArrayOf(parseAsString).withDefault([]),
  dateFrom: parseAsString.withDefault(""),
  dateTo: parseAsString.withDefault(""),
  sort: parseAsString.withDefault(""),
  createOrder: parseAsBoolean.withDefault(false),
};

export interface OrderFilterParams {
  search: string;
  status: string;
  statuses: string[];
  channel: string;
  channels: string[];
  dateFrom: string;
  dateTo: string;
  sort: string;
  createOrder: boolean;
}

export function useOrderFilterParams() {
  return useQueryStates(orderFilterParsers, {
    shallow: false,
  });
}
