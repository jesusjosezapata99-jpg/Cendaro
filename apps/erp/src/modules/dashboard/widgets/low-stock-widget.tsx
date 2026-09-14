import type { DashboardOverview } from "@cendaro/api";
import { AnimatedNumber } from "@cendaro/ui/animated-number";

import { WidgetCard } from "../widget-card";

interface LowStockWidgetProps {
  lowStock: DashboardOverview["lowStock"];
}

export function LowStockWidget({ lowStock }: LowStockWidgetProps) {
  const names = lowStock.top.map((p) => p.name).join(", ");

  return (
    <WidgetCard icon="Inventory2" title="Stock Bajo" href="/inventory">
      <p className="text-muted-foreground text-sm">
        productos con existencias críticas
      </p>
      <p className="text-foreground text-xl font-medium">
        <AnimatedNumber value={lowStock.count} />
      </p>
      {names ? (
        <p className="text-muted-foreground truncate text-xs" title={names}>
          {names}
        </p>
      ) : null}
    </WidgetCard>
  );
}
