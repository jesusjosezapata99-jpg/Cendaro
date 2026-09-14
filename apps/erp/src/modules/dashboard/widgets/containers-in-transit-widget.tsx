import type { DashboardOverview } from "@cendaro/api";
import { AnimatedNumber } from "@cendaro/ui/animated-number";

import { WidgetCard } from "../widget-card";

interface ContainersInTransitWidgetProps {
  containersInTransit: DashboardOverview["containersInTransit"];
}

export function ContainersInTransitWidget({
  containersInTransit,
}: ContainersInTransitWidgetProps) {
  return (
    <WidgetCard
      icon="Package2"
      title="Contenedores en Tránsito"
      href="/containers"
    >
      <p className="text-muted-foreground text-sm">en camino desde origen</p>
      <p className="text-foreground text-xl font-medium">
        <AnimatedNumber value={containersInTransit.count} />
      </p>
    </WidgetCard>
  );
}
