"use client";

import Link from "next/link";
import { useQueries } from "@tanstack/react-query";

import { useBcvRate } from "~/hooks/use-bcv-rate";
import { formatDualCurrency } from "~/lib/format-currency";
import { useTRPC } from "~/trpc/client";

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`bg-muted animate-pulse rounded-lg ${className}`} />;
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

  const bcv = useBcvRate();

  const kpis = [
    {
      label: "Órdenes Totales",
      value: summary?.orders.total ?? 0,
      icon: "receipt_long",
      accent: "border-emerald-500/40",
      href: "/orders",
    },
    {
      label: "Ingresos",
      value: formatDualCurrency(summary?.orders.revenue ?? 0, bcv.rate).usd,
      sub: formatDualCurrency(summary?.orders.revenue ?? 0, bcv.rate).bs,
      icon: "payments",
      accent: "border-blue-500/40",
      href: "/orders",
    },
    {
      label: "Cobrado",
      value: formatDualCurrency(summary?.orders.paid ?? 0, bcv.rate).usd,
      sub: formatDualCurrency(summary?.orders.paid ?? 0, bcv.rate).bs,
      icon: "trending_up",
      accent: "border-violet-500/40",
      href: "/payments",
    },
    {
      label: "Pagos",
      value: summary?.payments.total ?? 0,
      icon: "credit_card",
      accent: "border-cyan-500/40",
      href: "/payments",
    },
    {
      label: "CxC Pendiente",
      value: formatDualCurrency(summary?.accountsReceivable.debt ?? 0, bcv.rate)
        .usd,
      sub: formatDualCurrency(summary?.accountsReceivable.debt ?? 0, bcv.rate)
        .bs,
      icon: "account_balance_wallet",
      accent: "border-amber-500/40",
      href: "/accounts-receivable",
    },
    {
      label: "Alertas",
      value: alertCount ?? 0,
      icon: "notifications_active",
      accent: (alertCount ?? 0) > 0 ? "border-red-500/40" : "border-border",
      href: "/alerts",
    },
  ];

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <div>
        <h1 className="text-foreground text-2xl font-black tracking-tight">
          Dashboard Ejecutivo
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Visibilidad operativa completa
        </p>
        {bcv.rate > 0 && (
          <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            BCV: {bcv.rate.toFixed(2)} Bs/$ ({bcv.date})
          </span>
        )}
      </div>

      {/* Primary KPIs — 2 cols on mobile, 3 on sm, 6 on lg */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {summaryLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="border-border bg-card rounded-xl border p-3"
              >
                <Skeleton className="mb-2 h-3 w-20" />
                <Skeleton className="h-6 w-16" />
              </div>
            ))
          : kpis.map((stat) => (
              <Link
                key={stat.label}
                href={stat.href}
                className={`rounded-xl border-l-4 ${stat.accent} bg-card border-border hover:border-primary/40 hover:bg-accent/30 cursor-pointer border p-3 transition-colors`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-muted-foreground text-lg">
                    {stat.icon}
                  </span>
                  <span className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
                    {stat.label}
                  </span>
                </div>
                <p className="text-foreground mt-1 text-lg font-bold">
                  {stat.value}
                </p>
                {"sub" in stat && stat.sub && (
                  <p className="text-muted-foreground text-[10px] font-medium">
                    {stat.sub}
                  </p>
                )}
              </Link>
            ))}
      </div>

      {/* Alert strip — horizontally scrollable on mobile */}
      {(alertCount ?? 0) > 0 && (
        <div className="mobile-scroll-x flex gap-3">
          <div className="shrink-0 rounded-lg border border-red-300 bg-red-100 px-4 py-2 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
            <span className="text-xs font-medium">Alertas activas: </span>
            <span className="text-sm font-bold">{alertCount}</span>
          </div>
          {(summary?.accountsReceivable.debt ?? 0) > 0 && (
            <div className="shrink-0 rounded-lg border border-amber-300 bg-amber-100 px-4 py-2 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
              <span className="text-xs font-medium">CxC Pendiente: </span>
              <span className="text-sm font-bold">
                ${(summary?.accountsReceivable.debt ?? 0).toFixed(0)}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Summary Cards */}
        <div className="border-border bg-card rounded-xl border p-5">
          <h3 className="text-muted-foreground mb-4 text-sm font-semibold">
            Resumen de Operaciones
          </h3>
          <div className="space-y-3">
            {[
              {
                label: "Órdenes",
                value: summary?.orders.total ?? 0,
                icon: "receipt_long",
                href: "/orders",
              },
              {
                label: "Pagos Procesados",
                value: summary?.payments.total ?? 0,
                icon: "credit_card",
                href: "/payments",
              },
              {
                label: "CxC Abiertas",
                value: summary?.accountsReceivable.total ?? 0,
                icon: "assignment",
                href: "/accounts-receivable",
              },
              {
                label: "Total Recaudado",
                value: formatDualCurrency(
                  summary?.payments.collected ?? 0,
                  bcv.rate,
                ).usd,
                sub: formatDualCurrency(
                  summary?.payments.collected ?? 0,
                  bcv.rate,
                ).bs,
                icon: "attach_money",
                href: "/cash-closure",
              },
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="border-border hover:bg-accent/30 hover:border-primary/30 flex min-h-[44px] cursor-pointer items-center justify-between rounded-lg border p-3 transition-colors"
              >
                <span className="text-foreground flex items-center gap-2 text-sm">
                  <span className="material-symbols-outlined text-muted-foreground text-lg">
                    {item.icon}
                  </span>
                  {item.label}
                </span>
                <span className="font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  {item.value}
                  {"sub" in item && item.sub && (
                    <span className="text-muted-foreground ml-2 text-[10px] font-normal">
                      {item.sub}
                    </span>
                  )}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="border-border bg-card rounded-xl border p-5">
          <h3 className="text-muted-foreground mb-4 text-sm font-semibold">
            Estado del Sistema
          </h3>
          <div className="space-y-3">
            <div className="border-border flex min-h-[44px] items-center justify-between rounded-lg border p-3">
              <span className="text-foreground flex items-center gap-2 text-sm">
                <span className="material-symbols-outlined text-muted-foreground text-lg">
                  database
                </span>
                Supabase
              </span>
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                Conectado
              </span>
            </div>
            <div className="border-border flex min-h-[44px] items-center justify-between rounded-lg border p-3">
              <span className="text-foreground flex items-center gap-2 text-sm">
                <span className="material-symbols-outlined text-muted-foreground text-lg">
                  api
                </span>
                tRPC API
              </span>
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                Online
              </span>
            </div>
            <Link
              href="/alerts"
              className="border-border hover:bg-accent/30 hover:border-primary/30 flex min-h-[44px] cursor-pointer items-center justify-between rounded-lg border p-3 transition-colors"
            >
              <span className="text-foreground flex items-center gap-2 text-sm">
                <span className="material-symbols-outlined text-muted-foreground text-lg">
                  notifications_active
                </span>
                Alertas Activas
              </span>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  (alertCount ?? 0) > 0
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                }`}
              >
                {alertCount ?? 0}
              </span>
            </Link>
          </div>
        </div>

        {/* Cash Closures — horizontal scroll wrapper for mobile table */}
        <div className="border-border bg-card rounded-xl border p-5 lg:col-span-2">
          <h3 className="text-muted-foreground mb-4 text-sm font-semibold">
            Cierres de Caja Recientes
          </h3>
          {closuresLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : closures && closures.length > 0 ? (
            <div className="mobile-scroll-x overflow-hidden rounded-lg">
              <table className="w-full min-w-[500px] text-left text-sm">
                <thead>
                  <tr className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
                    <th className="py-2 pr-4">Fecha</th>
                    <th className="py-2 pr-4 text-right">Ventas</th>
                    <th className="py-2 pr-4 text-right">Efectivo</th>
                    <th className="py-2 pr-4 text-right">Digital</th>
                    <th className="py-2 text-right">Discrepancia</th>
                  </tr>
                </thead>
                <tbody>
                  {closures.map((c) => (
                    <tr key={c.id} className="border-border border-t">
                      <td className="text-foreground py-2.5 pr-4 font-medium">
                        {new Date(c.closureDate).toLocaleDateString("es-VE")}
                      </td>
                      <td className="text-foreground py-2.5 pr-4 text-right font-mono">
                        ${Number(c.totalSales).toFixed(2)}
                      </td>
                      <td className="py-2.5 pr-4 text-right font-mono text-emerald-600 dark:text-emerald-400">
                        ${Number(c.totalCash).toFixed(2)}
                      </td>
                      <td className="text-primary py-2.5 pr-4 text-right font-mono">
                        ${Number(c.totalDigital).toFixed(2)}
                      </td>
                      <td
                        className={`py-2.5 text-right font-mono font-bold ${
                          Number(c.actualTotal ?? 0) -
                            Number(c.expectedTotal ?? 0) ===
                          0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : Number(c.actualTotal ?? 0) -
                                  Number(c.expectedTotal ?? 0) <
                                0
                              ? "text-red-600 dark:text-red-400"
                              : "text-amber-600 dark:text-amber-400"
                        }`}
                      >
                        {Number(c.actualTotal ?? 0) -
                          Number(c.expectedTotal ?? 0) >=
                        0
                          ? "+"
                          : ""}
                        {(
                          Number(c.actualTotal ?? 0) -
                          Number(c.expectedTotal ?? 0)
                        ).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-muted-foreground flex flex-col items-center justify-center py-8">
              <span className="material-symbols-outlined mb-2 text-3xl">
                lock_clock
              </span>
              <p className="text-sm">No hay cierres de caja registrados</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
