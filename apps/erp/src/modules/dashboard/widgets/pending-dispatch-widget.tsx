import type { DashboardOverview } from "@cendaro/api";
import { AnimatedNumber } from "@cendaro/ui/animated-number";

import { WidgetCard } from "../widget-card";

interface PendingDispatchWidgetProps {
  pendingDispatch: DashboardOverview["pendingDispatch"];
}

export function PendingDispatchWidget({
  pendingDispatch,
}: PendingDispatchWidgetProps) {
  return (
    <WidgetCard icon="LocalShipping" title="Por Despachar" href="/orders">
      <p className="text-muted-foreground text-sm">
        pedidos confirmados o preparados
      </p>
      <p className="text-foreground text-xl font-medium">
        <AnimatedNumber value={pendingDispatch.count} />
      </p>
    </WidgetCard>
  );
}
