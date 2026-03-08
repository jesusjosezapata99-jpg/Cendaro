"use client";

import Link from "next/link";
import { useTRPC } from "~/trpc/client";
import { useQueries } from "@tanstack/react-query";

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-muted ${className}`} />;
}

export default function DashboardClient() {
  const trpc = useTRPC();
  const [summaryResult, closuresResult, alertResult] = useQueries({
    queries: [
      trpc.dashboard.salesSummary.queryOptions(),
      trpc.dashboard.latestClosures.queryOptions({ limit: 5 }),
      trpc.dashboard.activeAlertCount.queryOptions(),
    ],
  });
  const { data: summary, isLoading: summaryLoading } = summaryResult;
  const { data: closures, isLoading: closuresLoading } = closuresResult;
  const { data: alertCount } = alertResult;

  const kpis = [
    { label: "Órdenes Totales", value: summary?.orders.total ?? 0, icon: "receipt_long", accent: "border-emerald-500/40", href: "/orders" },
    { label: "Ingresos", value: `$${(summary?.orders.revenue ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`, icon: "payments", accent: "border-blue-500/40", href: "/orders" },
    { label: "Cobrado", value: `$${(summary?.orders.paid ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`, icon: "trending_up", accent: "border-violet-500/40", href: "/payments" },
    { label: "Pagos", value: summary?.payments.total ?? 0, icon: "credit_card", accent: "border-cyan-500/40", href: "/payments" },
    { label: "CxC Pendiente", value: `$${(summary?.accountsReceivable.debt ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`, icon: "account_balance_wallet", accent: "border-amber-500/40", href: "/accounts-receivable" },
    { label: "Alertas", value: alertCount ?? 0, icon: "notifications_active", accent: (alertCount ?? 0) > 0 ? "border-red-500/40" : "border-border", href: "/alerts" },
  ];

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-foreground">Dashboard Ejecutivo</h1>
        <p className="text-sm text-muted-foreground mt-1">Visibilidad operativa completa</p>
      </div>

      {/* Primary KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {summaryLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-3">
                <Skeleton className="mb-2 h-3 w-20" />
                <Skeleton className="h-6 w-16" />
              </div>
            ))
          : kpis.map((stat) => (
              <Link key={stat.label} href={stat.href} className={`rounded-xl border-l-4 ${stat.accent} bg-card p-3 border border-border transition-colors hover:border-primary/40 hover:bg-accent/30 cursor-pointer`}>
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-lg text-muted-foreground">{stat.icon}</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{stat.label}</span>
                </div>
                <p className="mt-1 text-lg font-bold text-foreground">{stat.value}</p>
              </Link>
            ))}
      </div>

      {/* Alert strip */}
      {(alertCount ?? 0) > 0 && (
        <div className="flex gap-3 overflow-x-auto">
          <div className="shrink-0 rounded-lg border border-red-300 bg-red-100 px-4 py-2 dark:border-red-500/30 dark:bg-red-500/10 text-red-700 dark:text-red-400">
            <span className="text-xs font-medium">Alertas activas: </span>
            <span className="text-sm font-bold">{alertCount}</span>
          </div>
          {(summary?.accountsReceivable.debt ?? 0) > 0 && (
            <div className="shrink-0 rounded-lg border border-amber-300 bg-amber-100 px-4 py-2 dark:border-amber-500/30 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400">
              <span className="text-xs font-medium">CxC Pendiente: </span>
              <span className="text-sm font-bold">${(summary?.accountsReceivable.debt ?? 0).toFixed(0)}</span>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Summary Cards */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-4 text-sm font-semibold text-muted-foreground">Resumen de Operaciones</h3>
          <div className="space-y-3">
            {[
              { label: "Órdenes", value: summary?.orders.total ?? 0, icon: "receipt_long", href: "/orders" },
              { label: "Pagos Procesados", value: summary?.payments.total ?? 0, icon: "credit_card", href: "/payments" },
              { label: "CxC Abiertas", value: summary?.accountsReceivable.total ?? 0, icon: "assignment", href: "/accounts-receivable" },
              { label: "Total Recaudado", value: `$${(summary?.payments.collected ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`, icon: "attach_money", href: "/cash-closure" },
            ].map((item) => (
              <Link key={item.label} href={item.href} className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-accent/30 hover:border-primary/30 cursor-pointer">
                <span className="flex items-center gap-2 text-sm text-foreground">
                  <span className="material-symbols-outlined text-lg text-muted-foreground">{item.icon}</span>
                  {item.label}
                </span>
                <span className="font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">{item.value}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-4 text-sm font-semibold text-muted-foreground">Estado del Sistema</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <span className="flex items-center gap-2 text-sm text-foreground">
                <span className="material-symbols-outlined text-lg text-muted-foreground">database</span>
                Supabase
              </span>
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                Conectado
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <span className="flex items-center gap-2 text-sm text-foreground">
                <span className="material-symbols-outlined text-lg text-muted-foreground">api</span>
                tRPC API
              </span>
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                Online
              </span>
            </div>
            <Link href="/alerts" className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-accent/30 hover:border-primary/30 cursor-pointer">
              <span className="flex items-center gap-2 text-sm text-foreground">
                <span className="material-symbols-outlined text-lg text-muted-foreground">notifications_active</span>
                Alertas Activas
              </span>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                (alertCount ?? 0) > 0
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                  : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
              }`}>
                {alertCount ?? 0}
              </span>
            </Link>
          </div>
        </div>

        {/* Cash Summary */}
        <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold text-muted-foreground">Cierres de Caja Recientes</h3>
          {closuresLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : closures && closures.length > 0 ? (
            <div className="overflow-hidden rounded-lg">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    <th className="py-2 pr-4">Fecha</th>
                    <th className="py-2 pr-4 text-right">Ventas</th>
                    <th className="py-2 pr-4 text-right">Efectivo</th>
                    <th className="py-2 pr-4 text-right">Digital</th>
                    <th className="py-2 text-right">Discrepancia</th>
                  </tr>
                </thead>
                <tbody>
                  {closures.map((c) => (
                    <tr key={c.id} className="border-t border-border">
                      <td className="py-2.5 pr-4 font-medium text-foreground">
                        {new Date(c.closureDate).toLocaleDateString("es-VE")}
                      </td>
                      <td className="py-2.5 pr-4 text-right font-mono text-foreground">
                        ${Number(c.totalSales).toFixed(2)}
                      </td>
                      <td className="py-2.5 pr-4 text-right font-mono text-emerald-600 dark:text-emerald-400">
                        ${Number(c.totalCash).toFixed(2)}
                      </td>
                      <td className="py-2.5 pr-4 text-right font-mono text-primary">
                        ${Number(c.totalDigital).toFixed(2)}
                      </td>
                      <td className={`py-2.5 text-right font-mono font-bold ${
                        Number(c.actualTotal ?? 0) - Number(c.expectedTotal ?? 0) === 0 ? "text-emerald-600 dark:text-emerald-400"
                          : Number(c.actualTotal ?? 0) - Number(c.expectedTotal ?? 0) < 0 ? "text-red-600 dark:text-red-400"
                          : "text-amber-600 dark:text-amber-400"
                      }`}>
                        {Number(c.actualTotal ?? 0) - Number(c.expectedTotal ?? 0) >= 0 ? "+" : ""}{(Number(c.actualTotal ?? 0) - Number(c.expectedTotal ?? 0)).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <span className="material-symbols-outlined text-3xl mb-2">lock_clock</span>
              <p className="text-sm">No hay cierres de caja registrados</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
