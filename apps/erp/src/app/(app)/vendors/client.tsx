"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@cendaro/ui";
import { Icons } from "@cendaro/ui/icons";

import { EmptyState } from "~/components/empty-state";
import { PageHeader } from "~/components/page-header";
import { Skeleton } from "~/components/skeleton";
import { StatCard } from "~/components/stat-card";
import { StatusBadge } from "~/components/status-badge";
import { useBcvRate } from "~/hooks/use-bcv-rate";
import { formatDualCurrency } from "~/lib/format-currency";
import { useTRPC } from "~/trpc/client";

type FilterMode = "all" | "pending" | "paid";

const FILTER_TABS = [
  { key: "all", label: "Todas" },
  { key: "pending", label: "Por Liquidar" },
  { key: "paid", label: "Liquidadas" },
] as const;

export default function VendorsPage() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const bcv = useBcvRate();
  const [activeFilter, setActiveFilter] = useState<FilterMode>("all");

  const { data: commissions, isLoading } = useQuery(
    trpc.vendor.allCommissions.queryOptions({ limit: 100 }),
  );

  const { data: users } = useQuery(trpc.users.list.queryOptions());

  const userMap = useMemo(() => {
    const map = new Map<string, string>();
    if (users) {
      for (const u of users) {
        map.set(u.id, u.fullName || u.email);
      }
    }
    return map;
  }, [users]);

  const pay = useMutation(
    trpc.vendor.payCommission.mutationOptions({
      onSuccess: () => {
        toast.success("Comisión liquidada exitosamente");
        void qc.invalidateQueries({ queryKey: [["vendor"]] });
      },
      onError: (err) => {
        toast.error(`Error al liquidar comisión: ${err.message}`);
      },
    }),
  );

  const items = useMemo(() => commissions ?? [], [commissions]);

  const totalPending = useMemo(
    () =>
      items
        .filter((c) => !c.isPaid)
        .reduce((s, c) => s + c.commissionAmount, 0),
    [items],
  );

  const totalPaid = useMemo(
    () =>
      items.filter((c) => c.isPaid).reduce((s, c) => s + c.commissionAmount, 0),
    [items],
  );

  const vendorCount = useMemo(() => {
    const set = new Set<string>();
    for (const c of items) set.add(c.vendorId);
    return set.size;
  }, [items]);

  const filteredItems = useMemo(() => {
    if (activeFilter === "all") return items;
    if (activeFilter === "pending") return items.filter((c) => !c.isPaid);
    return items.filter((c) => c.isPaid);
  }, [items, activeFilter]);

  const dualPending = useMemo(
    () => formatDualCurrency(totalPending, bcv.rate),
    [totalPending, bcv.rate],
  );

  const dualPaid = useMemo(
    () => formatDualCurrency(totalPaid, bcv.rate),
    [totalPaid, bcv.rate],
  );

  return (
    <div className="space-y-6 p-4 lg:p-8">
      {/* Page Header */}
      <PageHeader
        title="Fuerza de Ventas & Comisiones"
        description="Gestión, seguimiento y liquidación de comisiones para la fuerza comercial nacional"
      />

      {/* 4 StatCards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Vendedores Activos"
          value={isLoading ? "—" : vendorCount}
          icon="Group"
          tone="default"
          sub="Con comisiones generadas"
        />
        <StatCard
          label="Comisiones Registradas"
          value={isLoading ? "—" : items.length}
          icon="ReceiptLong"
          tone="primary"
          sub="Total histórico de registros"
        />
        <StatCard
          label="Comisiones Por Liquidar"
          value={isLoading ? "—" : dualPending.usd}
          icon="Payments"
          tone="warning"
          sub={`Equivalente oficial: ${dualPending.bs}`}
        />
        <StatCard
          label="Comisiones Liquidadas"
          value={isLoading ? "—" : dualPaid.usd}
          icon="CheckCircle"
          tone="success"
          sub={`Equivalente oficial: ${dualPaid.bs}`}
        />
      </div>

      {/* Filter Tabs (Horizontal Scrollable) */}
      <div className="mobile-scroll-x border-border-subtle flex gap-2 border-b pb-3">
        {FILTER_TABS.map((tab) => {
          const isActive = activeFilter === tab.key;
          const count =
            tab.key === "all"
              ? items.length
              : tab.key === "pending"
                ? items.filter((c) => !c.isPaid).length
                : items.filter((c) => c.isPaid).length;

          return (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className={`flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium transition-all ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-surface-card text-muted-foreground hover:bg-accent hover:text-foreground border-border-subtle border"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] tabular-nums ${
                  isActive
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Commissions Content */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : filteredItems.length > 0 ? (
        <>
          {/* Mobile View: Cards (md:hidden) */}
          <div className="space-y-3 md:hidden">
            {filteredItems.map((c) => {
              const vendorName =
                userMap.get(c.vendorId) ??
                `Vendedor #${c.vendorId.slice(0, 8)}`;
              const dualOrder = formatDualCurrency(c.orderTotal, bcv.rate);
              const dualCommission = formatDualCurrency(
                c.commissionAmount,
                bcv.rate,
              );

              return (
                <div
                  key={c.id}
                  className="surface-card border-border-subtle hover:border-primary/40 rounded-xl border p-4 transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-foreground font-medium">
                        {vendorName}
                      </p>
                      <p className="text-muted-foreground font-mono text-xs">
                        Pedido: #{c.orderId.slice(0, 8)}
                      </p>
                    </div>
                    <StatusBadge tone={c.isPaid ? "success" : "warning"}>
                      {c.isPaid ? "Liquidada" : "Por Liquidar"}
                    </StatusBadge>
                  </div>

                  <div className="border-border-subtle/60 mt-3 grid grid-cols-2 gap-2 border-t pt-2.5 text-xs">
                    <div>
                      <p className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                        Venta Total ({c.commissionPct}%)
                      </p>
                      <p className="text-foreground mt-0.5 font-mono font-medium tabular-nums">
                        {dualOrder.usd}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                        Comisión Neta
                      </p>
                      <p className="text-primary mt-0.5 font-mono font-medium tabular-nums">
                        {dualCommission.usd}
                      </p>
                      <p className="text-muted-foreground font-mono text-[10px] tabular-nums">
                        {dualCommission.bs}
                      </p>
                    </div>
                  </div>

                  {!c.isPaid && (
                    <div className="border-border-subtle/60 mt-3 border-t pt-2.5">
                      <Button
                        size="sm"
                        onClick={() => pay.mutate({ id: c.id })}
                        disabled={pay.isPending}
                        className="min-h-9 w-full gap-1.5 text-xs"
                      >
                        <Icons.Payments className="size-3.5" />
                        Liquidar Comisión
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Desktop View: Table (hidden md:block) */}
          <div className="surface-card border-border-subtle hidden overflow-hidden rounded-xl border md:block">
            <Table>
              <TableHeader>
                <TableRow className="border-border-subtle hover:bg-transparent">
                  <TableHead className="w-12 text-center">#</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead className="text-right">
                    Venta Total (USD / Bs)
                  </TableHead>
                  <TableHead className="text-center">% Comisión</TableHead>
                  <TableHead className="text-right">
                    Monto Comisión (USD / Bs)
                  </TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="w-28 text-center">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((c, idx) => {
                  const vendorName =
                    userMap.get(c.vendorId) ??
                    `Vendedor #${c.vendorId.slice(0, 8)}`;
                  const dualOrder = formatDualCurrency(c.orderTotal, bcv.rate);
                  const dualCommission = formatDualCurrency(
                    c.commissionAmount,
                    bcv.rate,
                  );

                  return (
                    <TableRow
                      key={c.id}
                      className="border-border-subtle hover:bg-accent/40 transition-colors"
                    >
                      <TableCell className="text-muted-foreground text-center font-mono text-xs tabular-nums">
                        {idx + 1}
                      </TableCell>
                      <TableCell>
                        <span className="text-foreground block font-medium">
                          {vendorName}
                        </span>
                        <span className="text-muted-foreground font-mono text-xs">
                          ID: {c.vendorId.slice(0, 8)}…
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        <span className="text-foreground font-medium">
                          {dualOrder.usd}
                        </span>
                        <span className="text-muted-foreground block text-[11px]">
                          {dualOrder.bs}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-center font-mono text-xs font-medium tabular-nums">
                        {c.commissionPct}%
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        <span className="text-foreground font-medium">
                          {dualCommission.usd}
                        </span>
                        <span className="text-muted-foreground block text-[11px]">
                          {dualCommission.bs}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <StatusBadge tone={c.isPaid ? "success" : "warning"}>
                          {c.isPaid ? "Liquidada" : "Por Liquidar"}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">
                        {new Date(c.createdAt).toLocaleDateString("es-VE")}
                      </TableCell>
                      <TableCell className="text-center">
                        {c.isPaid ? (
                          <span className="text-muted-foreground text-xs italic">
                            Pagada
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => pay.mutate({ id: c.id })}
                            disabled={pay.isPending}
                            className="min-h-8 gap-1 px-2.5 text-xs"
                          >
                            <Icons.Payments className="size-3.5" />
                            Liquidar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      ) : (
        <EmptyState
          icon="ReceiptLong"
          title="No hay comisiones registradas"
          description={
            activeFilter === "all"
              ? "Aún no se han generado comisiones de venta en el sistema."
              : `No se encontraron comisiones en estado "${activeFilter === "pending" ? "Por Liquidar" : "Liquidadas"}".`
          }
        />
      )}
    </div>
  );
}
