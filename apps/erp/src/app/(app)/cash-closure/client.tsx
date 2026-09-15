"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@cendaro/ui";
import { Icons } from "@cendaro/ui/icons";
import { StatusPill } from "@cendaro/ui/status-pill";

import { DataTable } from "~/components/data-table/data-table";
import { EmptyState } from "~/components/empty-state";
import { PageHeader } from "~/components/page-header";
import { RoleGuard } from "~/components/role-guard";
import { StatCard } from "~/components/stat-card";
import { useClosureParams } from "~/hooks/params/use-closure-params";
import { useBcvRate } from "~/hooks/use-bcv-rate";
import { formatDualCurrency } from "~/lib/format-currency";
import { getStatus } from "~/lib/status";
import { useTRPC } from "~/trpc/client";

interface CashClosureItem {
  id: string;
  closureDate: Date | string;
  totalSales: number;
  totalCash: number;
  totalDigital: number;
  expectedTotal: number;
  actualTotal: number;
  discrepancy: number | null;
  status: string;
}

export default function CashClosureClient() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const bcv = useBcvRate();

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [, setClosureParams] = useClosureParams();

  const {
    data: closures,
    isLoading,
    isError,
    refetch,
  } = useQuery(trpc.sales.listClosures.queryOptions());

  const review = useMutation(
    trpc.sales.reviewClosure.mutationOptions({
      onMutate: async ({ id }) => {
        const listKey = trpc.sales.listClosures.queryKey();
        await qc.cancelQueries({ queryKey: listKey });
        const previous = qc.getQueryData(listKey);
        if (previous) {
          qc.setQueryData(
            listKey,
            previous.map((c) =>
              c.id === id ? { ...c, status: "reviewed" } : c,
            ),
          );
        }
        return { previous, listKey };
      },
      onError: (_error, _variables, context) => {
        if (context?.previous) {
          qc.setQueryData(context.listKey, context.previous);
        }
      },
      onSettled: () => {
        void qc.invalidateQueries({ queryKey: [["sales"]] });
        void qc.invalidateQueries({ queryKey: [["payments"]] });
        void qc.invalidateQueries({ queryKey: [["dashboard"]] });
      },
    }),
  );

  const items = useMemo(
    () => (closures ?? []) as unknown as CashClosureItem[],
    [closures],
  );

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

  const columns = useMemo<ColumnDef<CashClosureItem>[]>(
    () => [
      {
        accessorKey: "closureDate",
        header: "Fecha de Cierre",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Icons.CalendarToday
              className="text-muted-foreground size-4 shrink-0"
              aria-hidden
            />
            <span className="text-foreground font-mono text-xs font-medium tabular-nums">
              {new Date(row.original.closureDate).toLocaleDateString("es-VE")}
            </span>
          </div>
        ),
      },
      {
        id: "status",
        header: () => <div className="text-center">Estado</div>,
        cell: ({ row }) => {
          const { label, tone } = getStatus("cashClosure", row.original.status);
          return (
            <div className="text-center">
              <StatusPill tone={tone}>{label}</StatusPill>
            </div>
          );
        },
      },
      {
        accessorKey: "totalSales",
        header: () => <div className="text-right">Ventas</div>,
        cell: ({ row }) => (
          <div className="text-foreground text-right font-mono text-xs font-medium tabular-nums">
            ${row.original.totalSales.toFixed(2)}
          </div>
        ),
      },
      {
        accessorKey: "totalCash",
        header: () => <div className="text-right">Efectivo</div>,
        cell: ({ row }) => (
          <div className="text-right font-mono text-xs font-medium text-emerald-500 tabular-nums">
            ${row.original.totalCash.toFixed(2)}
          </div>
        ),
      },
      {
        accessorKey: "totalDigital",
        header: () => <div className="text-right">Digital</div>,
        cell: ({ row }) => (
          <div className="text-primary text-right font-mono text-xs font-medium tabular-nums">
            ${row.original.totalDigital.toFixed(2)}
          </div>
        ),
      },
      {
        accessorKey: "expectedTotal",
        header: () => <div className="text-right">Esperado</div>,
        cell: ({ row }) => (
          <div className="text-muted-foreground text-right font-mono text-xs tabular-nums">
            ${row.original.expectedTotal.toFixed(2)}
          </div>
        ),
      },
      {
        accessorKey: "actualTotal",
        header: () => <div className="text-right">Real</div>,
        cell: ({ row }) => (
          <div className="text-foreground text-right font-mono text-xs tabular-nums">
            ${row.original.actualTotal.toFixed(2)}
          </div>
        ),
      },
      {
        accessorKey: "discrepancy",
        header: () => <div className="text-right">Discrepancia</div>,
        cell: ({ row }) => {
          const discrepancy = row.original.discrepancy ?? 0;
          return (
            <div
              className={`text-right font-mono text-xs font-medium tabular-nums ${
                Math.abs(discrepancy) < 0.01
                  ? "text-emerald-500"
                  : discrepancy < 0
                    ? "text-destructive"
                    : "text-amber-500"
              }`}
            >
              {discrepancy >= 0 ? "+" : ""}${discrepancy.toFixed(2)}
            </div>
          );
        },
      },
      {
        id: "actions",
        header: () => <div className="text-right">Acción</div>,
        cell: ({ row }) => {
          const closure = row.original;
          if (closure.status === "reviewed") {
            return (
              <div className="text-right">
                <span className="font-mono text-xs text-emerald-500 tabular-nums">
                  Aprobado
                </span>
              </div>
            );
          }
          return (
            <div className="text-right">
              <RoleGuard allow={["owner", "admin", "supervisor"]}>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={review.isPending}
                  onClick={() => review.mutate({ id: closure.id })}
                  className="border-border h-7 px-2.5 text-xs font-medium"
                >
                  Aprobar
                </Button>
              </RoleGuard>
            </div>
          );
        },
      },
    ],
    [review],
  );

  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 space-y-6 py-4 duration-200 lg:py-8">
      <PageHeader
        title="Cierre de Caja"
        description="Arqueo de fondos, conciliación diaria y control de discrepancias"
        actions={
          <RoleGuard allow={["owner", "admin", "supervisor", "employee"]}>
            <Button
              onClick={() => void setClosureParams({ createClosure: true })}
              className="min-h-11 flex-1 sm:flex-initial"
            >
              <Icons.LockClock className="size-4.5" />
              Cerrar Día
            </Button>
          </RoleGuard>
        }
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
            className={`h-9 shrink-0 border px-3 text-xs font-medium transition-colors ${
              statusFilter === f.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* ── Mobile: Card View ─────────────────────── */}
      <div className="space-y-3 md:hidden">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="border-border bg-card animate-pulse border p-4"
            >
              <div className="bg-muted h-5 w-3/4" />
              <div className="bg-muted mt-2 h-4 w-24" />
            </div>
          ))
        ) : filteredItems.length === 0 ? (
          <div className="border-border bg-card border p-8">
            <EmptyState
              icon="PointOfSale"
              title="No se encontraron cierres"
              description="Ajusta los filtros o registra un nuevo cierre de día."
            />
          </div>
        ) : (
          filteredItems.map((closure) => {
            const { label, tone } = getStatus("cashClosure", closure.status);
            const discrepancy = closure.discrepancy ?? 0;
            return (
              <div
                key={closure.id}
                className="border-border bg-card border p-4"
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
                  <StatusPill tone={tone}>{label}</StatusPill>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                      Ventas
                    </p>
                    <p className="text-foreground font-mono font-medium tabular-nums">
                      ${closure.totalSales.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                      Efectivo
                    </p>
                    <p className="font-mono font-medium text-emerald-500 tabular-nums">
                      ${closure.totalCash.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                      Digital
                    </p>
                    <p className="text-primary font-mono font-medium tabular-nums">
                      ${closure.totalDigital.toFixed(2)}
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

                <div className="border-border mt-3 flex items-center justify-between border-t pt-2 text-xs">
                  <span className="text-muted-foreground font-mono tabular-nums">
                    Esp: ${closure.expectedTotal.toFixed(2)} / Real: $
                    {closure.actualTotal.toFixed(2)}
                  </span>
                  {closure.status !== "reviewed" && (
                    <RoleGuard allow={["owner", "admin", "supervisor"]}>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={review.isPending}
                        onClick={() => review.mutate({ id: closure.id })}
                        className="border-border h-7 px-2.5 text-xs font-medium"
                      >
                        Aprobar
                      </Button>
                    </RoleGuard>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Desktop: Table View ───────────────────── */}
      <div className="hidden md:block">
        <DataTable
          columns={columns}
          data={filteredItems}
          isLoading={isLoading}
          isError={isError}
          onRetry={() => void refetch()}
          onResetFilters={
            statusFilter !== "all" ? () => setStatusFilter("all") : undefined
          }
          emptyTitle="No se encontraron cierres"
          emptyDescription="Ajusta los filtros o registra un nuevo cierre de día."
        />
      </div>
    </div>
  );
}
