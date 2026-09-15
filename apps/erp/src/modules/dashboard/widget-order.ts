import type { WidgetId } from "@cendaro/validators";

export const DEFAULT_WIDGET_ORDER: WidgetId[] = [
  "sales",
  "grossProfit",
  "receivables",
  "lowStock",
  "pendingDispatch",
  "topProducts",
  "lastClosure",
  "containersInTransit",
];

export const WIDGET_TITLES: Record<WidgetId, string> = {
  sales: "Ventas",
  grossProfit: "Utilidad Bruta",
  receivables: "Cuentas por Cobrar",
  lowStock: "Stock Bajo",
  pendingDispatch: "Por Despachar",
  topProducts: "Productos Más Vendidos",
  lastClosure: "Último Cierre de Caja",
  containersInTransit: "Contenedores en Tránsito",
};

/**
 * Resolves a complete, sanitized, deduplicated widget order.
 * - Missing default widgets are appended to the end.
 * - Unknown IDs or duplicates are safely dropped.
 * - If savedOrder is empty or undefined, returns DEFAULT_WIDGET_ORDER.
 */
export function resolveWidgetOrder(savedOrder?: WidgetId[] | null): WidgetId[] {
  if (!savedOrder || savedOrder.length === 0) {
    return [...DEFAULT_WIDGET_ORDER];
  }

  const seen = new Set<WidgetId>();
  const valid: WidgetId[] = [];

  for (const id of savedOrder) {
    if (DEFAULT_WIDGET_ORDER.includes(id) && !seen.has(id)) {
      seen.add(id);
      valid.push(id);
    }
  }

  for (const id of DEFAULT_WIDGET_ORDER) {
    if (!seen.has(id)) {
      seen.add(id);
      valid.push(id);
    }
  }

  return valid;
}

/**
 * Filters the widget order based on server role-redaction.
 * If grossProfit or receivables are null (employee / unauthorized role),
 * they are completely excluded from both regular display and customization mode.
 */
export function resolveAllowedWidgets(
  order: WidgetId[],
  hasGrossProfit: boolean,
  hasReceivables: boolean,
): WidgetId[] {
  return order.filter((id) => {
    if (id === "grossProfit" && !hasGrossProfit) return false;
    if (id === "receivables" && !hasReceivables) return false;
    return true;
  });
}

/**
 * Toggles a widget ID in or out of the hidden set.
 */
export function toggleWidgetHidden(
  hidden: Set<WidgetId>,
  id: WidgetId,
): WidgetId[] {
  const next = new Set(hidden);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  return Array.from(next);
}
