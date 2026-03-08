"use client";

import { useState } from "react";
import { useTRPC } from "~/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-muted ${className}`} />;
}

const TRIGGER_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  auto: { label: "Automático", color: "bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400", icon: "bolt" },
  manual: { label: "Manual", color: "bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400", icon: "edit" },
  scheduled: { label: "Programado", color: "bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400", icon: "schedule" },
};

const PRICE_TYPE_LABELS: Record<string, string> = {
  store: "Tienda", wholesale: "Mayor", vendor: "Vendedor", promo: "Promo", special: "Especial",
};

const RATE_TYPE_LABELS: Record<string, string> = {
  bcv: "BCV", parallel: "Paralela", rmb_usd: "RMB/USD", rmb_bs: "RMB/Bs",
};

export default function PricingPage() {
  const trpc = useTRPC();
  const { data: events, isLoading: eventsLoading } = useQuery(
    trpc.pricing.listRepricingEvents.queryOptions({ limit: 20 }),
  );
  const { data: history, isLoading: historyLoading } = useQuery(
    trpc.pricing.priceHistory.queryOptions({ limit: 50 }),
  );
  const [tab, setTab] = useState<"events" | "history">("events");
  const qc = useQueryClient();

  const approve = useMutation(
    trpc.pricing.approveRepricing.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: [['pricing']] });
      },
    }),
  );

  const eventsList = events ?? [];
  const historyList = history ?? [];
  const pendingApproval = eventsList.filter((e) => !e.isApproved).length;
  const hasHighVariation = eventsList.some((e) => (e.variationPct ?? 0) >= 5);

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">Motor de Precios</h1>
          <p className="text-sm text-muted-foreground mt-1">Repricing masivo, historial de precios y aprobaciones</p>
        </div>
        {pendingApproval > 0 && (
          <span className="flex items-center gap-2 rounded-lg bg-amber-100 dark:bg-amber-500/20 px-4 py-2 text-sm font-bold text-amber-700 dark:text-amber-400">
            <span className="material-symbols-outlined text-lg">warning</span>
            {pendingApproval} repricing pendiente de aprobación
          </span>
        )}
      </div>

      {hasHighVariation && (
        <div className="rounded-xl border border-red-300 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-lg text-red-600 dark:text-red-400">error</span>
            <div>
              <p className="font-bold text-red-700 dark:text-red-400">Alerta: Variación ≥ 5% detectada</p>
              <p className="text-xs text-red-600/70 dark:text-red-400/70">Los precios se actualizaron automáticamente. Tienes 24 horas para revisar/aprobar.</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        {[
          { label: "Eventos de Repricing", value: eventsList.length, icon: "sync", accent: "border-blue-500/40" },
          { label: "Pendientes Aprobación", value: pendingApproval, icon: "hourglass_top", accent: "border-amber-500/40" },
          { label: "Cambios de Precio", value: historyList.length, icon: "trending_up", accent: "border-emerald-500/40" },
          { label: "Productos Afectados", value: eventsList.reduce((n, e) => n + e.productsAffected, 0), icon: "inventory_2", accent: "border-violet-500/40" },
        ].map((stat) => (
          <div key={stat.label} className={`rounded-xl border-l-4 ${stat.accent} bg-card border border-border p-4`}>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-lg text-muted-foreground">{stat.icon}</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{stat.label}</span>
            </div>
            <p className="mt-1 text-2xl font-bold text-foreground">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 border-b border-border pb-px">
        {[
          { key: "events" as const, label: "Eventos de Repricing" },
          { key: "history" as const, label: "Historial de Precios" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-t-lg px-4 py-2 text-sm font-bold transition-colors ${
              tab === t.key ? "bg-card text-foreground border border-border border-b-card" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "events" && (
        eventsLoading ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
        ) : (
          <div className="space-y-3">
            {eventsList.map((event) => {
              const cfg = TRIGGER_CONFIG[event.trigger] ?? { label: event.trigger, color: "bg-muted text-muted-foreground", icon: "bolt" };
              const rateLabel = event.rateType
                ? `${RATE_TYPE_LABELS[event.rateType] ?? event.rateType}: ${event.oldRate?.toFixed(2) ?? "—"} → ${event.newRate?.toFixed(2) ?? "—"} (${event.variationPct != null ? `${event.variationPct.toFixed(1)}%` : "—"})`
                : "—";
              return (
                <div
                  key={event.id}
                  className={`rounded-xl border ${
                    !event.isApproved ? "border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/5" : "border-border bg-card"
                  } p-4`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-xl text-muted-foreground">{cfg.icon}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${cfg.color}`}>{cfg.label}</span>
                          <span className="text-sm font-medium text-foreground">
                            {rateLabel}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {new Date(event.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    {event.isApproved ? (
                      <span className="flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-900/20 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        <span className="material-symbols-outlined text-sm">check_circle</span> Aprobado
                      </span>
                    ) : (
                      <button
                        onClick={() => approve.mutate({ id: event.id })}
                        disabled={approve.isPending}
                        className="rounded-lg bg-warning px-4 py-1.5 text-xs font-bold text-warning-foreground transition-colors hover:bg-warning/90 disabled:opacity-50"
                      >
                        {approve.isPending ? "..." : "Aprobar"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {tab === "history" && (
        historyLoading ? (
          <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Tipo Precio</th>
                  <th className="px-4 py-3 text-right">Anterior</th>
                  <th className="px-4 py-3 text-right">Nuevo</th>
                  <th className="px-4 py-3 text-right">Tasa</th>
                  <th className="px-4 py-3">Disparador</th>
                </tr>
              </thead>
              <tbody>
                {historyList.map((entry) => {
                  const trigCfg = TRIGGER_CONFIG[entry.trigger] ?? { label: entry.trigger, color: "bg-muted text-muted-foreground", icon: "bolt" };
                  return (
                    <tr key={entry.id} className="border-b border-border transition-colors hover:bg-accent/50">
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {new Date(entry.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                          {PRICE_TYPE_LABELS[entry.priceType] ?? entry.priceType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-muted-foreground line-through">
                        ${entry.oldAmountUsd?.toFixed(2) ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-foreground">
                        ${entry.newAmountUsd.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                        {entry.rateUsed?.toFixed(4) ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${trigCfg.color}`}>{trigCfg.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {((tab === "events" && eventsList.length === 0 && !eventsLoading) ||
        (tab === "history" && historyList.length === 0 && !historyLoading)) && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-12 text-muted-foreground">
          <span className="material-symbols-outlined text-3xl mb-2">price_change</span>
          <p className="text-sm">No hay datos disponibles</p>
        </div>
      )}
    </div>
  );
}
