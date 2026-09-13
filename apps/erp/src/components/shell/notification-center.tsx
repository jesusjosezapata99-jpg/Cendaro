"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { IconName } from "@cendaro/ui/icons";
import { Button, cn } from "@cendaro/ui";
import { Icon, Icons } from "@cendaro/ui/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@cendaro/ui/popover";

import { useTRPC } from "~/trpc/client";

/* ─── Type config (mirrored from the alerts page / legacy dropdown) ─── */
const TYPE_CONFIG: Record<string, { label: string; icon: IconName }> = {
  low_stock: { label: "Stock Bajo", icon: "Inventory2" },
  inventory_diff: { label: "Dif. Inventario", icon: "Balance" },
  product_blocked: { label: "Producto Bloqueado", icon: "Block" },
  rate_change: { label: "Cambio Tasa", icon: "TrendingUp" },
  vendor_under_target: { label: "Vendedor Bajo Meta", icon: "TrendingDown" },
  order_late: { label: "Pedido Atrasado", icon: "Schedule" },
  ml_failure: { label: "Falla ML", icon: "ErrorOutline" },
  ar_overdue: { label: "CxC Vencida", icon: "CreditCardOff" },
};

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "Hace un momento";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Hace ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Hace ${days}d`;
}

function CenterSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3">
          <div className="bg-muted size-8 animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="bg-muted h-3 w-3/4 animate-pulse" />
            <div className="bg-muted h-2.5 w-1/2 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Notification center — PLAN-2026-09-MIDDAY-REDESIGN §5.8.1, M-25 (T2.6).
 * Replaces `notifications-dropdown.tsx` with the spec'd Popover
 * (`h-[535px] w-screen md:w-100 p-0`, `align="end" sideOffset={10}`).
 *
 * The trigger's `activeAlertCount` query is deferred 500ms after mount
 * (Midday's `ConnectionStatus` pattern) so it doesn't join the page's
 * initial request batch.
 */
export function NotificationCenter() {
  const trpc = useTRPC();
  const router = useRouter();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [countQueryReady, setCountQueryReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setCountQueryReady(true), 500);
    return () => clearTimeout(t);
  }, []);

  const { data: activeCount = 0 } = useQuery(
    trpc.dashboard.activeAlertCount.queryOptions(undefined, {
      staleTime: 30_000,
      refetchInterval: 60_000,
      enabled: countQueryReady,
    }),
  );

  const listAlertsOptions = trpc.dashboard.listAlerts.queryOptions(
    { limit: 20, dismissed: false },
    { staleTime: 30_000, enabled: open },
  );
  const { data: alerts = [], isLoading } = useQuery(listAlertsOptions);

  const dismiss = useMutation(
    trpc.dashboard.dismissAlert.mutationOptions({
      onMutate: async (input) => {
        await qc.cancelQueries({ queryKey: listAlertsOptions.queryKey });
        const previous = qc.getQueryData(listAlertsOptions.queryKey);
        qc.setQueryData(listAlertsOptions.queryKey, (old) =>
          old?.filter((a) => a.id !== input.id),
        );
        return { previous };
      },
      onError: (_err, _input, ctx) => {
        if (ctx?.previous) {
          qc.setQueryData(listAlertsOptions.queryKey, ctx.previous);
        }
      },
      onSettled: () => {
        void qc.invalidateQueries({ queryKey: [["dashboard"]] });
      },
    }),
  );

  const dismissAllByType = useMutation(
    trpc.dashboard.dismissAllByType.mutationOptions(),
  );

  const handleDismissAll = async () => {
    const previous = qc.getQueryData(listAlertsOptions.queryKey);
    const types = [...new Set(alerts.map((a) => a.alertType))];
    qc.setQueryData(listAlertsOptions.queryKey, []);
    try {
      await Promise.all(
        types.map((alertType) => dismissAllByType.mutateAsync({ alertType })),
      );
    } catch {
      qc.setQueryData(listAlertsOptions.queryKey, previous);
    } finally {
      void qc.invalidateQueries({ queryKey: [["dashboard"]] });
    }
  };

  const handleViewAll = () => {
    setOpen(false);
    router.push("/alerts");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="relative size-8 rounded-full p-0"
          aria-label="Notificaciones"
        >
          <Icons.Notifications className="size-4" />
          {activeCount > 0 && (
            <span
              aria-hidden
              className="bg-notification-dot absolute top-0 right-0 size-1.5 rounded-full"
            />
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={10}
        className="flex h-[535px] w-screen flex-col p-0 md:w-100"
      >
        <div className="border-border flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Activas</span>
            {activeCount > 0 && (
              <span className="bg-status-warning-bg text-status-warning-fg px-1.5 py-0.5 text-[10px] font-medium">
                {activeCount}
              </span>
            )}
          </div>
          {alerts.length > 0 && (
            <button
              onClick={() => void handleDismissAll()}
              className="text-muted-foreground hover:text-foreground text-xs transition-colors"
            >
              Descartar todas
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain">
          {isLoading ? (
            <CenterSkeleton />
          ) : alerts.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-4 py-8">
              <Icons.NotificationsOff className="text-muted-foreground size-6" />
              <div className="text-center">
                <p className="text-foreground text-sm font-medium">
                  No hay alertas activas
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  Todo está en orden. Te notificaremos cuando ocurra algo.
                </p>
              </div>
            </div>
          ) : (
            alerts.map((alert) => {
              const typeCfg = TYPE_CONFIG[alert.alertType] ?? {
                label: alert.alertType,
                icon: "Info" as const,
              };
              return (
                <div
                  key={alert.id}
                  className="border-border hover:bg-accent/30 border-b px-4 py-3 transition-colors last:border-b-0"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-2.5">
                      <Icon
                        name={typeCfg.icon}
                        className="text-muted-foreground mt-0.5 size-4 shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-foreground truncate text-xs font-medium">
                          {alert.title}
                        </p>
                        <p className="text-muted-foreground mt-0.5 line-clamp-2 text-[11px]">
                          {alert.message}
                        </p>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-muted-foreground/70 text-[10px]">
                            {timeAgo(new Date(alert.createdAt))}
                          </span>
                          <span className="bg-secondary text-muted-foreground px-1.5 py-0.5 text-[9px] font-medium">
                            {typeCfg.label}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        dismiss.mutate({ id: alert.id });
                      }}
                      disabled={dismiss.isPending}
                      className="text-muted-foreground hover:bg-secondary hover:text-foreground flex shrink-0 items-center justify-center p-1 text-xs transition-colors disabled:opacity-50"
                      aria-label="Descartar alerta"
                      title="Descartar"
                    >
                      <Icons.Close className="size-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="border-border border-t">
          <button
            onClick={handleViewAll}
            className={cn(
              "text-primary hover:bg-accent/50 flex min-h-11 w-full items-center justify-center gap-2",
              "px-4 py-2.5 text-xs font-medium transition-colors",
            )}
          >
            <Icons.OpenInNew className="size-3.5" />
            Ver todas
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
