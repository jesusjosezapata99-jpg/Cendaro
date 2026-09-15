import type { DashboardOverview } from "@cendaro/api";

import { WidgetCard } from "../widget-card";

interface TopProductsWidgetProps {
  topProducts: DashboardOverview["topProducts"];
}

export function TopProductsWidget({ topProducts }: TopProductsWidgetProps) {
  const top = topProducts[0];

  return (
    <WidgetCard icon="Inventory2" title="Producto Más Vendido" href="/catalog">
      {top ? (
        <>
          <p className="text-foreground truncate text-sm font-medium">
            {top.name}
          </p>
          <p className="text-muted-foreground text-xl font-medium">
            <span className="text-foreground">{top.qty}</span> uds.
          </p>
          <p className="text-muted-foreground text-xs">
            ${top.total.toFixed(2)} en el período
          </p>
        </>
      ) : (
        <p className="text-muted-foreground text-sm">
          Sin ventas en el período
        </p>
      )}
    </WidgetCard>
  );
}
