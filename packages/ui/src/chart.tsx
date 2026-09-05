"use client";

import * as React from "react";
import { Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";

import { cn } from "@cendaro/ui";

// Format: { THEME_NAME: CSS_SELECTOR }
const THEMES = { light: "", dark: ".dark" } as const;

export type ChartConfig = Record<
  string,
  {
    label?: React.ReactNode;
    icon?: React.ComponentType;
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<keyof typeof THEMES, string> }
  )
>;

interface ChartContextProps {
  config: ChartConfig;
}

const ChartContext = React.createContext<ChartContextProps | null>(null);

function useChart() {
  const context = React.useContext(ChartContext);
  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />");
  }
  return context;
}

function ChartContainer({
  id,
  className,
  children,
  config,
  ...props
}: React.ComponentProps<"div"> & {
  config: ChartConfig;
  children: React.ComponentProps<typeof ResponsiveContainer>["children"];
}) {
  const uniqueId = React.useId();
  const chartId = `chart-${id ?? uniqueId.replace(/:/g, "")}`;

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-slot="chart"
        data-chart={chartId}
        className={cn(
          "[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted/60 [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border flex aspect-video justify-center text-xs [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-none [&_.recharts-sector]:outline-none [&_.recharts-surface]:outline-none",
          className,
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <ResponsiveContainer>{children}</ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
  const colorConfig = Object.entries(config).filter(
    ([, itemConfig]) => itemConfig.theme ?? itemConfig.color,
  );

  if (colorConfig.length === 0) {
    return null;
  }

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `[data-chart=${id}] {\n${Object.entries(THEMES)
          .map(
            ([theme, selector]) =>
              `${selector} [data-chart=${id}] {\n${colorConfig
                .map(([key, itemConfig]) => {
                  const color =
                    itemConfig.theme?.[theme as keyof typeof THEMES] ??
                    itemConfig.color;
                  return color ? `  --color-${key}: ${color};` : null;
                })
                .filter(Boolean)
                .join("\n")}\n}`,
          )
          .join("\n")}\n}`,
      }}
    />
  );
};

// ── Tooltip ────────────────────────────────────────────────────────────────
// Payload/label props are typed locally (recharts v3 reshuffled its public
// tooltip types) — the runtime contract is stable: `active`, `payload`,
// `label` and the view-unit fields.

interface TooltipPayloadItem {
  dataKey?: string | number;
  name?: string | number;
  value?: number | string | (number | string)[];
  color?: string;
  payload?: Record<string, unknown>;
}

interface ChartTooltipContentProps extends React.ComponentProps<"div"> {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: unknown;
  /** Format the numeric value (defaults to raw value). */
  valueFormatter?: (value: number, name: string) => string;
  /** Hide the colored indicator square. */
  hideIndicator?: boolean;
  /** Hide the label row. */
  hideLabel?: boolean;
  labelFormatter?: (label: unknown) => React.ReactNode;
}

const ChartTooltipContent = React.forwardRef<
  HTMLDivElement,
  ChartTooltipContentProps
>(function ChartTooltipContent(
  {
    active,
    payload,
    className,
    label,
    hideLabel = false,
    hideIndicator = false,
    valueFormatter,
    labelFormatter,
    ...props
  },
  ref,
) {
  const { config } = useChart();

  const tooltipLabel = React.useMemo(() => {
    if (hideLabel || !payload?.length) {
      return null;
    }
    const formatted = labelFormatter?.(label) ?? String(label);
    return <div className="text-foreground font-medium">{formatted}</div>;
  }, [label, labelFormatter, hideLabel, payload?.length]);

  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div
      ref={ref}
      className={cn(
        "glass-overlay border-border-subtle text-popover-foreground min-w-32 space-y-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-md",
        className,
      )}
      {...props}
    >
      {tooltipLabel}
      <div className="grid gap-1.5">
        {payload.map((item, index) => {
          const key = String(item.dataKey ?? item.name ?? index);
          const itemConfig = config[key];
          const rawValue = Array.isArray(item.value)
            ? item.value[item.value.length - 1]
            : item.value;
          const numeric =
            typeof rawValue === "number"
              ? rawValue
              : typeof rawValue === "string"
                ? Number(rawValue)
                : 0;
          const formatted = valueFormatter?.(numeric, key) ?? String(rawValue);
          const indicatorColor = item.color ?? `var(--color-${key})`;

          return (
            <div
              key={`${key}-${index}`}
              className="flex w-full items-center justify-between gap-3 leading-none"
            >
              <div className="flex items-center gap-1.5">
                {!hideIndicator && (
                  <span
                    className="size-2 shrink-0 rounded-[2px]"
                    style={{
                      background: indicatorColor,
                    }}
                  />
                )}
                <span className="text-muted-foreground">
                  {itemConfig?.label ?? item.name ?? key}
                </span>
              </div>
              <span className="text-foreground font-mono font-semibold tabular-nums">
                {formatted}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
});

// ── Legend ─────────────────────────────────────────────────────────────────

interface ChartLegendContentProps extends React.ComponentProps<"div"> {
  payload?: {
    dataKey?: string | number;
    value?: string | number;
    color?: string;
  }[];
  /** Hide the colored indicator square. */
  hideIcon?: boolean;
  /** Format series names. */
  nameFormatter?: (name: string) => React.ReactNode;
}

const ChartLegendContent = React.forwardRef<
  HTMLDivElement,
  ChartLegendContentProps
>(function ChartLegendContent(
  { className, payload, hideIcon = false, nameFormatter, ...props },
  ref,
) {
  const { config } = useChart();

  if (!payload?.length) {
    return null;
  }

  return (
    <div
      ref={ref}
      className={cn(
        "flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5",
        className,
      )}
      {...props}
    >
      {payload.map((item, index) => {
        const key = String(item.dataKey ?? item.value ?? index);
        const itemConfig = config[key];
        return (
          <div
            key={`${key}-${index}`}
            className="text-muted-foreground flex items-center gap-1.5 text-xs"
          >
            {!hideIcon && (
              <span
                className="size-2 shrink-0 rounded-[2px]"
                style={{ background: item.color ?? `var(--color-${key})` }}
              />
            )}
            <span>
              {nameFormatter?.(String(item.value ?? key)) ??
                itemConfig?.label ??
                item.value}
            </span>
          </div>
        );
      })}
    </div>
  );
});

/** Re-exported recharts Tooltip pre-bound to the shadcn content component. */
const ChartTooltip = RechartsTooltip;

export {
  ChartContainer,
  ChartStyle,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegendContent,
  useChart,
};
