"use client";

import type { DragEndEvent } from "@dnd-kit/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { DashboardOverview } from "@cendaro/api";
import type { UiPreferences, WidgetId } from "@cendaro/validators";
import { Button } from "@cendaro/ui";
import { Icon } from "@cendaro/ui/icons";

import { useDashboardParams } from "~/hooks/params/use-dashboard-params";
import { DashboardControls } from "~/modules/dashboard/controls";
import { buildDashboardInsights } from "~/modules/dashboard/insights";
import { QuickActions } from "~/modules/dashboard/quick-actions";
import { SortableWidget } from "~/modules/dashboard/sortable-widget";
import { Welcome } from "~/modules/dashboard/welcome";
import { WidgetCardSkeleton } from "~/modules/dashboard/widget-card";
import {
  DEFAULT_WIDGET_ORDER,
  resolveAllowedWidgets,
  resolveWidgetOrder,
  toggleWidgetHidden,
} from "~/modules/dashboard/widget-order";
import { ContainersInTransitWidget } from "~/modules/dashboard/widgets/containers-in-transit-widget";
import { GrossProfitWidget } from "~/modules/dashboard/widgets/gross-profit-widget";
import { LastClosureWidget } from "~/modules/dashboard/widgets/last-closure-widget";
import { LowStockWidget } from "~/modules/dashboard/widgets/low-stock-widget";
import { PendingDispatchWidget } from "~/modules/dashboard/widgets/pending-dispatch-widget";
import { ReceivablesWidget } from "~/modules/dashboard/widgets/receivables-widget";
import { SalesWidget } from "~/modules/dashboard/widgets/sales-widget";
import { TopProductsWidget } from "~/modules/dashboard/widgets/top-products-widget";
import { useTRPC } from "~/trpc/client";

const MetricsView = dynamic(
  () => import("~/modules/dashboard/metrics-view").then((m) => m.MetricsView),
  {
    loading: () => (
      <div className="border-border bg-card text-muted-foreground animate-pulse border p-8 text-center text-sm">
        Cargando métricas analíticas...
      </div>
    ),
    ssr: false,
  },
);

function renderWidgetContent(
  id: WidgetId,
  overview: DashboardOverview,
  bcvRate: number,
) {
  switch (id) {
    case "sales":
      return <SalesWidget sales={overview.sales} bcvRate={bcvRate} />;
    case "grossProfit":
      return overview.grossProfit ? (
        <GrossProfitWidget
          grossProfit={overview.grossProfit}
          bcvRate={bcvRate}
        />
      ) : null;
    case "receivables":
      return overview.receivables ? (
        <ReceivablesWidget
          receivables={overview.receivables}
          bcvRate={bcvRate}
        />
      ) : null;
    case "lowStock":
      return <LowStockWidget lowStock={overview.lowStock} />;
    case "pendingDispatch":
      return (
        <PendingDispatchWidget pendingDispatch={overview.pendingDispatch} />
      );
    case "topProducts":
      return <TopProductsWidget topProducts={overview.topProducts} />;
    case "lastClosure":
      return <LastClosureWidget lastClosure={overview.lastClosure} />;
    case "containersInTransit":
      return (
        <ContainersInTransitWidget
          containersInTransit={overview.containersInTransit}
        />
      );
    default:
      return null;
  }
}

export default function DashboardClient() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [{ period, tab }] = useDashboardParams();
  const [isCustomizing, setIsCustomizing] = useState(false);

  // Exit customize mode if user switches to metrics tab
  useEffect(() => {
    if (tab !== "overview") {
      setIsCustomizing(false);
    }
  }, [tab]);

  const { data: overview, isLoading } = useQuery(
    trpc.dashboard.overview.queryOptions({ period }),
  );
  const uiPreferencesOptions = trpc.users.uiPreferences.queryOptions();
  const { data: uiPreferences } = useQuery(uiPreferencesOptions);

  const bcvRate = overview?.rate.bcv ?? 0;

  // Optimistic UI preferences mutation with automatic rollback on error
  const updatePreferences = useMutation(
    trpc.users.updateUiPreferences.mutationOptions({
      onMutate: async (newInput) => {
        await qc.cancelQueries({ queryKey: uiPreferencesOptions.queryKey });
        const previous = qc.getQueryData<UiPreferences>(
          uiPreferencesOptions.queryKey,
        );

        qc.setQueryData(uiPreferencesOptions.queryKey, (old) => {
          if (!newInput.dashboard) return old;
          return {
            ...(old ?? {}),
            dashboard: {
              order: newInput.dashboard.order,
              hidden: newInput.dashboard.hidden,
            },
          };
        });

        return { previous };
      },
      onError: (_err, _newInput, context) => {
        if (context?.previous !== undefined) {
          qc.setQueryData(uiPreferencesOptions.queryKey, context.previous);
        }
        toast.error("Error al guardar la personalización del dashboard");
      },
      onSettled: () => {
        void qc.invalidateQueries({
          queryKey: uiPreferencesOptions.queryKey,
        });
      },
    }),
  );

  const insights = useMemo(() => buildDashboardInsights(overview), [overview]);

  // Resolve sanitized full order and hidden set
  const fullOrder = useMemo(
    () => resolveWidgetOrder(uiPreferences?.dashboard?.order),
    [uiPreferences?.dashboard?.order],
  );

  const hidden = useMemo(
    () => new Set<WidgetId>(uiPreferences?.dashboard?.hidden ?? []),
    [uiPreferences?.dashboard?.hidden],
  );

  // Role-redacted allowed widgets (employee never sees grossProfit / receivables)
  const allowedOrder = useMemo(
    () =>
      resolveAllowedWidgets(
        fullOrder,
        Boolean(overview?.grossProfit),
        Boolean(overview?.receivables),
      ),
    [fullOrder, overview?.grossProfit, overview?.receivables],
  );

  // Widgets visible in regular view mode (not hidden and role-allowed)
  const visibleWidgets = useMemo(
    () => allowedOrder.filter((id) => !hidden.has(id)),
    [allowedOrder, hidden],
  );

  // In customize mode, show all role-allowed widgets (even if hidden, with visual cue)
  const widgetsToRender = isCustomizing ? allowedOrder : visibleWidgets;

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const activeId = active.id as WidgetId;
      const overId = over.id as WidgetId;

      const oldIndex = allowedOrder.indexOf(activeId);
      const newIndex = allowedOrder.indexOf(overId);
      if (oldIndex === -1 || newIndex === -1) return;

      const newAllowed = arrayMove(allowedOrder, oldIndex, newIndex);

      // Reconstruct fullOrder preserving any widgets not visible to current role
      const newFullOrder = [
        ...newAllowed,
        ...fullOrder.filter((id) => !newAllowed.includes(id)),
      ];

      updatePreferences.mutate({
        dashboard: {
          order: newFullOrder,
          hidden: Array.from(hidden),
        },
      });
    },
    [allowedOrder, fullOrder, hidden, updatePreferences],
  );

  const handleToggleVisibility = useCallback(
    (id: WidgetId) => {
      const nextHidden = toggleWidgetHidden(hidden, id);
      updatePreferences.mutate({
        dashboard: {
          order: fullOrder,
          hidden: nextHidden,
        },
      });
    },
    [fullOrder, hidden, updatePreferences],
  );

  const handleResetOrder = useCallback(() => {
    updatePreferences.mutate({
      dashboard: {
        order: DEFAULT_WIDGET_ORDER,
        hidden: [],
      },
    });
    toast.success("Orden y visibilidad restablecidos");
  }, [updatePreferences]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 space-y-6 py-4 duration-200 lg:py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <Welcome insights={insights} />
        <DashboardControls
          isCustomizing={isCustomizing}
          onToggleCustomize={() => setIsCustomizing((prev) => !prev)}
          disabled={isLoading || !overview}
        />
      </div>

      {tab === "overview" ? (
        <>
          {/* Customization mode helper banner */}
          {isCustomizing ? (
            <div className="border-line bg-surface animate-in fade-in text-muted-foreground flex flex-wrap items-center justify-between gap-3 border px-4 py-2.5 text-xs duration-150">
              <div className="flex items-center gap-2">
                <Icon name="Tune" className="text-foreground size-3.5" />
                <span>
                  <strong className="text-foreground font-medium">
                    Modo personalización activo:
                  </strong>{" "}
                  Arrastra desde el asa para reordenar o pulsa en el icono de
                  visibilidad para ocultar o mostrar widgets.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleResetOrder}
                  title="Restablecer orden y visibilidad por defecto"
                >
                  <Icon name="Refresh" className="mr-1.5 size-3" />
                  Restablecer
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setIsCustomizing(false)}
                >
                  Listo
                </Button>
              </div>
            </div>
          ) : null}

          {/* Widgets Grid */}
          {isLoading || !overview ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <WidgetCardSkeleton key={i} />
              ))}
            </div>
          ) : widgetsToRender.length === 0 ? (
            <div className="border-line bg-surface flex min-h-47.5 flex-col items-center justify-center gap-2 border p-8 text-center text-sm">
              <Icon
                name="VisibilityOff"
                className="text-muted-foreground size-6"
              />
              <p className="text-foreground font-medium">
                Todos los widgets están ocultos
              </p>
              <p className="text-muted-foreground text-xs">
                Pulsa en personalizar para seleccionar qué widgets deseas
                visualizar.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 text-xs"
                onClick={() => setIsCustomizing(true)}
              >
                <Icon name="DashboardCustomize" className="mr-1.5 size-3.5" />
                Personalizar widgets
              </Button>
            </div>
          ) : (
            <DndContext
              id="dashboard-widgets-dnd"
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={widgetsToRender}
                strategy={rectSortingStrategy}
              >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {widgetsToRender.map((id) => (
                    <SortableWidget
                      key={id}
                      id={id}
                      isCustomizing={isCustomizing}
                      isHidden={hidden.has(id)}
                      onToggleVisibility={handleToggleVisibility}
                    >
                      {renderWidgetContent(id, overview, bcvRate)}
                    </SortableWidget>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          <QuickActions />
        </>
      ) : (
        <MetricsView overview={overview} bcvRate={bcvRate} period={period} />
      )}
    </div>
  );
}
