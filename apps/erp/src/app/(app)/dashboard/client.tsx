"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useQueries } from "@tanstack/react-query";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@cendaro/ui";

import type { ClosureSalesPoint } from "./charts";
import type { StatTone } from "~/components/stat-card";
import { EmptyState } from "~/components/empty-state";
import { PageHeader } from "~/components/page-header";
import { Skeleton } from "~/components/skeleton";
import { StatCard } from "~/components/stat-card";
import { StatusBadge } from "~/components/status-badge";
import { useVesRates } from "~/hooks/use-bcv-rate";
import { formatDualCurrency } from "~/lib/format-currency";
import { useTRPC } from "~/trpc/client";

/**
 * Charts hydrate lazily after first paint (ssr: false) — the recharts chunk
 * never competes with LCP, and the h-64 slots below reserve the space so
 * layout shift stays at zero.
 */
const SalesPerClosureChart = dynamic(
  () => import("./charts").then((m) => m.SalesPerClosureChart),
  { ssr: false, loading: () => <ChartPlaceholder /> },
);
const CollectionsDonutChart = dynamic(
  () => import("./charts").then((m) => m.CollectionsDonutChart),
  { ssr: false, loading: () => <ChartPlaceholder /> },
);

/** Height-reserved chart placeholder — prevents CLS while the chunk loads. */
function ChartPlaceholder() {
  return (
    <div className="flex h-full items-center justify-center">
      <Skeleton className="h-full w-full rounded-lg" />
    </div>
  );
}

interface Kpi {
  label: string;
  value: string | number;
  sub?: string;
  icon: string;
  tone: StatTone;
  href: string;
}

interface SummaryRow {
  label: string;
  icon: string;
  href: string;
  value: string | number;
  /** "success" tints the value with the success token (money in). */
  valueTone?: "default" | "success";
  sub?: string;
}

/** Shared row style for in-card navigable rows. */
const rowClasses =
  "border-border-subtle hover:bg-accent/50 hover:border-primary/30 focus-visible:border-ring focus-visible:ring-ring/50 flex min-h-11 items-center justify-between gap-3 rounded-lg border p-3 outline-none transition-all duration-200 active:scale-[0.99] motion-reduce:active:scale-100";

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

  const ves = useVesRates();
  const bcv = ves.oficial;
  const revenue = formatDualCurrency(summary?.orders.revenue ?? 0, bcv.rate);
  const collected = formatDualCurrency(
    summary?.payments.collected ?? 0,
    bcv.rate,
  );
  const receivable = formatDualCurrency(
    summary?.accountsReceivable.debt ?? 0,
    bcv.rate,
  );

  const kpis: Kpi[] = [
    {
      label: "Órdenes",
      value: summary?.orders.total ?? 0,
      icon: "receipt_long",
      tone: "primary",
      href: "/orders",
    },
    {
      label: "Ingresos",
      value: revenue.usd,
      sub: revenue.bs || undefined,
      icon: "payments",
      tone: "primary",
      href: "/orders",
    },
    {
      label: "Cobrado",
      value: formatDualCurrency(summary?.orders.paid ?? 0, bcv.rate).usd,
      sub:
        formatDualCurrency(summary?.orders.paid ?? 0, bcv.rate).bs || undefined,
      icon: "trending_up",
      tone: "success",
      href: "/payments",
    },
    {
      label: "Pagos",
      value: summary?.payments.total ?? 0,
      icon: "credit_card",
      tone: "default",
      href: "/payments",
    },
    {
      label: "Por Cobrar",
      value: receivable.usd,
      sub: receivable.bs || undefined,
      icon: "account_balance_wallet",
      tone: "warning",
      href: "/accounts-receivable",
    },
    {
      label: "Alertas",
      value: alertCount ?? 0,
      icon: "notifications_active",
      tone: (alertCount ?? 0) > 0 ? "destructive" : "default",
      href: "/alerts",
    },
  ];

  const summaryRows: SummaryRow[] = [
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
      value: collected.usd,
      sub: collected.bs || undefined,
      valueTone: "success",
      icon: "attach_money",
      href: "/cash-closure",
    },
  ];

  const closureSales: ClosureSalesPoint[] = (closures ?? []).map((c) => ({
    label: new Date(c.closureDate).toLocaleDateString("es-VE", {
      day: "numeric",
      month: "short",
    }),
    sales: Number(c.totalSales),
  }));

  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 space-y-6 p-4 duration-200 lg:p-8">
      <PageHeader
        title="Dashboard Ejecutivo"
        description="Visibilidad operativa completa"
      >
        {bcv.rate > 0 ? (
          <StatusBadge tone="success" className="mt-2 [&>span]:animate-pulse">
            BCV: {bcv.rate.toFixed(2)} Bs/$ · {bcv.date}
          </StatusBadge>
        ) : null}
      </PageHeader>

      {/* Primary KPIs — 2 cols on mobile, 3 on sm, 6 on lg */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {summaryLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="border-border-subtle surface-card flex flex-col gap-2 rounded-xl border p-4"
              >
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="size-7 rounded-lg" />
                </div>
                <Skeleton className="h-7 w-16" />
              </div>
            ))
          : kpis.map((stat) => (
              <StatCard
                key={stat.label}
                label={stat.label}
                value={stat.value}
                sub={stat.sub}
                icon={stat.icon}
                tone={stat.tone}
                href={stat.href}
              />
            ))}
      </div>

      {/* Alert strip — horizontally scrollable on mobile */}
      {(alertCount ?? 0) > 0 && (
        <div className="mobile-scroll-x flex gap-3">
          <StatusBadge
            tone="destructive"
            dot={false}
            className="shrink-0 px-3 py-1.5"
          >
            Alertas activas · {alertCount}
          </StatusBadge>
          {(summary?.accountsReceivable.debt ?? 0) > 0 && (
            <StatusBadge
              tone="warning"
              dot={false}
              className="shrink-0 px-3 py-1.5"
            >
              CxC Pendiente · ${receivable.usd.replace("$", "")}
            </StatusBadge>
          )}
        </div>
      )}

      {/* Analytics — lazily hydrated charts, height reserved (CLS 0) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm font-medium">
              Ventas por Cierre
            </CardTitle>
            <CardDescription className="text-xs">
              Últimos cierres de caja
            </CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <SalesPerClosureChart data={closureSales} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm font-medium">
              Cobranza
            </CardTitle>
            <CardDescription className="text-xs">
              Cobrado vs por cobrar (período actual)
            </CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <CollectionsDonutChart
              collected={summary?.orders.paid ?? 0}
              outstanding={summary?.accountsReceivable.debt ?? 0}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Summary — real counts and collected money */}
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm font-medium">
              Resumen de Operaciones
            </CardTitle>
            <CardDescription className="text-xs">
              Cifras del período actual
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {summaryRows.map((item) => (
              <Link key={item.label} href={item.href} className={rowClasses}>
                <span className="text-foreground flex items-center gap-2 text-sm">
                  <span className="material-symbols-outlined text-muted-foreground text-lg">
                    {item.icon}
                  </span>
                  {item.label}
                </span>
                <span
                  className={`font-mono text-sm font-semibold tabular-nums ${
                    item.valueTone === "success"
                      ? "text-success-soft"
                      : "text-foreground"
                  }`}
                >
                  {item.value}
                  {item.sub ? (
                    <span className="text-muted-foreground ml-2 text-xs font-normal">
                      {item.sub}
                    </span>
                  ) : null}
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>

        {/* Exchange rates — live data (same fetch, zero extra requests) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm font-medium">
              Tasas de Cambio
            </CardTitle>
            <CardDescription className="text-xs">
              Referencias para operaciones en divisas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="border-border-subtle flex min-h-11 items-center justify-between gap-3 rounded-lg border p-3">
              <span className="text-foreground flex items-center gap-2 text-sm">
                <span className="material-symbols-outlined text-muted-foreground text-lg">
                  attach_money
                </span>
                BCV Oficial
                {bcv.date ? (
                  <span className="text-muted-foreground text-xs">
                    {bcv.date}
                  </span>
                ) : null}
              </span>
              {bcv.isLoading ? (
                <Skeleton className="h-5 w-24" />
              ) : (
                <span className="text-foreground font-mono text-sm font-semibold tabular-nums">
                  {bcv.rate > 0 ? `Bs ${bcv.rate.toFixed(2)}` : "—"}
                </span>
              )}
            </div>
            <div className="border-border-subtle flex min-h-11 items-center justify-between gap-3 rounded-lg border p-3">
              <span className="text-foreground flex items-center gap-2 text-sm">
                <span className="material-symbols-outlined text-muted-foreground text-lg">
                  credit_card
                </span>
                Paralelo (USDT)
              </span>
              {bcv.isLoading ? (
                <Skeleton className="h-5 w-24" />
              ) : (
                <span className="text-foreground font-mono text-sm font-semibold tabular-nums">
                  {ves.paralelo.rate > 0
                    ? `Bs ${ves.paralelo.rate.toFixed(2)}`
                    : "—"}
                </span>
              )}
            </div>
            <div className="border-border-subtle flex min-h-11 items-center justify-between gap-3 rounded-lg border p-3">
              <span className="text-foreground flex items-center gap-2 text-sm">
                <span className="material-symbols-outlined text-muted-foreground text-lg">
                  trending_up
                </span>
                Brecha
              </span>
              {bcv.isLoading ? (
                <Skeleton className="h-5 w-16" />
              ) : (
                <span className="text-warning-soft font-mono text-sm font-semibold tabular-nums">
                  {ves.spread.percentage !== 0
                    ? `${ves.spread.percentage.toFixed(1)}%`
                    : "—"}
                </span>
              )}
            </div>
            <Link href="/alerts" className={rowClasses}>
              <span className="text-foreground flex items-center gap-2 text-sm">
                <span className="material-symbols-outlined text-muted-foreground text-lg">
                  notifications_active
                </span>
                Alertas Activas
              </span>
              <StatusBadge
                tone={(alertCount ?? 0) > 0 ? "destructive" : "success"}
                dot={false}
              >
                {alertCount ?? 0}
              </StatusBadge>
            </Link>
          </CardContent>
        </Card>

        {/* Cash Closures — full-width table */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm font-medium">
              Cierres de Caja Recientes
            </CardTitle>
            <CardAction>
              <Link
                href="/cash-closure"
                className="text-primary hover:text-primary/80 inline-flex items-center gap-1 text-sm font-medium transition-colors"
              >
                Ver todos
                <span className="material-symbols-outlined text-base">
                  arrow_forward
                </span>
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent>
            {closuresLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : closures && closures.length > 0 ? (
              <Table className="min-w-125">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-muted-foreground h-9 px-3 text-xs font-medium tracking-widest uppercase">
                      Fecha
                    </TableHead>
                    <TableHead className="text-muted-foreground h-9 px-3 text-right text-xs font-medium tracking-widest uppercase">
                      Ventas
                    </TableHead>
                    <TableHead className="text-muted-foreground h-9 px-3 text-right text-xs font-medium tracking-widest uppercase">
                      Efectivo
                    </TableHead>
                    <TableHead className="text-muted-foreground h-9 px-3 text-right text-xs font-medium tracking-widest uppercase">
                      Digital
                    </TableHead>
                    <TableHead className="text-muted-foreground h-9 px-3 text-right text-xs font-medium tracking-widest uppercase">
                      Discrepancia
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {closures.map((c) => {
                    const diff =
                      Number(c.actualTotal ?? 0) - Number(c.expectedTotal ?? 0);
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="text-foreground px-3 py-2.5 font-medium">
                          {new Date(c.closureDate).toLocaleDateString("es-VE")}
                        </TableCell>
                        <TableCell className="px-3 py-2.5 text-right font-mono tabular-nums">
                          ${Number(c.totalSales).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-success-soft px-3 py-2.5 text-right font-mono tabular-nums">
                          ${Number(c.totalCash).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-primary px-3 py-2.5 text-right font-mono tabular-nums">
                          ${Number(c.totalDigital).toFixed(2)}
                        </TableCell>
                        <TableCell
                          className={`px-3 py-2.5 text-right font-mono font-semibold tabular-nums ${
                            diff === 0
                              ? "text-success-soft"
                              : diff < 0
                                ? "text-destructive-soft"
                                : "text-warning-soft"
                          }`}
                        >
                          {diff >= 0 ? "+" : ""}
                          {diff.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <EmptyState
                icon="lock_clock"
                title="No hay cierres de caja registrados"
                description="Los cierres de caja recientes aparecerán aquí."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
