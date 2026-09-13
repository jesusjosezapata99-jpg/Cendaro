"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { IconName } from "@cendaro/ui/icons";
import { Icon, Icons } from "@cendaro/ui/icons";

import type { StatusTone } from "~/components/status-badge";
import { EmptyState } from "~/components/empty-state";
import { PageHeader } from "~/components/page-header";
import { StatCard } from "~/components/stat-card";
import { StatusBadge } from "~/components/status-badge";
import { useTRPC } from "~/trpc/client";

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`bg-muted animate-pulse rounded-lg ${className}`} />;
}

const TYPE_CONFIG: Record<
  string,
  { label: string; icon: IconName; tone: StatusTone }
> = {
  low_stock: {
    label: "Stock Bajo",
    icon: "Inventory2",
    tone: "warning",
  },
  inventory_diff: {
    label: "Dif. Inventario",
    icon: "Balance",
    tone: "destructive",
  },
  product_blocked: {
    label: "Producto Bloqueado",
    icon: "Block",
    tone: "destructive",
  },
  rate_change: {
    label: "Cambio Tasa",
    icon: "TrendingUp",
    tone: "primary",
  },
  vendor_under_target: {
    label: "Vendedor Bajo Meta",
    icon: "TrendingDown",
    tone: "warning",
  },
  order_late: {
    label: "Pedido Atrasado",
    icon: "Schedule",
    tone: "warning",
  },
  ml_failure: {
    label: "Falla ML",
    icon: "ErrorOutline",
    tone: "destructive",
  },
  ar_overdue: {
    label: "CxC Vencida",
    icon: "CreditCardOff",
    tone: "destructive",
  },
};

const SEVERITY_BORDER: Record<string, string> = {
  high: "border-l-destructive",
  medium: "border-l-warning",
  low: "border-l-primary",
  info: "border-l-muted-foreground",
};

export default function AlertsPage() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("active");

  const {
    data: alerts,
    isLoading,
    refetch,
  } = useQuery(trpc.dashboard.listAlerts.queryOptions({ limit: 100 }));

  const dismiss = useMutation(
    trpc.dashboard.dismissAlert.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: [["dashboard"]] });
      },
    }),
  );

  const items = useMemo(() => alerts ?? [], [alerts]);

  const activeCount = useMemo(
    () => items.filter((a) => !a.isDismissed).length,
    [items],
  );
  const highCount = useMemo(
    () => items.filter((a) => !a.isDismissed && a.severity === "high").length,
    [items],
  );
  const dismissedCount = useMemo(
    () => items.filter((a) => a.isDismissed).length,
    [items],
  );
  const activeTypes = useMemo(
    () =>
      new Set(items.filter((a) => !a.isDismissed).map((a) => a.alertType)).size,
    [items],
  );

  const filtered = useMemo(() => {
    return items.filter((a) => {
      if (filter === "active") return !a.isDismissed;
      if (filter === "dismissed") return a.isDismissed;
      return a.alertType === filter;
    });
  }, [items, filter]);

  return (
    <div className="space-y-6 py-4 lg:py-8">
      {/* Header */}
      <PageHeader
        title="Centro de Alertas & Notificaciones Operativas"
        description="Monitoreo y respuesta temprana ante anomalías de inventario, tasas cambiarias y riesgos comerciales"
        actions={
          <button
            type="button"
            onClick={() => void refetch()}
            className="border-border bg-secondary text-foreground hover:bg-accent flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-medium shadow-xs transition-colors"
          >
            <Icons.Refresh className="size-3.5" />
            Actualizar
          </button>
        }
      />

      {/* 4 StatCards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Alertas Activas"
          value={isLoading ? "—" : activeCount}
          icon="NotificationsActive"
          tone={activeCount > 0 ? "warning" : "default"}
          sub={activeCount > 0 ? "Requieren atención" : "Sin incidentes"}
        />
        <StatCard
          label="Alta Prioridad"
          value={isLoading ? "—" : highCount}
          icon="PriorityHigh"
          tone={highCount > 0 ? "destructive" : "success"}
          sub="Impacto operativo directo"
        />
        <StatCard
          label="Resueltas / Archivadas"
          value={isLoading ? "—" : dismissedCount}
          icon="CheckCircle"
          tone="success"
          sub="Descartadas por operadores"
        />
        <StatCard
          label="Categorías Activas"
          value={isLoading ? "—" : activeTypes}
          icon="Category"
          tone="default"
          sub="Tipos de eventos detectados"
        />
      </div>

      {/* Filter Tabs */}
      <div className="mobile-scroll-x flex items-center gap-2 pb-1">
        <button
          type="button"
          onClick={() => setFilter("active")}
          className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            filter === "active"
              ? "bg-primary text-primary-foreground font-medium"
              : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground border"
          }`}
        >
          <Icons.Notifications className="size-3.5" />
          Activas
          <span className="bg-background/20 py-0.2 ml-1 rounded-full px-1.5 font-mono text-[10px]">
            {activeCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setFilter("dismissed")}
          className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            filter === "dismissed"
              ? "bg-primary text-primary-foreground font-medium"
              : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground border"
          }`}
        >
          <Icons.CheckCircle className="size-3.5" />
          Descartadas
          <span className="bg-background/20 py-0.2 ml-1 rounded-full px-1.5 font-mono text-[10px]">
            {dismissedCount}
          </span>
        </button>

        {Object.keys(TYPE_CONFIG).map((key) => {
          const cfg = TYPE_CONFIG[key];
          if (!cfg) return null;
          const count = items.filter(
            (a) => !a.isDismissed && a.alertType === key,
          ).length;

          return (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === key
                  ? "bg-primary text-primary-foreground font-medium"
                  : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground border"
              }`}
            >
              <Icon name={cfg.icon} className="size-3.5" />
              {cfg.label}
              {count > 0 ? (
                <span className="bg-warning/20 text-warning-soft py-0.2 ml-1 rounded-full px-1.5 font-mono text-[10px]">
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Alerts List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="surface-card">
          <EmptyState
            icon="Notifications"
            title="Sin alertas en esta categoría"
            description={
              filter === "active"
                ? "No hay alertas operativas pendientes de resolver en este momento."
                : "No se registran eventos correspondientes al filtro seleccionado."
            }
          />
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((alert) => {
            const typeCfg = TYPE_CONFIG[alert.alertType] ?? {
              label: alert.alertType,
              icon: "Info" as const,
              tone: "neutral" as StatusTone,
            };
            const severityBorder =
              SEVERITY_BORDER[alert.severity] ?? "border-l-border";

            return (
              <div
                key={alert.id}
                className={`surface-card border-l-4 ${severityBorder} p-4 transition-all ${
                  alert.isDismissed ? "bg-muted/20 opacity-60" : ""
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="bg-muted text-muted-foreground mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg">
                      <Icon name={typeCfg.icon} className="size-4" />
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3
                          className={`truncate text-sm font-medium ${
                            alert.isDismissed
                              ? "text-muted-foreground line-through"
                              : "text-foreground"
                          }`}
                        >
                          {alert.title}
                        </h3>
                        <StatusBadge tone={typeCfg.tone}>
                          {typeCfg.label}
                        </StatusBadge>
                        <span className="bg-secondary text-muted-foreground rounded px-1.5 py-0.5 font-mono text-[10px] tracking-wider uppercase">
                          {alert.severity}
                        </span>
                      </div>

                      <p
                        className={`text-xs leading-relaxed ${
                          alert.isDismissed
                            ? "text-muted-foreground/60"
                            : "text-muted-foreground"
                        }`}
                      >
                        {alert.message}
                      </p>

                      <div className="text-muted-foreground flex items-center gap-2 pt-1 font-mono text-[11px] tabular-nums">
                        <Icons.Schedule className="size-3" />
                        <time>
                          {new Date(alert.createdAt).toLocaleString("es-VE", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </time>
                      </div>
                    </div>
                  </div>

                  {!alert.isDismissed && (
                    <div className="flex justify-end pt-2 sm:shrink-0 sm:pt-0">
                      <button
                        type="button"
                        onClick={() => dismiss.mutate({ id: alert.id })}
                        disabled={dismiss.isPending}
                        className="border-border bg-secondary text-foreground hover:bg-accent flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium shadow-xs transition-colors disabled:opacity-50"
                      >
                        {dismiss.isPending ? (
                          <>
                            <Icons.ProgressActivity className="size-3.5 animate-spin" />
                            Descartando...
                          </>
                        ) : (
                          <>
                            <Icons.Check className="size-3.5" />
                            Descartar
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
