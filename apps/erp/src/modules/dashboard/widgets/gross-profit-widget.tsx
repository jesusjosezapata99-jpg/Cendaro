import type { DashboardOverview } from "@cendaro/api";
import { AnimatedNumber } from "@cendaro/ui/animated-number";

import { formatDualCurrency } from "~/lib/format-currency";
import { WidgetSparkline } from "../base-charts";
import { WidgetCard } from "../widget-card";

interface GrossProfitWidgetProps {
  grossProfit: NonNullable<DashboardOverview["grossProfit"]>;
  bcvRate: number;
}

/** Only rendered when `overview.grossProfit` isn't `null` — server already
 * redacts it for employee/vendor/marketing (`canViewGrossProfit`, T3.1). */
export function GrossProfitWidget({
  grossProfit,
  bcvRate,
}: GrossProfitWidgetProps) {
  const profit = grossProfit.revenue - grossProfit.cost;
  const bs = formatDualCurrency(profit, bcvRate).bs;
  const hasCost = grossProfit.cost > 0;
  const marginPct = (grossProfit.margin * 100).toFixed(1);

  return (
    <WidgetCard icon="TrendingUp" title="Utilidad Bruta" href="/pricing">
      <p className="text-muted-foreground text-sm">
        {hasCost ? (
          <>
            <span className="text-foreground font-medium">{marginPct}%</span> de
            margen
          </>
        ) : (
          <span className="text-muted-foreground text-xs italic">
            Sin costo base
          </span>
        )}
      </p>
      <p className="text-foreground text-xl font-medium">
        <AnimatedNumber
          value={profit}
          format={{ style: "currency", currency: "USD" }}
        />
      </p>
      {bs ? <p className="text-muted-foreground text-xs">{bs}</p> : null}
      <WidgetSparkline data={grossProfit.series} />
    </WidgetCard>
  );
}
