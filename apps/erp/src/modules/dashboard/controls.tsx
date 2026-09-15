"use client";

import {
  Button,
  cn,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@cendaro/ui";
import { Icon } from "@cendaro/ui/icons";

import {
  DASHBOARD_PERIOD_LABELS,
  useDashboardParams,
} from "~/hooks/params/use-dashboard-params";

interface DashboardControlsProps {
  isCustomizing?: boolean;
  onToggleCustomize?: () => void;
  disabled?: boolean;
}

/**
 * Dashboard top-row controls (PLAN-2026-09-DESIGN-SYSTEM §5.8.2, §T3.4):
 * Icon button "Personalizar" (toggles edit/reorder mode with @dnd-kit),
 * period selector (7d/30d/90d/12m via nuqs), and segmented "Resumen | Métricas" tabs.
 */
export function DashboardControls({
  isCustomizing = false,
  onToggleCustomize,
  disabled = false,
}: DashboardControlsProps) {
  const [{ period, tab }, setParams] = useDashboardParams();

  const isOverview = tab === "overview";
  const canCustomize = isOverview && !disabled;

  return (
    <div className="flex shrink-0 items-center gap-2">
      <Button
        variant={isCustomizing ? "secondary" : "outline"}
        size="icon"
        className={cn(
          "size-8 transition-colors",
          isCustomizing && "border-foreground bg-nav-active text-foreground",
        )}
        onClick={onToggleCustomize}
        disabled={!canCustomize}
        title={
          !isOverview
            ? "Personalizar solo disponible en Resumen"
            : isCustomizing
              ? "Finalizar personalización"
              : "Personalizar widgets"
        }
        aria-label={
          isCustomizing ? "Finalizar personalización" : "Personalizar widgets"
        }
        aria-pressed={isCustomizing}
      >
        <Icon
          name="DashboardCustomize"
          className={cn(
            "size-4 transition-colors",
            isCustomizing ? "text-foreground" : "text-nav-label",
          )}
        />
      </Button>

      <Select
        value={period}
        onValueChange={(value) =>
          void setParams({ period: value as typeof period })
        }
      >
        <SelectTrigger size="sm" className="h-8 w-24 text-xs">
          <Icon name="Filter" className="size-3.5" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          {Object.entries(DASHBOARD_PERIOD_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value} className="text-xs">
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Tabs
        value={tab}
        onValueChange={(value) => void setParams({ tab: value as typeof tab })}
      >
        <TabsList className="h-8 border">
          <TabsTrigger value="overview" className="text-xs">
            Resumen
          </TabsTrigger>
          <TabsTrigger value="metrics" className="text-xs">
            Métricas
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}
