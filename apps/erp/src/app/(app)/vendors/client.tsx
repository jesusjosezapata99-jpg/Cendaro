"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@cendaro/ui";
import { Icons } from "@cendaro/ui/icons";
import { StatusPill } from "@cendaro/ui/status-pill";

import { DataTable } from "~/components/data-table/data-table";
import { PageHeader } from "~/components/page-header";
import { StatCard } from "~/components/stat-card";
import { useBcvRate } from "~/hooks/use-bcv-rate";
import { formatDualCurrency } from "~/lib/format-currency";
import { useTRPC } from "~/trpc/client";

type FilterMode = "all" | "pending" | "paid";

const FILTER_TABS = [
  { key: "all", label: "Todas" },
  { key: "pending", label: "Por Liquidar" },
  { key: "paid", label: "Liquidadas" },
] as const;

interface CommissionItem {
  id: string;
  vendorId: string;
  orderId: string;
  orderTotal: number;
  commissionPct: number;
  commissionAmount: number;
  isPaid: boolean | null;
  paidAt: Date | null;
  createdAt: Date;
}

export default function VendorsPage() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const bcv = useBcvRate();
  const [activeFilter, setActiveFilter] = useState<FilterMode>("all");

  const commissionsOptions = trpc.vendor.allCommissions.queryOptions({
    limit: 100,
  });

  const {
    data: commissions,
    isLoading,
    isError,
    refetch,
  } = useQuery(commissionsOptions);

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
      onMutate: async ({ id }) => {
        await qc.cancelQueries({ queryKey: [["vendor"]] });
        const prev = qc.getQueryData(commissionsOptions.queryKey);
        if (prev) {
          qc.setQueryData(
            commissionsOptions.queryKey,
            prev.map((c) =>
              c.id === id ? { ...c, isPaid: true, paidAt: new Date() } : c,
            ),
          );
        }
        return { prev };
      },
      onError: (err, _vars, context) => {
        if (context?.prev) {
          qc.setQueryData(commissionsOptions.queryKey, context.prev);
        }
        toast.error(`Error al liquidar comisión: ${err.message}`);
      },
      onSuccess: () => {
        toast.success("Comisión liquidada exitosamente");
      },
      onSettled: () => {
        void qc.invalidateQueries({ queryKey: [["vendor"]] });
      },
    }),
  );

  const items = useMemo(
    () => (commissions ?? []) as CommissionItem[],
    [commissions],
  );

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

  const columns = useMemo<ColumnDef<CommissionItem>[]>(
    () => [
      {
        id: "index",
        header: "#",
        meta: { align: "center", className: "w-12 text-center" },
        cell: ({ row }) => (
          <span className="text-muted-foreground font-mono text-xs tabular-nums">
            {row.index + 1}
          </span>
        ),
      },
      {
        id: "vendor",
        header: "Vendedor",
        meta: { sticky: true, className: "min-w-44" },
        cell: ({ row }) => {
          const vendorName =
            userMap.get(row.original.vendorId) ??
            `Vendedor #${row.original.vendorId.slice(0, 8)}`;
          return (
            <div className="flex flex-col gap-0.5">
              <span className="text-foreground truncate text-xs font-medium">
                {vendorName}
              </span>
              <span className="text-muted-foreground font-mono text-[11px] tabular-nums">
                ID: {row.original.vendorId.slice(0, 8)}…
              </span>
            </div>
          );
        },
      },
      {
        id: "orderRef",
        header: "Pedido Ref.",
        meta: { className: "w-32" },
        cell: ({ row }) => (
          <Link
            href={`/orders/${row.original.orderId}`}
            className="text-muted-foreground hover:text-foreground font-mono text-xs tabular-nums hover:underline"
          >
            #{row.original.orderId.slice(0, 8)}
          </Link>
        ),
      },
      {
        accessorKey: "orderTotal",
        header: "Venta Total",
        meta: {
          numeric: true,
          align: "right",
          className: "w-36 text-right font-mono tabular-nums",
        },
        cell: ({ row }) => {
          const dual = formatDualCurrency(row.original.orderTotal, bcv.rate);
          return (
            <div className="text-right font-mono tabular-nums">
              <span className="text-foreground font-medium">{dual.usd}</span>
              {bcv.rate > 0 ? (
                <span className="text-muted-foreground ml-1.5 text-[10px] font-normal">
                  {dual.bs}
                </span>
              ) : null}
            </div>
          );
        },
      },
      {
        accessorKey: "commissionPct",
        header: "% Comisión",
        meta: {
          align: "center",
          className:
            "w-24 text-center font-mono text-xs tabular-nums text-muted-foreground",
        },
        cell: ({ row }) => `${row.original.commissionPct}%`,
      },
      {
        accessorKey: "commissionAmount",
        header: "Comisión Neta",
        meta: {
          numeric: true,
          align: "right",
          className: "w-36 text-right font-mono tabular-nums",
        },
        cell: ({ row }) => {
          const dual = formatDualCurrency(
            row.original.commissionAmount,
            bcv.rate,
          );
          return (
            <div className="text-right font-mono tabular-nums">
              <span className="text-primary font-medium">{dual.usd}</span>
              {bcv.rate > 0 ? (
                <span className="text-muted-foreground ml-1.5 text-[10px] font-normal">
                  {dual.bs}
                </span>
              ) : null}
            </div>
          );
        },
      },
      {
        accessorKey: "isPaid",
        header: "Estado",
        meta: { align: "center", className: "w-32 text-center" },
        cell: ({ row }) => (
          <StatusPill tone={row.original.isPaid ? "success" : "warning"}>
            {row.original.isPaid ? "Liquidada" : "Por Liquidar"}
          </StatusPill>
        ),
      },
      {
        accessorKey: "createdAt",
        header: "Fecha",
        meta: {
          className:
            "w-28 font-mono text-xs tabular-nums text-muted-foreground",
        },
        cell: ({ row }) => (
          <span className="text-muted-foreground font-mono text-xs tabular-nums">
            {new Date(row.original.createdAt).toLocaleDateString("es-VE")}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Acción",
        meta: { align: "center", className: "w-28 text-center" },
        cell: ({ row }) =>
          row.original.isPaid ? (
            <span className="text-muted-foreground font-mono text-xs italic">
              Pagada
            </span>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled={pay.isPending}
              onClick={() => pay.mutate({ id: row.original.id })}
              className="min-h-7 px-2 text-[11px]"
            >
              <Icons.Payments className="mr-1 size-3.5" />
              Liquidar
            </Button>
          ),
      },
    ],
    [bcv.rate, pay, userMap],
  );

  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 space-y-6 py-4 duration-200 lg:py-8">
      {/* Page Header */}
      <PageHeader
        title="Fuerza de Ventas & Comisiones"
        description="Gestión, seguimiento y liquidación de comisiones para la fuerza comercial nacional"
      />

      {/* 4 StatCards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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

      {/* Filter Tabs — Clean sharp style */}
      <div className="mobile-scroll-x flex items-center gap-1.5 border-b border-[--line] pb-2">
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
              type="button"
              onClick={() => setActiveFilter(tab.key)}
              className={`flex min-h-8 items-center gap-2 border px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:bg-secondary hover:text-foreground border-[--line] hover:border-[--line-hover]"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1 font-mono text-[10px] tabular-nums ${
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

      {/* Main Data Table with 45px rows */}
      <DataTable
        columns={columns}
        data={filteredItems}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => void refetch()}
        onResetFilters={
          activeFilter !== "all" ? () => setActiveFilter("all") : undefined
        }
        emptyTitle="No hay comisiones registradas"
        emptyDescription={
          activeFilter === "all"
            ? "Aún no se han generado comisiones de venta en el sistema."
            : `No se encontraron comisiones en estado "${activeFilter === "pending" ? "Por Liquidar" : "Liquidadas"}".`
        }
      />
    </div>
  );
}
