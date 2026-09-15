import type { DashboardInsight } from "./welcome";
import { pluralize } from "~/lib/plural";

export interface DashboardOverviewData {
  pendingDispatch: { count: number };
  lowStock: { count: number };
  receivables: { overdueCount: number; total: number } | null;
  rate: { changePct: number };
}

/**
 * Builds the list of actionable insights for the dashboard welcome ticker
 * (PLAN-2026-09-DESIGN-SYSTEM §T3.3 & §T4.5).
 *
 * Each insight links directly to the corresponding module with real URL filter parameters applied.
 */
export function buildDashboardInsights(
  overview: DashboardOverviewData | null | undefined,
): DashboardInsight[] {
  if (!overview) return [];
  const list: DashboardInsight[] = [];

  if (overview.pendingDispatch.count > 0) {
    list.push({
      text: `Tienes ${overview.pendingDispatch.count} ${pluralize(overview.pendingDispatch.count, "pedido", "pedidos")} por despachar`,
      href: "/orders?statuses=confirmed,prepared",
    });
  }
  if (overview.lowStock.count > 0) {
    list.push({
      text: `${overview.lowStock.count} ${pluralize(overview.lowStock.count, "producto", "productos")} bajo mínimo`,
      href: "/inventory?status=low_stock",
    });
  }
  if (overview.receivables && overview.receivables.overdueCount > 0) {
    list.push({
      text: `CxC vencidas por $${overview.receivables.total.toFixed(2)}`,
      href: "/accounts-receivable?status=overdue",
    });
  }
  if (overview.rate.changePct !== 0) {
    const sign = overview.rate.changePct > 0 ? "+" : "";
    list.push({
      text: `La tasa BCV cambió ${sign}${overview.rate.changePct.toFixed(1)}% hoy`,
      href: "/rates",
    });
  }

  return list;
}
