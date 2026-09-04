"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useTRPC } from "~/trpc/client";

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`bg-muted animate-pulse rounded-lg ${className}`} />;
}

const TYPE_CONFIG: Record<
  string,
  { label: string; icon: string; color: string }
> = {
  low_stock: {
    label: "Stock Bajo",
    icon: "inventory_2",
    color:
      "bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400",
  },
  inventory_diff: {
    label: "Dif. Inventario",
    icon: "balance",
    color: "bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400",
  },
  product_blocked: {
    label: "Producto Bloqueado",
    icon: "block",
    color: "bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400",
  },
  rate_change: {
    label: "Cambio Tasa",
    icon: "trending_up",
    color: "bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400",
  },
  vendor_under_target: {
    label: "Vendedor Bajo Meta",
    icon: "trending_down",
    color:
      "bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400",
  },
  order_late: {
    label: "Pedido Atrasado",
    icon: "schedule",
    color:
      "bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400",
  },
  ml_failure: {
    label: "Falla ML",
    icon: "error_outline",
    color: "bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400",
  },
  ar_overdue: {
    label: "CxC Vencida",
    icon: "credit_card_off",
    color: "bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400",
  },
};

const SEVERITY_BD: Record<string, string> = {
  high: "border-l-red-500",
  medium: "border-l-amber-500",
  low: "border-l-blue-500",
  info: "border-l-cyan-500",
};

export default function AlertsPage() {
  const trpc = useTRPC();
  const { data: alerts, isLoading } = useQuery(
    trpc.dashboard.listAlerts.queryOptions({ limit: 100 }),
  );
  const [filter, setFilter] = useState<string>("active");
  const qc = useQueryClient();

  const dismiss = useMutation(
    trpc.dashboard.dismissAlert.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: [["dashboard"]] });
      },
    }),
  );

  const items = alerts ?? [];

  const filtered = items.filter((a) => {
    if (filter === "active") return !a.isDismissed;
    if (filter === "dismissed") return a.isDismissed;
    return a.alertType === filter;
  });

  const activeCount = items.filter((a) => !a.isDismissed).length;
  const highCount = items.filter(
    (a) => !a.isDismissed && a.severity === "high",
  ).length;
  const activeTypes = new Set(
    items.filter((a) => !a.isDismissed).map((a) => a.alertType),
  ).size;

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-black tracking-tight">
            Alertas del Sistema
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Monitoreo y respuesta
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeCount > 0 && (
            <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-bold text-red-600 dark:bg-red-500/20 dark:text-red-400">
              {activeCount} activa{activeCount > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          {
            label: "Alertas Activas",
            value: activeCount,
            icon: "notifications_active",
            accent: "border-amber-500/40",
          },
          {
            label: "Alta Prioridad",
            value: highCount,
            icon: "priority_high",
            accent: "border-red-500/40",
          },
          {
            label: "Tipos Activos",
            value: activeTypes,
            icon: "category",
            accent: "border-blue-500/40",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className={`rounded-xl border-l-4 ${stat.accent} bg-card border-border border p-4`}
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-muted-foreground text-lg">
                {stat.icon}
              </span>
              <span className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
                {stat.label}
              </span>
            </div>
            <p className="text-foreground mt-1 text-2xl font-bold">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {["active", "dismissed", ...Object.keys(TYPE_CONFIG)].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
              filter === f
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:bg-accent"
            }`}
          >
            {f === "active" ? (
              <>
                <span className="material-symbols-outlined text-sm">
                  notifications
                </span>{" "}
                Activas ({activeCount})
              </>
            ) : f === "dismissed" ? (
              <>
                <span className="material-symbols-outlined text-sm">
                  check_circle
                </span>{" "}
                Descartadas
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-sm">
                  {TYPE_CONFIG[f]?.icon}
                </span>{" "}
                {TYPE_CONFIG[f]?.label}
              </>
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((alert) => {
            const typeCfg = TYPE_CONFIG[alert.alertType] ?? {
              label: alert.alertType,
              icon: "info",
              color: "",
            };
            const severityBorder =
              SEVERITY_BD[alert.severity] ?? "border-l-border";
            return (
              <div
                key={alert.id}
                className={`rounded-xl border border-l-4 ${severityBorder} ${
                  alert.isDismissed
                    ? "border-border/20 bg-card/50 opacity-60"
                    : "border-border bg-card"
                } p-4 transition-all`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-muted-foreground mt-0.5 text-lg">
                      {typeCfg.icon}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3
                          className={`text-sm font-medium ${alert.isDismissed ? "text-muted-foreground line-through" : "text-foreground"}`}
                        >
                          {alert.title}
                        </h3>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${typeCfg.color}`}
                        >
                          {typeCfg.label}
                        </span>
                      </div>
                      <p
                        className={`mt-1 text-xs ${alert.isDismissed ? "text-muted-foreground/50" : "text-muted-foreground"}`}
                      >
                        {alert.message}
                      </p>
                      <p className="text-muted-foreground mt-1 text-[10px]">
                        {new Date(alert.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  {!alert.isDismissed && (
                    <button
                      onClick={() => dismiss.mutate({ id: alert.id })}
                      disabled={dismiss.isPending}
                      className="border-border bg-secondary text-muted-foreground hover:bg-accent hover:text-foreground shrink-0 rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-50"
                    >
                      {dismiss.isPending ? "..." : "Descartar"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="border-border bg-card rounded-xl border p-8 text-center">
              <p className="text-muted-foreground">
                No hay alertas en esta categoría
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
