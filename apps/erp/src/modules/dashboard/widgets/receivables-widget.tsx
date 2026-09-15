import type { DashboardOverview } from "@cendaro/api";
import { AnimatedNumber } from "@cendaro/ui/animated-number";

import { formatDualCurrency } from "~/lib/format-currency";
import { WidgetCard } from "../widget-card";

interface ReceivablesWidgetProps {
  receivables: NonNullable<DashboardOverview["receivables"]>;
  bcvRate: number;
}

/** Only rendered when `overview.receivables` isn't `null` (role-redacted). */
export function ReceivablesWidget({
  receivables,
  bcvRate,
}: ReceivablesWidgetProps) {
  const bs = formatDualCurrency(receivables.total, bcvRate).bs;

  return (
    <WidgetCard
      icon="AccountBalanceWallet"
      title="Cuentas por Cobrar"
      href="/accounts-receivable"
    >
      <p className="text-muted-foreground text-sm">
        <span className="text-foreground font-medium">{receivables.count}</span>{" "}
        cuentas ·{" "}
        <span
          className={
            receivables.overdueCount > 0
              ? "text-destructive-soft font-medium"
              : "text-foreground font-medium"
          }
        >
          {receivables.overdueCount}
        </span>{" "}
        vencidas
      </p>
      <p className="text-foreground text-xl font-medium">
        <AnimatedNumber
          value={receivables.total}
          format={{ style: "currency", currency: "USD" }}
        />
      </p>
      {bs ? <p className="text-muted-foreground text-xs">{bs}</p> : null}
    </WidgetCard>
  );
}
