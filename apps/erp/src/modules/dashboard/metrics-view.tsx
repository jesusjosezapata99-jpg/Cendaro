"use client";

import { useMemo } from "react";

import type { DashboardOverview } from "@cendaro/api";
import type { ChartConfig } from "@cendaro/ui";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  Line,
  LineChart,
  Skeleton,
  XAxis,
  YAxis,
} from "@cendaro/ui";
import { AnimatedNumber } from "@cendaro/ui/animated-number";

import type { DashboardPeriod } from "~/hooks/params/use-dashboard-params";
import { formatDualCurrency } from "~/lib/format-currency";

interface MetricsViewProps {
  overview?: DashboardOverview;
  bcvRate: number;
  period: DashboardPeriod;
}

const salesChartConfig = {
  total: {
    label: "Ventas",
    color: "var(--chart-bar-fill)",
  },
} satisfies ChartConfig;

const profitChartConfig = {
  total: {
    label: "Utilidad Bruta",
    color: "var(--chart-actual-line)",
  },
} satisfies ChartConfig;

function formatBucketLabel(date: Date, period: DashboardPeriod): string {
  if (isNaN(date.getTime())) return "";

  if (period === "12m") {
    return date.toLocaleDateString("es-VE", {
      month: "short",
      year: "2-digit",
    });
  }
  return date.toLocaleDateString("es-VE", {
    day: "numeric",
    month: "short",
  });
}

function formatYAxisCurrency(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}k`;
  }
  return `$${value.toFixed(0)}`;
}

function formatTooltipCurrency(value: number): string {
  return new Intl.NumberFormat("es-VE", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);
}

/**
 * Metrics view tab (PLAN-2026-09-DESIGN-SYSTEM §5.4, §5.8.2, §T3.5, M-27)
 * Renders 2 analytical charts over the overview series without new API calls:
 * - Sales: Bar chart with total volume, order count, and dual currency
 * - Gross Profit: Line chart with net margin and average cost disclaimer (role-gated)
 */
export function MetricsView({ overview, bcvRate, period }: MetricsViewProps) {
  const sales = overview?.sales;
  const grossProfit = overview?.grossProfit;

  const salesData = useMemo(() => {
    if (!sales?.series) return [];
    return sales.series.map((item) => {
      const d =
        item.bucket instanceof Date ? item.bucket : new Date(item.bucket);
      return {
        date: formatBucketLabel(d, period),
        fullDate: d.toLocaleDateString("es-VE", {
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
        total: item.total,
      };
    });
  }, [sales?.series, period]);

  const profitData = useMemo(() => {
    if (!grossProfit?.series) return [];
    return grossProfit.series.map((item) => {
      const d =
        item.bucket instanceof Date ? item.bucket : new Date(item.bucket);
      return {
        date: formatBucketLabel(d, period),
        fullDate: d.toLocaleDateString("es-VE", {
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
        total: item.total,
      };
    });
  }, [grossProfit?.series, period]);

  if (!overview || !sales) {
    return <MetricsSkeleton />;
  }

  const salesBs = formatDualCurrency(sales.total, bcvRate).bs;
  const netProfit = grossProfit ? grossProfit.revenue - grossProfit.cost : 0;
  const profitBs = grossProfit
    ? formatDualCurrency(netProfit, bcvRate).bs
    : null;

  return (
    <div
      className={
        grossProfit
          ? "grid grid-cols-1 gap-6 lg:grid-cols-2"
          : "grid grid-cols-1 gap-6"
      }
    >
      {/* ── Sales Chart Card ────────────────────────────────────── */}
      <div className="border-line bg-surface flex flex-col justify-between border p-6 transition-all duration-300">
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-foreground font-serif text-[18px] font-normal">
              Ventas en el período
            </h2>
            <span className="text-muted-foreground font-mono text-xs tabular-nums">
              {sales.orders} pedidos
            </span>
          </div>

          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-foreground font-mono text-2xl font-medium tabular-nums">
              <AnimatedNumber
                value={sales.total}
                format={{ style: "currency", currency: "USD" }}
              />
            </span>
            {salesBs ? (
              <span className="text-muted-foreground font-mono text-xs tabular-nums">
                ({salesBs})
              </span>
            ) : null}
          </div>
        </div>

        <div className="py-6">
          {salesData.length === 0 ? (
            <div className="text-muted-foreground flex h-64 items-center justify-center text-xs">
              No hay ventas registradas en este período.
            </div>
          ) : (
            <ChartContainer
              config={salesChartConfig}
              className="aspect-auto h-64 w-full md:h-72"
            >
              <BarChart
                data={salesData}
                margin={{ top: 12, right: 12, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  vertical={false}
                  stroke="var(--chart-grid-stroke)"
                  strokeDasharray="3 3"
                />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  stroke="none"
                  tick={{ fontSize: 10, fill: "var(--chart-axis-text)" }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  stroke="none"
                  tick={{ fontSize: 10, fill: "var(--chart-axis-text)" }}
                  tickFormatter={formatYAxisCurrency}
                  width={48}
                />
                <ChartTooltip
                  cursor={{ fill: "var(--chart-bar-fill-secondary)" }}
                  content={
                    <ChartTooltipContent
                      valueFormatter={(val: number) =>
                        formatTooltipCurrency(val)
                      }
                    />
                  }
                />
                <Bar
                  dataKey="total"
                  fill="var(--chart-bar-fill)"
                  radius={[2, 2, 0, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ChartContainer>
          )}
        </div>

        <div className="border-line text-muted-foreground flex items-center justify-between border-t pt-3 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-[2px] bg-(--chart-bar-fill)" />
            Total Facturado
          </span>
          <span className="font-mono tabular-nums">
            {sales.series.length}{" "}
            {sales.series.length === 1 ? "intervalo" : "intervalos"}
          </span>
        </div>
      </div>

      {/* ── Gross Profit Chart Card (Role-Gated) ────────────────── */}
      {grossProfit ? (
        <div className="border-line bg-surface flex flex-col justify-between border p-6 transition-all duration-300">
          <div>
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-foreground font-serif text-[18px] font-normal">
                Utilidad bruta estimada
              </h2>
              <span className="text-muted-foreground font-mono text-xs tabular-nums">
                {grossProfit.cost > 0
                  ? `Margen: ${(grossProfit.margin * 100).toFixed(1)}%`
                  : "Margen: Sin costo base"}
              </span>
            </div>

            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-foreground font-mono text-2xl font-medium tabular-nums">
                <AnimatedNumber
                  value={netProfit}
                  format={{ style: "currency", currency: "USD" }}
                />
              </span>
              {profitBs ? (
                <span className="text-muted-foreground font-mono text-xs tabular-nums">
                  ({profitBs})
                </span>
              ) : null}
            </div>
            <p className="text-muted-foreground mt-0.5 text-[11px]">
              Calculado sobre coste medio actual de productos
            </p>
          </div>

          <div className="py-6">
            {profitData.length === 0 ? (
              <div className="text-muted-foreground flex h-64 items-center justify-center text-xs">
                No hay registros de utilidad para este período.
              </div>
            ) : (
              <ChartContainer
                config={profitChartConfig}
                className="aspect-auto h-64 w-full md:h-72"
              >
                <LineChart
                  data={profitData}
                  margin={{ top: 12, right: 12, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    vertical={false}
                    stroke="var(--chart-grid-stroke)"
                    strokeDasharray="3 3"
                  />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    stroke="none"
                    tick={{ fontSize: 10, fill: "var(--chart-axis-text)" }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    stroke="none"
                    tick={{ fontSize: 10, fill: "var(--chart-axis-text)" }}
                    tickFormatter={formatYAxisCurrency}
                    width={48}
                  />
                  <ChartTooltip
                    cursor={{
                      stroke: "var(--chart-tooltip-cursor)",
                      strokeDasharray: "3 3",
                    }}
                    content={
                      <ChartTooltipContent
                        valueFormatter={(val: number) =>
                          formatTooltipCurrency(val)
                        }
                      />
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke="var(--chart-actual-line)"
                    strokeWidth={1.5}
                    dot={false}
                    activeDot={{
                      r: 4,
                      strokeWidth: 0,
                      fill: "var(--chart-actual-line)",
                    }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ChartContainer>
            )}
          </div>

          <div className="border-line text-muted-foreground flex items-center justify-between border-t pt-3 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-[2px] bg-(--chart-actual-line)" />
              Margen Neto
            </span>
            <span className="font-mono tabular-nums">
              Costo: {formatYAxisCurrency(grossProfit.cost)}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Loading skeleton with identical dimensions to prevent layout shifts (CLS 0) */
export function MetricsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {Array.from({ length: 2 }).map((_, i) => (
        <div
          key={i}
          className="border-line bg-surface flex flex-col justify-between border p-6"
        >
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-3 w-48" />
          </div>
          <div className="py-6">
            <Skeleton className="h-64 w-full md:h-72" />
          </div>
          <div className="border-line flex justify-between border-t pt-3">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}
