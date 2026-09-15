"use client";

import { parseAsStringLiteral, useQueryStates } from "nuqs";

const PERIODS = ["7d", "30d", "90d", "12m"] as const;
const TABS = ["overview", "metrics"] as const;

/**
 * URL-persisted state for `/dashboard` (PLAN-2026-09-DESIGN-SYSTEM §T3.3).
 * `period` drives `dashboard.overview`'s input; `tab` switches between the
 * "Resumen" widget grid (T3.3) and the "Métricas" charts tab (T3.5).
 */
export function useDashboardParams() {
  return useQueryStates({
    period: parseAsStringLiteral(PERIODS).withDefault("30d"),
    tab: parseAsStringLiteral(TABS).withDefault("overview"),
  });
}

export type DashboardPeriod = (typeof PERIODS)[number];
export type DashboardTab = (typeof TABS)[number];

export const DASHBOARD_PERIOD_LABELS: Record<DashboardPeriod, string> = {
  "7d": "7 días",
  "30d": "30 días",
  "90d": "90 días",
  "12m": "12 meses",
};
