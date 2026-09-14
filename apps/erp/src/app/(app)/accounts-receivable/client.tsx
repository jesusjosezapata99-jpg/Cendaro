"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@cendaro/ui";
import { Icons } from "@cendaro/ui/icons";
import { StatusPill } from "@cendaro/ui/status-pill";

import { DataTable } from "~/components/data-table/data-table";
import { PageHeader } from "~/components/page-header";
import { RoleGuard } from "~/components/role-guard";
import { StatCard } from "~/components/stat-card";
import { useBcvRate } from "~/hooks/use-bcv-rate";
import { formatDualCurrency } from "~/lib/format-currency";
import { getStatus } from "~/lib/status";
import { useTRPC } from "~/trpc/client";

const RecordArPaymentDialog = dynamic(
  () =>
    import("~/components/forms/record-ar-payment").then((m) => ({
      default: m.RecordArPaymentDialog,
    })),
  { ssr: false },
);

const CreateArDialog = dynamic(
  () =>
    import("~/components/forms/create-ar").then((m) => ({
      default: m.CreateArDialog,
    })),
  { ssr: false },
);

function computeDaysOverdue(dueDate: Date | string): number {
  const now = new Date();
  const diff = Math.floor(
    (now.getTime() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24),
  );
  return diff > 0 ? diff : 0;
}

interface ReceivableItem {
  id: string;
  customerId: string;
  orderId: string | null;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  dueDate: Date | string;
  status: "pending" | "partial" | "paid" | "overdue" | "written_off";
  createdAt: Date | string;
}

export default function AccountsReceivableClient() {
  const router = useRouter();
  const trpc = useTRPC();
  const bcv = useBcvRate();

  const searchParams = useSearchParams();
  const urlStatus = searchParams.get("status");
  const [statusFilter, setStatusFilter] = useState<string>(urlStatus ?? "all");

  useEffect(() => {
    if (urlStatus) {
      setStatusFilter(urlStatus);
    }
  }, [urlStatus]);

  const [agingFilter, setAgingFilter] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedArForPayment, setSelectedArForPayment] = useState<{
    id: string;
    balance: number;
    customerName?: string;
    orderId?: string | null;
  } | null>(null);

  const {
    data: receivables,
    isLoading,
    isError,
    refetch,
  } = useQuery(trpc.vendor.listAR.queryOptions({}));

  const { data: customers } = useQuery(
    trpc.sales.listCustomers.queryOptions({ limit: 100 }),
  );

  const customerMap = useMemo(() => {
    const map = new Map<string, string>();
    if (customers) {
      for (const c of customers) map.set(c.id, c.name);
    }
    return map;
  }, [customers]);

  const items = useMemo(
    () => (receivables ?? []) as ReceivableItem[],
    [receivables],
  );

  // Filter pipeline
  const filtered = useMemo(() => {
    return items.filter((ar) => {
      if (statusFilter !== "all" && ar.status !== statusFilter) return false;

      if (agingFilter !== "all") {
        const days = computeDaysOverdue(ar.dueDate);
        if (agingFilter === "current" && days > 0) return false;
        if (agingFilter === "1-30" && (days < 1 || days > 30)) return false;
        if (agingFilter === "31-60" && (days < 31 || days > 60)) return false;
        if (agingFilter === "60+" && days <= 60) return false;
      }

      return true;
    });
  }, [items, statusFilter, agingFilter]);

  // Aggregate metrics
  const totalBalance = useMemo(
    () =>
      items
        .filter((ar) => ar.status !== "paid" && ar.status !== "written_off")
        .reduce((sum, ar) => sum + ar.balance, 0),
    [items],
  );

  const overdueCount = useMemo(
    () =>
      items.filter(
        (ar) =>
          ar.status !== "paid" &&
          ar.status !== "written_off" &&
          computeDaysOverdue(ar.dueDate) > 0,
      ).length,
    [items],
  );

  const totalCollected = useMemo(
    () => items.reduce((sum, ar) => sum + (ar.totalAmount - ar.balance), 0),
    [items],
  );

  const avgDaysToCollect = useMemo(() => {
    const paid = items.filter((ar) => ar.status === "paid");
    if (!paid.length) return 0;
    const totalDays = paid.reduce((sum, ar) => {
      const created = new Date(ar.createdAt).getTime();
      const due = new Date(ar.dueDate).getTime();
      return (
        sum + Math.max(0, Math.floor((due - created) / (1000 * 60 * 60 * 24)))
      );
    }, 0);
    return Math.round(totalDays / paid.length);
  }, [items]);

  const dualBalance = useMemo(
    () => formatDualCurrency(totalBalance, bcv.rate),
    [totalBalance, bcv.rate],
  );
  const dualCollected = useMemo(
    () => formatDualCurrency(totalCollected, bcv.rate),
    [totalCollected, bcv.rate],
  );

  const columns = useMemo<ColumnDef<ReceivableItem>[]>(
    () => [
      {
        accessorKey: "id",
        header: "Ref #",
        meta: { sticky: true, className: "w-36" },
        cell: ({ row }) => (
          <Link
            href={`/accounts-receivable/${row.original.id}`}
            onClick={(e) => e.stopPropagation()}
            className="text-primary font-mono text-xs font-medium tabular-nums hover:underline"
          >
            CXC-{row.original.id.slice(0, 8)}
          </Link>
        ),
      },
      {
        id: "customer",
        header: "Cliente / Deudor",
        meta: { className: "min-w-44" },
        cell: ({ row }) => {
          const customerName =
            customerMap.get(row.original.customerId) ??
            `Cliente #${row.original.customerId.slice(0, 8)}`;
          return (
            <div className="flex flex-col gap-0.5">
              <span className="text-foreground truncate text-xs font-medium">
                {customerName}
              </span>
              {row.original.orderId ? (
                <span className="text-muted-foreground font-mono text-[11px] tabular-nums">
                  Orden #{row.original.orderId.slice(0, 8)}
                </span>
              ) : null}
            </div>
          );
        },
      },
      {
        accessorKey: "dueDate",
        header: "Vencimiento",
        meta: { className: "w-40" },
        cell: ({ row }) => {
          const days = computeDaysOverdue(row.original.dueDate);
          const isOverdue =
            days > 0 &&
            row.original.status !== "paid" &&
            row.original.status !== "written_off";
          return (
            <div className="flex items-center gap-1.5 font-mono text-xs tabular-nums">
              <span
                className={
                  isOverdue
                    ? "text-destructive font-medium"
                    : "text-muted-foreground"
                }
              >
                {new Date(row.original.dueDate).toLocaleDateString("es-VE")}
              </span>
              {isOverdue ? (
                <span className="text-destructive font-mono text-[10px] font-medium tabular-nums">
                  (+{days}d)
                </span>
              ) : null}
            </div>
          );
        },
      },
      {
        accessorKey: "totalAmount",
        header: "Monto Original",
        meta: {
          numeric: true,
          align: "right",
          className: "w-36 text-right font-mono tabular-nums",
        },
        cell: ({ row }) => {
          const val = Number(row.original.totalAmount);
          return (
            <div className="text-right font-mono tabular-nums">
              <span className="text-foreground font-medium">
                ${val.toFixed(2)}
              </span>
              {bcv.rate > 0 ? (
                <span className="text-muted-foreground ml-1.5 text-[10px] font-normal">
                  {formatDualCurrency(val, bcv.rate).bs}
                </span>
              ) : null}
            </div>
          );
        },
      },
      {
        accessorKey: "balance",
        header: "Saldo Pendiente",
        meta: {
          numeric: true,
          align: "right",
          className: "w-36 text-right font-mono tabular-nums",
        },
        cell: ({ row }) => {
          const val = Number(row.original.balance);
          return (
            <div className="text-right font-mono tabular-nums">
              <span
                className={`font-medium ${
                  val > 0 ? "text-primary" : "text-muted-foreground"
                }`}
              >
                ${val.toFixed(2)}
              </span>
              {bcv.rate > 0 && val > 0 ? (
                <span className="text-muted-foreground ml-1.5 text-[10px] font-normal">
                  {formatDualCurrency(val, bcv.rate).bs}
                </span>
              ) : null}
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Estado",
        meta: { align: "center", className: "w-32 text-center" },
        cell: ({ row }) => {
          const s = getStatus("accountsReceivable", row.original.status);
          return <StatusPill tone={s.tone}>{s.label}</StatusPill>;
        },
      },
      {
        id: "actions",
        header: "Acción",
        meta: { align: "center", className: "w-28 text-center" },
        cell: ({ row }) => {
          const ar = row.original;
          const canPay = ar.status !== "paid" && ar.status !== "written_off";
          return (
            <div
              className="flex items-center justify-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              {canPay ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setSelectedArForPayment({
                      id: ar.id,
                      balance: ar.balance,
                      customerName: customerMap.get(ar.customerId),
                      orderId: ar.orderId,
                    })
                  }
                  className="min-h-7 px-2 text-[11px]"
                >
                  <Icons.Payments className="mr-1 size-3.5" />
                  Abonar
                </Button>
              ) : (
                <span className="text-muted-foreground font-mono text-xs italic">
                  Cerrada
                </span>
              )}
            </div>
          );
        },
      },
    ],
    [bcv.rate, customerMap],
  );

  const handleRowClick = useCallback(
    (row: ReceivableItem) => {
      router.push(`/accounts-receivable/${row.id}`);
    },
    [router],
  );

  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 space-y-6 py-4 duration-200 lg:py-8">
      {/* Page Header */}
      <PageHeader
        title="Cuentas por Cobrar"
        description="Gestión y conciliación de cartera de créditos y cobranzas"
        actions={
          <RoleGuard allow={["owner", "admin", "supervisor"]}>
            <Button
              onClick={() => setShowCreate(true)}
              className="min-h-11 w-full gap-2 sm:w-auto"
            >
              <Icons.Add className="size-4.5" />
              Nueva Cuenta por Cobrar
            </Button>
          </RoleGuard>
        }
      />

      {/* 4 StatCards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Deuda Pendiente"
          value={isLoading ? "—" : dualBalance.usd}
          sub={isLoading ? undefined : dualBalance.bs}
          icon="AccountBalance"
          tone="warning"
        />
        <StatCard
          label="Cuentas Vencidas"
          value={isLoading ? "—" : overdueCount}
          icon="Warning"
          tone={overdueCount > 0 ? "destructive" : "default"}
          sub={
            overdueCount > 0
              ? `${overdueCount} cuentas fuera de plazo`
              : "Al día"
          }
        />
        <StatCard
          label="Plazo Prom. Cobro"
          value={isLoading ? "—" : `${avgDaysToCollect} días`}
          icon="Schedule"
          tone="default"
          sub="Basado en cobros liquidados"
        />
        <StatCard
          label="Total Cobrado"
          value={isLoading ? "—" : dualCollected.usd}
          sub={isLoading ? undefined : dualCollected.bs}
          icon="CheckCircle"
          tone="success"
        />
      </div>

      {/* Filter Tabs — Clean sharp style */}
      <div className="flex flex-col gap-2">
        {/* Status Filter */}
        <div className="mobile-scroll-x flex items-center gap-1.5 border-b border-[--line] pb-2">
          {[
            { key: "all", label: "Todas" },
            { key: "pending", label: "Pendientes" },
            { key: "partial", label: "Abono Parcial" },
            { key: "overdue", label: "Vencidas" },
            { key: "paid", label: "Pagadas" },
          ].map((tab) => {
            const isActive = statusFilter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key)}
                className={`flex min-h-8 items-center border px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground hover:bg-secondary hover:text-foreground border-[--line] hover:border-[--line-hover]"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Aging Filter */}
        <div className="mobile-scroll-x flex items-center gap-1.5 pt-1">
          <span className="text-muted-foreground mr-1 text-xs font-medium tracking-wider uppercase">
            Antigüedad:
          </span>
          {[
            { key: "all", label: "Todos los plazos" },
            { key: "current", label: "Al día (no vencidas)" },
            { key: "1-30", label: "1 a 30 días" },
            { key: "31-60", label: "31 a 60 días" },
            { key: "60+", label: "Más de 60 días" },
          ].map((tab) => {
            const isActive = agingFilter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setAgingFilter(tab.key)}
                className={`flex min-h-7 items-center border px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Data Table with 45px rows */}
      <DataTable
        columns={columns}
        data={filtered}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => void refetch()}
        onRowClick={handleRowClick}
        onResetFilters={
          statusFilter !== "all" || agingFilter !== "all"
            ? () => {
                setStatusFilter("all");
                setAgingFilter("all");
              }
            : undefined
        }
        emptyTitle="No se encontraron cuentas por cobrar"
        emptyDescription="No hay registros que coincidan con los filtros seleccionados."
      />

      {/* Create Dialog */}
      {showCreate && (
        <CreateArDialog
          open={showCreate}
          onClose={() => setShowCreate(false)}
        />
      )}

      {/* Payment Dialog */}
      {selectedArForPayment && (
        <RecordArPaymentDialog
          open={Boolean(selectedArForPayment)}
          onClose={() => setSelectedArForPayment(null)}
          receivable={selectedArForPayment}
        />
      )}
    </div>
  );
}
