"use client";

import type { ChartConfig } from "@cendaro/ui";
import { Bar, BarChart, CartesianGrid, ChartContainer } from "@cendaro/ui";

/**
 * Dashboard widget sparkline (PLAN-2026-09-DESIGN-SYSTEM M-27, §5.8.2) — a
 * 48px-tall bar mini-chart shared by every widget card's figure area.
 * `isAnimationActive={false}` and axis-free per M-27: this is a glance-level
 * trend indicator inside a small card, not an analytical chart with its own
 * legend/tooltip/axes (those live in the "Métricas" tab, T3.5).
 */

export interface SparklinePoint {
  bucket: Date | string;
  total: number;
}

const sparklineConfig = {
  total: { label: "Total", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function WidgetSparkline({ data }: { data: SparklinePoint[] }) {
  if (data.length === 0) return null;

  return (
    <ChartContainer
      config={sparklineConfig}
      className="aspect-auto h-12 w-full"
    >
      <BarChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <Bar
          dataKey="total"
          fill="var(--color-total)"
          radius={[2, 2, 0, 0]}
          isAnimationActive={false}
          // Without a cap, a period with a single bucket renders as one bar
          // spanning the whole card, reading as a solid block rather than a chart.
          maxBarSize={40}
        />
      </BarChart>
    </ChartContainer>
  );
}
