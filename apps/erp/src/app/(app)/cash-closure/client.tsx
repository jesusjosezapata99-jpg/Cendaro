"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@cendaro/ui";
import { Icons } from "@cendaro/ui/icons";

import type { StatusTone } from "~/components/status-badge";
import { EmptyState } from "~/components/empty-state";
import { PageHeader } from "~/components/page-header";
import { RoleGuard } from "~/components/role-guard";
import { Skeleton } from "~/components/skeleton";
import { StatCard } from "~/components/stat-card";
import { StatusBadge } from "~/components/status-badge";
import { useBcvRate } from "~/hooks/use-bcv-rate";
import { formatDualCurrency } from "~/lib/format-currency";
import { useTRPC } from "~/trpc/client";

const CreateClosureDialog = dynamic(
  () =>
    import("~/components/forms/create-closure").then((m) => ({
      default: m.CreateClosureDialog,
    })),
  { ssr: false },
);

const STATUS_CONFIG: Record<
  string,
  { label: string; tone: StatusTone; icon: string }
> = {
  open: {
    label: "Abierta",
    tone: "warning",
    icon: "lock_open",
  },
  closed: {
    label: "Cerrada",
    tone: "primary",
    icon: "lock",
  },
  reviewed: {
    label: "Revisada",
    tone: "success",
    icon: "verified",
  },
};

const cellPx = "px-4 py-3";

export default function CashClosureClient() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const bcv = useBcvRate();

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);

  const { data: closures, isLoading } = useQuery(
    trpc.sales.listClosures.queryOptions(),
  );

  const review = useMutation(
    trpc.sales.reviewClosure.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: [["sales"]] });
        void qc.invalidateQueries({ queryKey: [["payments"]] });
        void qc.invalidateQueries({ queryKey: [["dashboard"]] });
      },
    }),
  );

  const items = useMemo(() => closures ?? [], [closures]);

  const latestClosure = items[0] ?? null;
  const todaySales = latestClosure?.totalSales ?? 0;
  const todayCash = latestClosure?.totalCash ?? 0;
  const todayDigital = latestClosure?.totalDigital ?? 0;
  const totalDiscrepancies = useMemo(
    () => items.reduce((s, c) => s + (c.discrepancy ?? 0), 0),
    [items],
  );

  const filteredItems = useMemo(() => {
    if (statusFilter === "all") return items;
    return items.filter((c) => c.status === statusFilter);
  }, [items, statusFilter]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 space-y-6 p-4 duration-200 lg:p-8">
      <PageHeader
        title="Cierre de Caja"
        description="Arqueo de fondos, conciliación diaria y control de discrepancias"
        actions={
          <RoleGuard allow={["owner", "admin", "supervisor", "employee"]}>
            <Button
              onClick={() => setShowCreate(true)}
              className="min-h-11 flex-1 sm:flex-initial"
            >
              <Icons.LockClock className="size-4.5" />
              Cerrar Día
            </Button>
          </RoleGuard>
        }
      />

      <CreateClosureDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <StatCard
          label="Ventas Último Cierre"
          value={isLoading ? "—" : formatDualCurrency(todaySales, bcv.rate).usd}
          sub={
            isLoading ? undefined : formatDualCurrency(todaySales, bcv.rate).bs
          }
          icon="Payments"
          tone="primary"
        />
        <StatCard
          label="Efectivo Físico"
          value={isLoading ? "—" : formatDualCurrency(todayCash, bcv.rate).usd}
          sub={
            isLoading ? undefined : formatDualCurrency(todayCash, bcv.rate).bs
          }
          icon="Payments"
          tone="success"
        />
        <StatCard
          label="Digital / Bancario"
          value={
            isLoading ? "—" : formatDualCurrency(todayDigital, bcv.rate).usd
          }
          sub={
            isLoading
              ? undefined
              : formatDualCurrency(todayDigital, bcv.rate).bs
          }
          icon="Contactless"
        />
        <StatCard
          label="Discrepancia Total"
          value={
            isLoading
              ? "—"
              : `${totalDiscrepancies >= 0 ? "+" : ""}${formatDualCurrency(totalDiscrepancies, bcv.rate).usd}`
          }
          sub={
            isLoading
              ? undefined
              : formatDualCurrency(Math.abs(totalDiscrepancies), bcv.rate).bs
          }
          icon={Math.abs(totalDiscrepancies) < 0.01 ? "CheckCircle" : "Warning"}
          tone={
            Math.abs(totalDiscrepancies) < 0.01
              ? "success"
              : totalDiscrepancies < 0
                ? "destructive"
                : "warning"
          }
        />
      </div>

      {/* Filter Chips */}
      <div className="mobile-scroll-x flex gap-2 pb-1">
        {[
          { id: "all", label: "Todos los Cierres" },
          { id: "open", label: "Abiertas" },
          { id: "closed", label: "Cerradas" },
          { id: "reviewed", label: "Revisadas" },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setStatusFilter(f.id)}
            className={`min-h-9 shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              statusFilter === f.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border-subtle text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* ── Mobile: Card View ─────────────────────── */}
      <div className="space-y-3 md:hidden">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="border-border-subtle surface-card rounded-xl border p-4"
              >
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="mt-2 h-4 w-24" />
              </div>
            ))
          : filteredItems.map((closure) => {
              const cfg = STATUS_CONFIG[closure.status] ?? {
                label: closure.status,
                tone: "neutral" as StatusTone,
                icon: "lock",
              };
              const discrepancy = closure.discrepancy ?? 0;
              return (
                <div
                  key={closure.id}
                  className="border-border-subtle surface-card rounded-xl border p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Icons.CalendarToday className="text-muted-foreground size-4.5" />
                      <span className="text-foreground font-mono text-sm font-medium tabular-nums">
                        {new Date(closure.closureDate).toLocaleDateString(
                          "es-VE",
                        )}
                      </span>
                    </div>
                    <StatusBadge tone={cfg.tone}>{cfg.label}</StatusBadge>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                        Ventas
                      </p>
                      <p className="text-foreground font-mono font-medium tabular-nums">
                        ${(closure.totalSales ?? 0).toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                        Efectivo
                      </p>
                      <p className="font-mono font-medium text-emerald-500 tabular-nums">
                        ${(closure.totalCash ?? 0).toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                        Digital
                      </p>
                      <p className="text-primary font-mono font-medium tabular-nums">
                        ${(closure.totalDigital ?? 0).toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                        Discrepancia
                      </p>
                      <p
                        className={`font-mono font-medium tabular-nums ${
                          Math.abs(discrepancy) < 0.01
                            ? "text-emerald-500"
                            : discrepancy < 0
                              ? "text-destructive"
                              : "text-amber-500"
                        }`}
                      >
                        {discrepancy >= 0 ? "+" : ""}${discrepancy.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <div className="border-border-subtle mt-3 flex items-center justify-between border-t pt-2 text-xs">
                    <span className="text-muted-foreground font-mono tabular-nums">
                      Esp: ${(closure.expectedTotal ?? 0).toFixed(2)} / Real: $
                      {(closure.actualTotal ?? 0).toFixed(2)}
                    </span>
                    {closure.status !== "reviewed" && (
                      <RoleGuard allow={["owner", "admin", "supervisor"]}>
                        <button
                          type="button"
                          disabled={review.isPending}
                          onClick={() => review.mutate({ id: closure.id })}
                          className="bg-primary text-primary-foreground hover:bg-primary/90 min-h-9 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
                        >
                          Aprobar
                        </button>
                      </RoleGuard>
                    )}
                  </div>
                </div>
              );
            })}

        {!isLoading && filteredItems.length === 0 && (
          <EmptyState
            icon="PointOfSale"
            title="No se encontraron cierres"
            description="Ajusta los filtros o registra un nuevo cierre de día."
          />
        )}
      </div>

      {/* ── Desktop: Table View ───────────────────── */}
      <div className="border-border-subtle surface-card hidden gap-0 overflow-hidden rounded-xl border py-0 md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-border-subtle border-b">
              <th
                className={`text-muted-foreground ${cellPx} text-xs font-medium tracking-widest uppercase`}
              >
                Fecha de Cierre
              </th>
              <th
                className={`text-muted-foreground ${cellPx} text-center text-xs font-medium tracking-widest uppercase`}
              >
                Estado
              </th>
              <th
                className={`text-muted-foreground ${cellPx} text-right text-xs font-medium tracking-widest uppercase`}
              >
                Ventas
              </th>
              <th
                className={`text-muted-foreground ${cellPx} text-right text-xs font-medium tracking-widest uppercase`}
              >
                Efectivo
              </th>
              <th
                className={`text-muted-foreground ${cellPx} text-right text-xs font-medium tracking-widest uppercase`}
              >
                Digital
              </th>
              <th
                className={`text-muted-foreground ${cellPx} text-right text-xs font-medium tracking-widest uppercase`}
              >
                Esperado
              </th>
              <th
                className={`text-muted-foreground ${cellPx} text-right text-xs font-medium tracking-widest uppercase`}
              >
                Real
              </th>
              <th
                className={`text-muted-foreground ${cellPx} text-right text-xs font-medium tracking-widest uppercase`}
              >
                Discrepancia
              </th>
              <th
                className={`text-muted-foreground ${cellPx} text-right text-xs font-medium tracking-widest uppercase`}
              >
                Acción
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-border-subtle border-b">
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} className={cellPx}>
                        <Skeleton className="h-5 w-16" />
                      </td>
                    ))}
                  </tr>
                ))
              : filteredItems.map((closure) => {
                  const cfg = STATUS_CONFIG[closure.status] ?? {
                    label: closure.status,
                    tone: "neutral" as StatusTone,
                    icon: "lock",
                  };
                  const discrepancy = closure.discrepancy ?? 0;
                  return (
                    <tr
                      key={closure.id}
                      className="border-border-subtle hover:bg-accent/50 border-b transition-colors"
                    >
                      <td className={cellPx}>
                        <div className="flex items-center gap-2">
                          <Icons.CalendarToday
                            className="text-muted-foreground size-4"
                            aria-hidden
                          />
                          <span className="text-foreground font-mono text-xs font-medium tabular-nums">
                            {new Date(closure.closureDate).toLocaleDateString(
                              "es-VE",
                            )}
                          </span>
                        </div>
                      </td>
                      <td className={`${cellPx} text-center`}>
                        <StatusBadge tone={cfg.tone}>{cfg.label}</StatusBadge>
                      </td>
                      <td
                        className={`text-foreground ${cellPx} text-right font-mono text-xs font-medium tabular-nums`}
                      >
                        ${(closure.totalSales ?? 0).toFixed(2)}
                      </td>
                      <td
                        className={`text-emerald-500 ${cellPx} text-right font-mono text-xs font-medium tabular-nums`}
                      >
                        ${(closure.totalCash ?? 0).toFixed(2)}
                      </td>
                      <td
                        className={`text-primary ${cellPx} text-right font-mono text-xs font-medium tabular-nums`}
                      >
                        ${(closure.totalDigital ?? 0).toFixed(2)}
                      </td>
                      <td
                        className={`text-muted-foreground ${cellPx} text-right font-mono text-xs tabular-nums`}
                      >
                        ${(closure.expectedTotal ?? 0).toFixed(2)}
                      </td>
                      <td
                        className={`text-foreground ${cellPx} text-right font-mono text-xs tabular-nums`}
                      >
                        ${(closure.actualTotal ?? 0).toFixed(2)}
                      </td>
                      <td
                        className={`${cellPx} text-right font-mono text-xs font-medium tabular-nums ${
                          Math.abs(discrepancy) < 0.01
                            ? "text-emerald-500"
                            : discrepancy < 0
                              ? "text-destructive"
                              : "text-amber-500"
                        }`}
                      >
                        {discrepancy >= 0 ? "+" : ""}${discrepancy.toFixed(2)}
                      </td>
                      <td className={`${cellPx} text-right`}>
                        {closure.status === "reviewed" ? (
                          <span className="font-mono text-xs text-emerald-500 tabular-nums">
                            Aprobado
                          </span>
                        ) : (
                          <RoleGuard allow={["owner", "admin", "supervisor"]}>
                            <button
                              type="button"
                              disabled={review.isPending}
                              onClick={() => review.mutate({ id: closure.id })}
                              className="border-border-subtle hover:border-primary hover:text-primary min-h-8 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50"
                            >
                              Aprobar
                            </button>
                          </RoleGuard>
                        )}
                      </td>
                    </tr>
                  );
                })}

            {!isLoading && filteredItems.length === 0 && (
              <tr className="hover:bg-transparent">
                <td colSpan={9} className="px-4 py-6">
                  <EmptyState
                    icon="PointOfSale"
                    title="No se encontraron cierres"
                    description="Ajusta los filtros o registra un nuevo cierre de día."
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
