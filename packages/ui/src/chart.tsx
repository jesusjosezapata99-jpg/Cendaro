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

interface ChartTooltipContentProps extends Omit<
  React.ComponentProps<"div">,
  "content"
> {
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
  // Recharts internal props passed when rendering custom tooltip content:
  accessibilityLayer?: boolean;
  allowEscapeViewBox?: boolean | { x?: boolean; y?: boolean };
  animationDuration?: number;
  animationEasing?: string;
  axisId?: string | number;
  content?: unknown;
  contentStyle?: React.CSSProperties;
  coordinate?: { x?: number; y?: number };
  cursor?: unknown;
  defaultIndex?: number;
  filterNull?: boolean;
  formatter?: unknown;
  includeHidden?: boolean;
  isAnimationActive?: boolean | "auto";
  itemSorter?: unknown;
  itemStyle?: React.CSSProperties;
  labelStyle?: React.CSSProperties;
  offset?: number | { x?: number; y?: number };
  payloadUniqBy?: unknown;
  portal?: HTMLElement | null;
  position?: { x?: number; y?: number };
  reverseDirection?: boolean | { x?: boolean; y?: boolean };
  separator?: string;
  shared?: boolean;
  trigger?: "hover" | "click";
  useTranslate3d?: boolean;
  viewBox?: unknown;
  wrapperStyle?: React.CSSProperties;
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
    // Filter Recharts internal props so they do NOT leak to the native DOM element in React 19
    accessibilityLayer: _accessibilityLayer,
    allowEscapeViewBox: _allowEscapeViewBox,
    animationDuration: _animationDuration,
    animationEasing: _animationEasing,
    axisId: _axisId,
    content: _content,
    contentStyle: _contentStyle,
    coordinate: _coordinate,
    cursor: _cursor,
    defaultIndex: _defaultIndex,
    filterNull: _filterNull,
    formatter: _formatter,
    includeHidden: _includeHidden,
    isAnimationActive: _isAnimationActive,
    itemSorter: _itemSorter,
    itemStyle: _itemStyle,
    labelStyle: _labelStyle,
    offset: _offset,
    payloadUniqBy: _payloadUniqBy,
    portal: _portal,
    position: _position,
    reverseDirection: _reverseDirection,
    separator: _separator,
    shared: _shared,
    trigger: _trigger,
    useTranslate3d: _useTranslate3d,
    viewBox: _viewBox,
    wrapperStyle: _wrapperStyle,
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
        "bg-background text-popover-foreground min-w-32 space-y-1.5 border p-2 text-[10px]",
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
              <span className="text-foreground font-mono font-medium tabular-nums">
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

interface ChartLegendContentProps extends Omit<
  React.ComponentProps<"div">,
  "content"
> {
  payload?: {
    dataKey?: string | number;
    value?: string | number;
    color?: string;
  }[];
  /** Hide the colored indicator square. */
  hideIcon?: boolean;
  /** Format series names. */
  nameFormatter?: (name: string) => React.ReactNode;
  align?: "left" | "center" | "right";
  chartHeight?: number;
  chartWidth?: number;
  content?: unknown;
  height?: number | string;
  iconSize?: number;
  iconType?: string;
  inactiveColor?: string;
  itemSorter?: unknown;
  layout?: "horizontal" | "vertical" | "auto";
  margin?: unknown;
  onBBoxUpdate?: unknown;
  payloadUniqBy?: unknown;
  portal?: HTMLElement | null;
  position?: unknown;
  verticalAlign?: "top" | "middle" | "bottom";
  width?: number | string;
  wrapperStyle?: React.CSSProperties;
}

const ChartLegendContent = React.forwardRef<
  HTMLDivElement,
  ChartLegendContentProps
>(function ChartLegendContent(
  {
    className,
    payload,
    hideIcon = false,
    nameFormatter,
    align: _align,
    chartHeight: _chartHeight,
    chartWidth: _chartWidth,
    content: _content,
    height: _height,
    iconSize: _iconSize,
    iconType: _iconType,
    inactiveColor: _inactiveColor,
    itemSorter: _itemSorter,
    layout: _layout,
    margin: _margin,
    onBBoxUpdate: _onBBoxUpdate,
    payloadUniqBy: _payloadUniqBy,
    portal: _portal,
    position: _position,
    verticalAlign: _verticalAlign,
    width: _width,
    wrapperStyle: _wrapperStyle,
    ...props
  },
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
