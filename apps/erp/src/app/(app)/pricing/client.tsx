"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { IconName } from "@cendaro/ui/icons";
import { Icon, Icons } from "@cendaro/ui/icons";

import type { StatusTone } from "~/components/status-badge";
import { EmptyState } from "~/components/empty-state";
import { PageHeader } from "~/components/page-header";
import { RoleGuard } from "~/components/role-guard";
import { Skeleton } from "~/components/skeleton";
import { StatCard } from "~/components/stat-card";
import { StatusBadge } from "~/components/status-badge";
import { useTRPC } from "~/trpc/client";

interface TriggerConfig {
  label: string;
  tone: StatusTone;
  icon: IconName;
}

const TRIGGER_CONFIG: Record<string, TriggerConfig> = {
  auto: {
    label: "Automático",
    tone: "primary",
    icon: "Bolt",
  },
  manual: {
    label: "Manual",
    tone: "neutral",
    icon: "Edit",
  },
  scheduled: {
    label: "Programado",
    tone: "warning",
    icon: "Schedule",
  },
};

const PRICE_TYPE_LABELS: Record<string, string> = {
  store: "Tienda",
  wholesale: "Mayor",
  vendor: "Vendedor Nacional",
  promo: "Promoción",
  special: "Especial",
};

const RATE_TYPE_LABELS: Record<string, string> = {
  bcv: "BCV",
  parallel: "Paralelo",
  rmb_usd: "RMB/USD",
  rmb_bs: "RMB/Bs",
};

const cellPx = "px-4 py-3";

export default function PricingClient() {
  const trpc = useTRPC();
  const qc = useQueryClient();

  const [tab, setTab] = useState<"events" | "history">("events");

  const { data: events, isLoading: eventsLoading } = useQuery(
    trpc.pricing.listRepricingEvents.queryOptions({ limit: 50 }),
  );
  const { data: history, isLoading: historyLoading } = useQuery(
    trpc.pricing.priceHistory.queryOptions({ limit: 100 }),
  );

  const approve = useMutation(
    trpc.pricing.approveRepricing.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: [["pricing"]] });
      },
    }),
  );

  const eventsList = useMemo(() => events ?? [], [events]);
  const historyList = useMemo(() => history ?? [], [history]);

  const pendingApproval = useMemo(
    () => eventsList.filter((e) => !e.isApproved).length,
    [eventsList],
  );

  const hasHighVariation = useMemo(
    () => eventsList.some((e) => (e.variationPct ?? 0) >= 5 && !e.isApproved),
    [eventsList],
  );

  const totalProductsAffected = useMemo(
    () => eventsList.reduce((n, e) => n + e.productsAffected, 0),
    [eventsList],
  );

  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 space-y-6 p-4 duration-200 lg:p-8">
      <PageHeader
        title="Motor de Precios"
        description="Repricing masivo, auditoría de precios y aprobaciones ejecutivas"
        actions={
          pendingApproval > 0 ? (
            <div className="border-warning/30 bg-warning/10 text-warning flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-medium">
              <Icons.HourglassTop className="size-4" />
              <span className="font-mono tabular-nums">{pendingApproval}</span>
              <span>repricing pendiente{pendingApproval > 1 ? "s" : ""}</span>
            </div>
          ) : undefined
        }
      />

      {/* Critical Variation Alert (≥ 5% Trigger PRD §12) */}
      {hasHighVariation && (
        <div className="border-destructive/30 bg-destructive/10 text-destructive flex items-center gap-3 rounded-xl border p-4 text-xs">
          <Icons.Warning className="size-5" />
          <div>
            <p className="font-medium">
              Alerta de Variación Cambiaria Crítica (≥ 5% detectada)
            </p>
            <p className="mt-0.5 opacity-90">
              Los precios sugeridos se recalcularon automáticamente. Se dispone
              de una ventana de 24 horas para revisar y autorizar el impacto en
              catálogo.
            </p>
          </div>
        </div>
      )}

      {/* KPI StatCards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <StatCard
          label="Eventos de Repricing"
          value={
            eventsLoading ? "—" : eventsList.length.toLocaleString("es-VE")
          }
          icon="Sync"
          tone="primary"
        />
        <StatCard
          label="Pendientes Aprobación"
          value={eventsLoading ? "—" : pendingApproval.toLocaleString("es-VE")}
          icon="HourglassTop"
          tone={pendingApproval > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Cambios de Precio"
          value={
            historyLoading ? "—" : historyList.length.toLocaleString("es-VE")
          }
          icon="TrendingUp"
        />
        <StatCard
          label="Productos Afectados"
          value={
            eventsLoading ? "—" : totalProductsAffected.toLocaleString("es-VE")
          }
          icon="Inventory2"
        />
      </div>

      {/* Tabs Navigation */}
      <div className="border-border-subtle flex gap-2 border-b pb-px">
        {[
          { key: "events" as const, label: "Eventos de Repricing" },
          { key: "history" as const, label: "Auditoría de Precios" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`min-h-10 rounded-t-xl px-4 py-2 text-xs font-medium transition-colors ${
              tab === t.key
                ? "border-border-subtle bg-card text-foreground border-t border-r border-l shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Eventos de Repricing ─────────────── */}
      {tab === "events" && (
        <div className="space-y-3">
          {eventsLoading
            ? Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="border-border-subtle surface-card rounded-xl border p-4"
                >
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="mt-2 h-4 w-64" />
                </div>
              ))
            : eventsList.map((event) => {
                const trig = TRIGGER_CONFIG[event.trigger] ?? {
                  label: event.trigger,
                  tone: "neutral" as StatusTone,
                  icon: "Bolt" as const,
                };
                const rateLabel = event.rateType
                  ? `${RATE_TYPE_LABELS[event.rateType] ?? event.rateType}`
                  : "General";

                return (
                  <div
                    key={event.id}
                    className={`border-border-subtle surface-card rounded-xl border p-4 transition-all ${
                      !event.isApproved
                        ? "border-amber-500/40 bg-amber-500/5 ring-1 ring-amber-500/10"
                        : ""
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Icon
                          name={trig.icon}
                          className="text-muted-foreground size-5"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <StatusBadge tone={trig.tone}>
                              {trig.label}
                            </StatusBadge>
                            <span className="text-foreground text-xs font-medium">
                              {rateLabel}
                            </span>
                            {event.variationPct != null && (
                              <span className="text-muted-foreground font-mono text-xs font-medium tabular-nums">
                                (Δ {event.variationPct.toFixed(1)}%)
                              </span>
                            )}
                          </div>
                          <div className="text-muted-foreground mt-1 flex items-center gap-2 text-xs">
                            <span className="font-mono tabular-nums">
                              {new Date(event.createdAt).toLocaleString(
                                "es-VE",
                              )}
                            </span>
                            <span>•</span>
                            <span className="font-mono tabular-nums">
                              {event.productsAffected} productos afectados
                            </span>
                            {event.oldRate != null && event.newRate != null && (
                              <>
                                <span>•</span>
                                <span className="font-mono tabular-nums">
                                  {event.oldRate.toFixed(2)} →{" "}
                                  {event.newRate.toFixed(2)}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div>
                        {event.isApproved ? (
                          <StatusBadge tone="success">
                            <Icons.CheckCircle className="mr-1 size-3" />
                            Aprobado
                          </StatusBadge>
                        ) : (
                          <RoleGuard allow={["owner", "admin", "supervisor"]}>
                            <button
                              type="button"
                              onClick={() => approve.mutate({ id: event.id })}
                              disabled={approve.isPending}
                              className="bg-primary text-primary-foreground hover:bg-primary/90 min-h-9 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
                            >
                              {approve.isPending
                                ? "Aprobando..."
                                : "Aprobar Repricing"}
                            </button>
                          </RoleGuard>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

          {!eventsLoading && eventsList.length === 0 && (
            <EmptyState
              icon="PriceChange"
              title="No hay eventos de repricing"
              description="Las variaciones de cotización generarán eventos automáticos cuando superen el umbral configurado."
            />
          )}
        </div>
      )}

      {/* ── Tab: Historial de Precios ─────────────── */}
      {tab === "history" && (
        <div>
          {historyLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="border-border-subtle surface-card overflow-hidden rounded-xl border">
              {/* Desktop Table View */}
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-border-subtle border-b">
                    <th
                      className={`text-muted-foreground ${cellPx} text-xs font-medium tracking-widest uppercase`}
                    >
                      Fecha y Hora
                    </th>
                    <th
                      className={`text-muted-foreground ${cellPx} text-xs font-medium tracking-widest uppercase`}
                    >
                      Tipo de Precio
                    </th>
                    <th
                      className={`text-muted-foreground ${cellPx} text-right text-xs font-medium tracking-widest uppercase`}
                    >
                      Precio Anterior
                    </th>
                    <th
                      className={`text-muted-foreground ${cellPx} text-right text-xs font-medium tracking-widest uppercase`}
                    >
                      Precio Nuevo
                    </th>
                    <th
                      className={`text-muted-foreground ${cellPx} text-right text-xs font-medium tracking-widest uppercase`}
                    >
                      Tasa Empleada
                    </th>
                    <th
                      className={`text-muted-foreground ${cellPx} text-center text-xs font-medium tracking-widest uppercase`}
                    >
                      Disparador
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {historyList.map((entry) => {
                    const trig = TRIGGER_CONFIG[entry.trigger] ?? {
                      label: entry.trigger,
                      tone: "neutral" as StatusTone,
                      icon: "Bolt" as const,
                    };
                    return (
                      <tr
                        key={entry.id}
                        className="border-border-subtle hover:bg-accent/50 border-b transition-colors"
                      >
                        <td
                          className={`text-muted-foreground ${cellPx} font-mono text-xs tabular-nums`}
                        >
                          {new Date(entry.createdAt).toLocaleString("es-VE")}
                        </td>
                        <td className={cellPx}>
                          <span className="text-foreground text-xs font-medium">
                            {PRICE_TYPE_LABELS[entry.priceType] ??
                              entry.priceType}
                          </span>
                        </td>
                        <td
                          className={`text-muted-foreground ${cellPx} text-right font-mono text-xs tabular-nums line-through`}
                        >
                          ${entry.oldAmountUsd?.toFixed(2) ?? "—"}
                        </td>
                        <td
                          className={`text-foreground ${cellPx} text-right font-mono text-sm font-medium tabular-nums`}
                        >
                          ${entry.newAmountUsd.toFixed(2)}
                        </td>
                        <td
                          className={`text-muted-foreground ${cellPx} text-right font-mono text-xs tabular-nums`}
                        >
                          {entry.rateUsed != null
                            ? Number(entry.rateUsed).toFixed(4)
                            : "—"}
                        </td>
                        <td className={`${cellPx} text-center`}>
                          <StatusBadge tone={trig.tone}>
                            {trig.label}
                          </StatusBadge>
                        </td>
                      </tr>
                    );
                  })}

                  {historyList.length === 0 && (
                    <tr className="hover:bg-transparent">
                      <td colSpan={6} className="px-4 py-6">
                        <EmptyState
                          icon="PriceChange"
                          title="Sin registros de auditoría"
                          description="Los ajustes y recálculos de precios de catálogo se documentarán en esta tabla."
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
