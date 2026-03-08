"use client";

import { useState } from "react";
import { useTRPC } from "~/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-muted ${className}`} />;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active: { label: "Activo", color: "bg-emerald-500/20 text-emerald-400" },
  paused: { label: "Pausado", color: "bg-amber-500/20 text-amber-400" },
  closed: { label: "Cerrado", color: "bg-slate-500/20 text-muted-foreground" },
  out_of_stock: { label: "Sin Stock", color: "bg-red-500/20 text-red-400" },
  error: { label: "Error", color: "bg-red-600/20 text-red-400" },
};

const _SHIPPING_CFG: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendiente", color: "text-amber-400" },
  ready_to_ship: { label: "Listo", color: "text-primary" },
  shipped: { label: "Enviado", color: "text-violet-400" },
  delivered: { label: "Entregado", color: "text-emerald-400" },
};

const LOG_LEVEL_CFG: Record<string, { label: string; color: string }> = {
  error: { label: "Error", color: "text-red-400 bg-red-500/20" },
  warning: { label: "Warning", color: "text-amber-400 bg-amber-500/20" },
  info: { label: "Info", color: "text-blue-400 bg-blue-500/20" },
};

export default function MarketplacePage() {
  const trpc = useTRPC();
  const { data: listings, isLoading: listingsLoading } = useQuery(
    trpc.integrations.listMlListings.queryOptions({ limit: 50 }),
  );
  const { data: orders, isLoading: ordersLoading } = useQuery(
    trpc.integrations.listMlOrders.queryOptions({ limit: 50 }),
  );
  const { data: logs, isLoading: logsLoading } = useQuery(
    trpc.integrations.listLogs.queryOptions({ source: "mercadolibre", limit: 50 }),
  );

  const [tab, setTab] = useState<"listings" | "orders" | "logs">("listings");
  const qc = useQueryClient();

  const importOrder = useMutation(
    trpc.integrations.importMlOrder.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: [['integrations']] });
      },
    }),
  );

  const resolveLog = useMutation(
    trpc.integrations.resolveLog.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: [['integrations']] });
      },
    }),
  );

  const listingItems = listings ?? [];
  const orderItems = orders ?? [];
  const logItems = logs ?? [];

  const activeListings = listingItems.filter((l) => l.status === "active").length;
  const pendingImport = orderItems.filter((o) => !o.isImported).length;
  const activeAlerts = logItems.filter((a) => !a.isResolved).length;

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">
            <span className="mr-2">🛒</span>Mercado Libre
          </h1>
          <p className="text-sm text-muted-foreground">Panel de control de integración</p>
        </div>
        <button className="rounded-lg bg-yellow-500 px-4 py-2.5 text-sm font-medium text-black transition-colors hover:bg-yellow-400">
          🔄 Sincronizar Todo
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        {[
          { label: "Publicaciones Activas", value: activeListings, icon: "package_2", accent: "border-emerald-500/40" },
          { label: "Total Publicados", value: listingItems.length, icon: "storefront", accent: "border-blue-500/40" },
          { label: "Órdenes Pendientes", value: pendingImport, icon: "inbox", accent: "border-amber-500/40" },
          { label: "Alertas Activas", value: activeAlerts, icon: "warning", accent: activeAlerts > 0 ? "border-red-500/40" : "border-slate-500/40" },
        ].map((stat) => (
          <div key={stat.label} className={`rounded-xl border-l-4 ${stat.accent} bg-card border border-border p-4`}>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-lg text-muted-foreground">{stat.icon}</span>
              <span className="text-xs text-muted-foreground">{stat.label}</span>
            </div>
            <p className="mt-1 text-2xl font-black tracking-tight text-foreground">{stat.value}</p>
          </div>
        ))}
      </div>

      {activeAlerts > 0 && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">🚨</span>
            <p className="font-medium text-red-400">{activeAlerts} alerta{activeAlerts > 1 ? "s" : ""} de integración sin resolver</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-card border border-border p-1">
        {(["listings", "orders", "logs"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "listings" ? "📦 Publicaciones" : t === "orders" ? "📥 Órdenes ML" : "📋 Logs"}
          </button>
        ))}
      </div>

      {/* Listings Tab */}
      {tab === "listings" && (
        listingsLoading ? (
          <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase text-muted-foreground">
                  <th className="px-4 py-3 font-medium">ML ID</th>
                  <th className="px-4 py-3 font-medium">Título</th>
                  <th className="px-4 py-3 font-medium text-right">Precio</th>
                  <th className="px-4 py-3 font-medium text-center">Estado</th>
                  <th className="px-4 py-3 font-medium text-right">Stock</th>
                  <th className="px-4 py-3 font-medium">Última Sync</th>
                </tr>
              </thead>
              <tbody>
                {listingItems.map((l) => {
                  const cfg = STATUS_CONFIG[l.status] ?? { label: l.status, color: "bg-muted text-muted-foreground" };
                  return (
                    <tr key={l.id} className="border-b border-border transition-colors hover:bg-accent/50">
                      <td className="px-4 py-3 font-mono text-xs text-primary">{l.mlItemId}</td>
                      <td className="px-4 py-3 text-foreground">{l.title}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-foreground">${l.price.toFixed(2)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-foreground">{l.stockSynced}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {l.lastSyncAt ? new Date(l.lastSyncAt).toLocaleString() : "Nunca"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Orders Tab */}
      {tab === "orders" && (
        ordersLoading ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Orden ML</th>
                  <th className="px-4 py-3 font-medium">Comprador</th>
                  <th className="px-4 py-3 font-medium text-right">Precio Unit.</th>
                  <th className="px-4 py-3 font-medium text-right">Cant.</th>
                  <th className="px-4 py-3 font-medium text-right">Total</th>
                  <th className="px-4 py-3 font-medium text-center">Envío</th>
                  <th className="px-4 py-3 font-medium text-center">Importado</th>
                </tr>
              </thead>
              <tbody>
                {orderItems.map((o) => {
                  return (
                    <tr key={o.id} className="border-b border-border transition-colors hover:bg-accent/50">
                      <td className="px-4 py-3 font-mono text-xs text-primary">{o.mlOrderId}</td>
                      <td className="px-4 py-3 text-muted-foreground">{o.buyerNickname ?? "—"}</td>
                      <td className="px-4 py-3 text-right font-mono text-muted-foreground">${o.unitPrice.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-mono text-muted-foreground">{o.quantity}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-foreground">${(o.unitPrice * o.quantity).toFixed(2)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-xs font-medium text-muted-foreground">{o.shippingStatus ?? "—"}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {o.isImported ? (
                          <span className="text-emerald-400">✅</span>
                        ) : (
                          <button
                            onClick={() => importOrder.mutate({ id: o.id })}
                            disabled={importOrder.isPending}
                            className="rounded bg-blue-600/20 px-2 py-0.5 text-xs text-primary transition-colors hover:bg-blue-600/40 disabled:opacity-50"
                          >
                            {importOrder.isPending ? "..." : "Importar"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Logs Tab */}
      {tab === "logs" && (
        logsLoading ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
        ) : (
          <div className="space-y-2">
            {logItems.map((log) => {
              const lvl = LOG_LEVEL_CFG[log.level] ?? { label: log.level, color: "text-muted-foreground bg-muted" };
              return (
                <div
                  key={log.id}
                  className={`rounded-xl border border-border ${log.isResolved ? "bg-card/50 opacity-60" : "bg-card"} p-4`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${lvl.color}`}>{lvl.label}</span>
                      <p className={`text-sm ${log.isResolved ? "text-muted-foreground line-through" : "text-foreground"}`}>
                        {log.message}
                      </p>
                    </div>
                    {!log.isResolved && (
                      <button
                        onClick={() => resolveLog.mutate({ id: log.id })}
                        disabled={resolveLog.isPending}
                        className="rounded-lg border border-border bg-secondary px-3 py-1 text-xs font-bold text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
                      >
                        {resolveLog.isPending ? "..." : "Resolver"}
                      </button>
                    )}
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString()} · {log.source}
                  </p>
                </div>
              );
            })}
            {logItems.length === 0 && (
              <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
                No hay logs de integración
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
}
