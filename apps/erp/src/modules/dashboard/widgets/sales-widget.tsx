import type { DashboardOverview } from "@cendaro/api";
import { AnimatedNumber } from "@cendaro/ui/animated-number";

import { formatDualCurrency } from "~/lib/format-currency";
import { WidgetSparkline } from "../base-charts";
import { WidgetCard } from "../widget-card";

interface SalesWidgetProps {
  sales: DashboardOverview["sales"];
  bcvRate: number;
}

export function SalesWidget({ sales, bcvRate }: SalesWidgetProps) {
  const bs = formatDualCurrency(sales.total, bcvRate).bs;

  return (
    <WidgetCard icon="ReceiptLong" title="Ventas" href="/orders">
      <p className="text-muted-foreground text-sm">
        <span className="text-foreground font-medium">{sales.orders}</span>{" "}
        pedidos en el período
      </p>
      <p className="text-foreground text-xl font-medium">
        <AnimatedNumber
          value={sales.total}
          format={{ style: "currency", currency: "USD" }}
        />
      </p>
      {bs ? <p className="text-muted-foreground text-xs">{bs}</p> : null}
      <WidgetSparkline data={sales.series} />
    </WidgetCard>
  );
}
