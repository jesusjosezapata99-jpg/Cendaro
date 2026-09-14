import type { DashboardOverview } from "@cendaro/api";

import { WidgetCard } from "../widget-card";

interface LastClosureWidgetProps {
  lastClosure: DashboardOverview["lastClosure"];
}

export function LastClosureWidget({ lastClosure }: LastClosureWidgetProps) {
  return (
    <WidgetCard
      icon="LockClock"
      title="Último Cierre de Caja"
      href="/cash-closure"
    >
      {lastClosure ? (
        <>
          <p className="text-muted-foreground text-sm">
            {new Date(lastClosure.closureDate).toLocaleDateString("es-VE", {
              day: "numeric",
              month: "short",
            })}{" "}
            ·{" "}
            <span className="text-foreground">
              {lastClosure.status === "reviewed"
                ? "revisado"
                : lastClosure.status === "closed"
                  ? "cerrado"
                  : "abierto"}
            </span>
          </p>
          <p className="text-foreground text-xl font-medium">
            ${Number(lastClosure.totalSales ?? 0).toFixed(2)}
          </p>
          <p className="text-muted-foreground text-xs">
            {(lastClosure.discrepancy ?? 0) === 0
              ? "sin discrepancia"
              : `discrepancia $${Number(lastClosure.discrepancy).toFixed(2)}`}
          </p>
        </>
      ) : (
        <p className="text-muted-foreground text-sm">
          Sin cierres de caja registrados
        </p>
      )}
    </WidgetCard>
  );
}
