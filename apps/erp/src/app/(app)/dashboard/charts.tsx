"use client";

import type { ChartConfig } from "@cendaro/ui";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "@cendaro/ui";

/**
 * Executive dashboard charts — pure recharts, themed via --chart-* tokens.
 * Loaded with next/dynamic (ssr: false) so the chart bundle never blocks
 * LCP; the parent reserves the exact height (h-64) to keep CLS at zero.
 */

export interface ClosureSalesPoint {
  /** Short date label, e.g. "12 sep". */
  label: string;
  sales: number;
}

const salesConfig = {
  sales: { label: "Ventas", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function SalesPerClosureChart({ data }: { data: ClosureSalesPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
        Sin cierres todavía
      </div>
    );
  }

  return (
    <ChartContainer config={salesConfig} className="aspect-auto h-full w-full">
      <BarChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={16}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={56}
          tickFormatter={(v: number) =>
            `$${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`
          }
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              valueFormatter={(v) => `$${v.toFixed(2)}`}
              hideLabel
            />
          }
          cursor={{ fill: "var(--muted)", opacity: 0.5 }}
        />
        <Bar dataKey="sales" fill="var(--color-sales)" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

// ── Collections donut ───────────────────────────────────────────────────────

const collectionsConfig = {
  collected: { label: "Cobrado", color: "var(--chart-2)" },
  outstanding: { label: "Por Cobrar", color: "var(--chart-3)" },
} satisfies ChartConfig;

export interface CollectionsSlice {
  collected: number;
  outstanding: number;
}

export function CollectionsDonutChart({
  collected,
  outstanding,
}: CollectionsSlice) {
  const total = collected + outstanding;
  const hasData = total > 0;
  const pct = hasData ? Math.round((collected / total) * 100) : null;

  const data = hasData
    ? [
        { key: "collected", value: collected },
        { key: "outstanding", value: outstanding },
      ]
    : [{ key: "empty", value: 1 }];

  return (
    <div className="relative h-full w-full">
      <ChartContainer
        config={collectionsConfig}
        className="aspect-auto h-full w-full"
      >
        <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
          <ChartTooltip
            content={
              <ChartTooltipContent
                valueFormatter={(v) => `$${v.toFixed(2)}`}
                hideLabel
              />
            }
          />
          <Pie
            data={data}
            dataKey="value"
            nameKey="key"
            innerRadius="62%"
            outerRadius="88%"
            paddingAngle={hasData ? 3 : 0}
            strokeWidth={0}
          >
            {hasData ? (
              <>
                <Cell fill="var(--color-collected)" />
                <Cell fill="var(--color-outstanding)" />
              </>
            ) : (
              <Cell fill="var(--muted)" />
            )}
          </Pie>
        </PieChart>
      </ChartContainer>
      {/* Center readout — % collected */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        {hasData ? (
          <>
            <span className="text-foreground font-mono text-2xl font-semibold tabular-nums">
              {pct}%
            </span>
            <span className="text-muted-foreground text-xs">cobrado</span>
          </>
        ) : (
          <span className="text-muted-foreground text-xs">Sin movimientos</span>
        )}
      </div>
    </div>
  );
}
