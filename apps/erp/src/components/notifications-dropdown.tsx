"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { cn } from "@cendaro/ui";

import { useTRPC } from "~/trpc/client";

/* ─── Type Config (mirrored from alerts page) ─────────── */
const TYPE_CONFIG: Record<string, { label: string; icon: string }> = {
  low_stock: { label: "Stock Bajo", icon: "inventory_2" },
  inventory_diff: { label: "Dif. Inventario", icon: "balance" },
  product_blocked: { label: "Producto Bloqueado", icon: "block" },
  rate_change: { label: "Cambio Tasa", icon: "trending_up" },
  vendor_under_target: { label: "Vendedor Bajo Meta", icon: "trending_down" },
  order_late: { label: "Pedido Atrasado", icon: "schedule" },
  ml_failure: { label: "Falla ML", icon: "error_outline" },
  ar_overdue: { label: "CxC Vencida", icon: "credit_card_off" },
};

const SEVERITY_COLORS: Record<string, string> = {
  high: "border-l-red-500",
  medium: "border-l-amber-500",
  low: "border-l-blue-500",
  info: "border-l-cyan-500",
};

/* ─── Relative time helper ────────────────────────────── */
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

/* ─── Skeleton ────────────────────────────────────────── */
function DropdownSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3">
          <div className="bg-muted size-8 animate-pulse rounded-lg" />
          <div className="flex-1 space-y-2">
            <div className="bg-muted h-3 w-3/4 animate-pulse rounded" />
            <div className="bg-muted h-2.5 w-1/2 animate-pulse rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Component ───────────────────────────────────────── */
export function NotificationsDropdown() {
  const trpc = useTRPC();
  const router = useRouter();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── tRPC queries ──
  const { data: activeCount = 0 } = useQuery(
    trpc.dashboard.activeAlertCount.queryOptions(undefined, {
      staleTime: 30_000, // 30s — alerts are time-sensitive
      refetchInterval: 60_000, // poll every 60s
    }),
  );

  const {
    data: recentAlerts,
    isLoading,
    refetch,
  } = useQuery({
    ...trpc.dashboard.listAlerts.queryOptions(
      { limit: 5, dismissed: false },
      { staleTime: 30_000 },
    ),
    enabled: open, // only fetch when dropdown is open
  });

  const dismiss = useMutation(
    trpc.dashboard.dismissAlert.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: [["dashboard"]] });
      },
    }),
  );

  // ── Outside click ──
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // ── Escape key ──
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const handleToggle = () => {
    setOpen((prev) => {
      const next = !prev;
      if (next) void refetch();
      return next;
    });
  };

  const handleNav = () => {
    setOpen(false);
    router.push("/alerts");
  };

  const alerts = recentAlerts ?? [];

  return (
    <div className="relative" ref={containerRef}>
      {/* ── Bell button (44px touch target) ── */}
      <button
        onClick={handleToggle}
        className={cn(
          "text-muted-foreground hover:bg-accent hover:text-foreground relative flex size-11 items-center justify-center rounded-lg transition-colors",
          open && "bg-accent text-foreground",
        )}
        aria-label="Notificaciones"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <span className="material-symbols-outlined text-xl">notifications</span>

        {/* Badge */}
        {activeCount > 0 && (
          <span className="bg-destructive ring-card absolute top-1 right-1 flex size-[18px] items-center justify-center rounded-full text-[10px] font-bold text-white ring-2">
            {activeCount > 9 ? "9+" : activeCount}
          </span>
        )}
      </button>

      {/* ── Dropdown panel ── */}
      {open && (
        <div className="border-border bg-card absolute top-full right-0 z-50 mt-1 w-80 overflow-hidden rounded-xl border shadow-xl sm:w-96">
          {/* Header */}
          <div className="border-border flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-foreground text-lg">
                notifications
              </span>
              <h3 className="text-foreground text-sm font-bold">
                Notificaciones
              </h3>
              {activeCount > 0 && (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600 dark:bg-red-500/20 dark:text-red-400">
                  {activeCount}
                </span>
              )}
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground flex size-7 items-center justify-center rounded-md transition-colors"
              aria-label="Cerrar notificaciones"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>

          {/* Content */}
          {isLoading ? (
            <DropdownSkeleton />
          ) : alerts.length === 0 ? (
            /* ── Empty state ── */
            <div className="flex flex-col items-center gap-3 px-4 py-8">
              <div className="bg-secondary flex size-12 items-center justify-center rounded-full">
                <span className="material-symbols-outlined text-muted-foreground text-2xl">
                  notifications_off
                </span>
              </div>
              <div className="text-center">
                <p className="text-foreground text-sm font-semibold">
                  No hay alertas activas
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  Todo está en orden. Te notificaremos cuando ocurra algo.
                </p>
              </div>
              <button
                onClick={handleNav}
                className="bg-primary text-primary-foreground hover:bg-primary/90 mt-1 rounded-lg px-4 py-2 text-xs font-bold transition-colors"
              >
                Ver todas las alertas
              </button>
            </div>
          ) : (
            /* ── Alert list ── */
            <div className="max-h-[360px] overflow-y-auto">
              {alerts.map((alert) => {
                const typeCfg = TYPE_CONFIG[alert.alertType] ?? {
                  label: alert.alertType,
                  icon: "info",
                };
                const borderColor =
                  SEVERITY_COLORS[alert.severity] ?? "border-l-border";

                return (
                  <div
                    key={alert.id}
                    className={`border-border hover:bg-accent/30 border-b border-l-4 ${borderColor} px-4 py-3 transition-colors last:border-b-0`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-2.5">
                        <span className="material-symbols-outlined text-muted-foreground mt-0.5 shrink-0 text-base">
                          {typeCfg.icon}
                        </span>
                        <div className="min-w-0">
                          <p className="text-foreground truncate text-xs font-semibold">
                            {alert.title}
                          </p>
                          <p className="text-muted-foreground mt-0.5 line-clamp-2 text-[11px]">
                            {alert.message}
                          </p>
                          <div className="mt-1 flex items-center gap-2">
                            <span className="text-muted-foreground/70 text-[10px]">
                              {timeAgo(new Date(alert.createdAt))}
                            </span>
                            <span className="bg-secondary text-muted-foreground rounded px-1.5 py-0.5 text-[9px] font-bold">
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
                        className="text-muted-foreground hover:bg-secondary hover:text-foreground flex shrink-0 items-center justify-center rounded-md p-1 text-xs transition-colors disabled:opacity-50"
                        aria-label="Descartar alerta"
                        title="Descartar"
                      >
                        <span className="material-symbols-outlined text-sm">
                          close
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer — always visible */}
          <div className="border-border border-t">
            <button
              onClick={handleNav}
              className="text-primary hover:bg-accent/50 flex min-h-[44px] w-full items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold transition-colors"
            >
              <span className="material-symbols-outlined text-sm">
                open_in_new
              </span>
              Ver todas las alertas
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
