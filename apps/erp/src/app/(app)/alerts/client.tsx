"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { IconName } from "@cendaro/ui/icons";
import type { StatusTone } from "@cendaro/ui/status-pill";
import { Button } from "@cendaro/ui";
import { Icon, Icons } from "@cendaro/ui/icons";
import { StatusPill } from "@cendaro/ui/status-pill";

import { EmptyState } from "~/components/empty-state";
import { PageHeader } from "~/components/page-header";
import { StatCard } from "~/components/stat-card";
import { useTRPC } from "~/trpc/client";

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
    tone: "default",
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
      onMutate: async (variables) => {
        await qc.cancelQueries({ queryKey: [["dashboard"]] });
        const queryKey = trpc.dashboard.listAlerts.queryKey({ limit: 100 });
        const previousAlerts = qc.getQueryData(queryKey);
        if (previousAlerts) {
          qc.setQueryData(queryKey, (old) =>
            old
              ? old.map((a) =>
                  a.id === variables.id
                    ? {
                        ...a,
                        isDismissed: true,
                        dismissedAt: new Date(),
                      }
                    : a,
                )
              : old,
          );
        }
        toast.success("Alerta descartada");
        return { previousAlerts, queryKey };
      },
      onError: (err, _variables, context) => {
        if (context?.queryKey && context.previousAlerts) {
          qc.setQueryData(context.queryKey, context.previousAlerts);
        }
        toast.error(err.message || "Error al descartar la alerta");
      },
      onSettled: async () => {
        await qc.invalidateQueries({ queryKey: [["dashboard"]] });
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
          <Button
            variant="outline"
            onClick={() => void refetch()}
            className="border-border h-9 text-xs font-medium"
          >
            <Icons.Refresh className="mr-1.5 size-3.5" />
            Actualizar
          </Button>
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
      <div className="mobile-scroll-x flex items-center gap-1.5 pb-1">
        <button
          type="button"
          onClick={() => setFilter("active")}
          className={`h-8 shrink-0 border px-3 text-xs font-medium transition-colors ${
            filter === "active"
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border text-muted-foreground hover:bg-muted/40 hover:text-foreground"
          }`}
        >
          <Icons.Notifications className="mr-1.5 inline size-3.5" />
          Activas
          <span className="ml-1.5 font-mono text-[10px] tabular-nums">
            {activeCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setFilter("dismissed")}
          className={`h-8 shrink-0 border px-3 text-xs font-medium transition-colors ${
            filter === "dismissed"
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border text-muted-foreground hover:bg-muted/40 hover:text-foreground"
          }`}
        >
          <Icons.CheckCircle className="mr-1.5 inline size-3.5" />
          Descartadas
          <span className="ml-1.5 font-mono text-[10px] tabular-nums">
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
              className={`h-8 shrink-0 border px-2.5 text-xs font-medium transition-colors ${
                filter === key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              }`}
            >
              <Icon name={cfg.icon} className="mr-1.5 inline size-3.5" />
              {cfg.label}
              {count > 0 ? (
                <span className="ml-1.5 font-mono text-[10px] tabular-nums">
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
            <div
              key={i}
              className="border-border bg-card animate-pulse border p-4"
            >
              <div className="bg-muted h-4 w-48" />
              <div className="bg-muted mt-2 h-3 w-full" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="border-border bg-card border p-12">
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
                className={`border-border bg-card border border-l-2 ${severityBorder} p-4 transition-colors ${
                  alert.isDismissed ? "opacity-60" : ""
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="bg-muted text-muted-foreground mt-0.5 flex size-8 shrink-0 items-center justify-center">
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
                        <StatusPill tone={typeCfg.tone}>
                          {typeCfg.label}
                        </StatusPill>
                        <span className="border-border bg-background text-muted-foreground border px-1.5 py-0.5 font-mono text-[10px] tracking-wider uppercase">
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
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => dismiss.mutate({ id: alert.id })}
                        disabled={dismiss.isPending}
                        className="border-border h-7 px-2 text-xs font-medium"
                      >
                        {dismiss.isPending ? (
                          <>
                            <Icons.ProgressActivity className="mr-1 size-3 animate-spin" />
                            Descartando...
                          </>
                        ) : (
                          <>
                            <Icons.Check className="mr-1 size-3" />
                            Descartar
                          </>
                        )}
                      </Button>
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
