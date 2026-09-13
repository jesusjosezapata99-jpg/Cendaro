"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

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

const STATUS_CONFIG: Record<
  string,
  { label: string; tone: StatusTone; icon: string }
> = {
  pending: {
    label: "Pendiente",
    tone: "warning",
    icon: "schedule",
  },
  partial: {
    label: "Abono Parcial",
    tone: "primary",
    icon: "payments",
  },
  paid: {
    label: "Pagada",
    tone: "success",
    icon: "check_circle",
  },
  overdue: {
    label: "Vencida",
    tone: "destructive",
    icon: "warning",
  },
  written_off: {
    label: "Castigada",
    tone: "neutral",
    icon: "error_outline",
  },
};

function computeDaysOverdue(dueDate: Date | string): number {
  const now = new Date();
  const diff = Math.floor(
    (now.getTime() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24),
  );
  return diff > 0 ? diff : 0;
}

const cellPx = "px-4 py-3";

export default function AccountsReceivableClient() {
  const trpc = useTRPC();
  const bcv = useBcvRate();

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [agingFilter, setAgingFilter] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedArForPayment, setSelectedArForPayment] = useState<{
    id: string;
    balance: number;
    customerName?: string;
    orderId?: string | null;
  } | null>(null);

  const { data: arData, isLoading: isLoadingAR } = useQuery(
    trpc.vendor.listAR.queryOptions({ limit: 100 }),
  );

  const { data: customersData } = useQuery(
    trpc.sales.listCustomers.queryOptions({ limit: 100 }),
  );

  const items = useMemo(() => arData ?? [], [arData]);
  const customers = useMemo(() => customersData ?? [], [customersData]);

  const customerMap = useMemo(() => {
    return new Map(customers.map((c) => [c.id, c]));
  }, [customers]);

  // Overall metrics
  const activeItems = useMemo(
    () =>
      items.filter((a) => a.status !== "paid" && a.status !== "written_off"),
    [items],
  );

  const totalPendingBalance = useMemo(
    () => activeItems.reduce((s, a) => s + Number(a.balance), 0),
    [activeItems],
  );

  const totalOriginalAmount = useMemo(
    () => items.reduce((s, a) => s + Number(a.totalAmount), 0),
    [items],
  );

  const totalPaidAmount = useMemo(
    () => items.reduce((s, a) => s + Number(a.paidAmount), 0),
    [items],
  );

  const recoveryRate = useMemo(() => {
    if (totalOriginalAmount <= 0) return 0;
    return (totalPaidAmount / totalOriginalAmount) * 100;
  }, [totalPaidAmount, totalOriginalAmount]);

  // Overdue calculations (status overdue or past due date with balance > 0)
  const overdueAccounts = useMemo(() => {
    return items.filter(
      (a) =>
        a.status === "overdue" ||
        (a.balance > 0 && computeDaysOverdue(a.dueDate) > 0),
    );
  }, [items]);

  const overdueTotal = useMemo(
    () => overdueAccounts.reduce((s, a) => s + Number(a.balance), 0),
    [overdueAccounts],
  );

  // Aging breakdown
  const agingBuckets = useMemo(() => {
    const buckets = {
      current: { label: "Al Día (0-30d)", count: 0, total: 0 },
      mora1: { label: "Mora 31-60d", count: 0, total: 0 },
      mora2: { label: "Mora 61-90d", count: 0, total: 0 },
      mora3: { label: "Crítica +90d", count: 0, total: 0 },
    };

    activeItems.forEach((a) => {
      const days = computeDaysOverdue(a.dueDate);
      const bal = Number(a.balance);
      if (days <= 30) {
        buckets.current.count++;
        buckets.current.total += bal;
      } else if (days <= 60) {
        buckets.mora1.count++;
        buckets.mora1.total += bal;
      } else if (days <= 90) {
        buckets.mora2.count++;
        buckets.mora2.total += bal;
      } else {
        buckets.mora3.count++;
        buckets.mora3.total += bal;
      }
    });

    return buckets;
  }, [activeItems]);

  // Filtered accounts
  const filteredItems = useMemo(() => {
    return items.filter((ar) => {
      // Status filter
      if (statusFilter !== "all") {
        if (statusFilter === "overdue") {
          const isOverdue =
            ar.status === "overdue" ||
            (ar.balance > 0 && computeDaysOverdue(ar.dueDate) > 0);
          if (!isOverdue) return false;
        } else if (ar.status !== statusFilter) {
          return false;
        }
      }

      // Aging filter
      if (agingFilter !== "all") {
        const days = computeDaysOverdue(ar.dueDate);
        if (agingFilter === "current" && days > 30) return false;
        if (agingFilter === "mora1" && (days <= 30 || days > 60)) return false;
        if (agingFilter === "mora2" && (days <= 60 || days > 90)) return false;
        if (agingFilter === "mora3" && days <= 90) return false;
      }

      return true;
    });
  }, [items, statusFilter, agingFilter]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 space-y-6 py-4 duration-200 lg:py-8">
      <PageHeader
        title="Cuentas por Cobrar"
        description="Gestión de créditos comerciales, cobranzas, abonos y cartera vencida"
        actions={
          <RoleGuard allow={["owner", "admin", "supervisor"]}>
            <Button
              onClick={() => setShowCreate(true)}
              className="min-h-11 flex-1 sm:flex-initial"
            >
              <Icons.Add className="size-4.5" />
              Nueva CxC
            </Button>
          </RoleGuard>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <StatCard
          label="Cartera Total Pendiente"
          value={
            isLoadingAR
              ? "—"
              : formatDualCurrency(totalPendingBalance, bcv.rate).usd
          }
          sub={
            isLoadingAR
              ? undefined
              : formatDualCurrency(totalPendingBalance, bcv.rate).bs
          }
          icon="ReceiptLong"
          tone="primary"
        />
        <StatCard
          label="Cuentas Activas"
          value={isLoadingAR ? "—" : activeItems.length.toLocaleString("es-VE")}
          icon="Assignment"
        />
        <StatCard
          label="Cartera Vencida"
          value={
            isLoadingAR ? "—" : formatDualCurrency(overdueTotal, bcv.rate).usd
          }
          sub={
            isLoadingAR
              ? undefined
              : formatDualCurrency(overdueTotal, bcv.rate).bs
          }
          icon="Warning"
          tone={overdueTotal > 0 ? "destructive" : "default"}
        />
        <StatCard
          label="Tasa de Cobranza"
          value={isLoadingAR ? "—" : `${recoveryRate.toFixed(1)}%`}
          sub={
            isLoadingAR
              ? undefined
              : `Abonado: $${totalPaidAmount.toLocaleString("es-VE", { minimumFractionDigits: 2 })}`
          }
          icon="CheckCircle"
          tone={recoveryRate >= 70 ? "success" : "default"}
        />
      </div>

      {/* Aging Strip (Antigüedad de Deuda) */}
      <div className="border-border-subtle surface-card rounded-xl border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icons.Schedule className="text-muted-foreground size-4" />
            <span className="text-foreground text-xs font-medium tracking-wider uppercase">
              Antigüedad de Deuda (Aging)
            </span>
          </div>
          {agingFilter !== "all" && (
            <button
              type="button"
              onClick={() => setAgingFilter("all")}
              className="text-primary text-xs font-medium hover:underline"
            >
              Restablecer filtro
            </button>
          )}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            {
              id: "current",
              ...agingBuckets.current,
              color: "text-emerald-500",
            },
            { id: "mora1", ...agingBuckets.mora1, color: "text-blue-500" },
            { id: "mora2", ...agingBuckets.mora2, color: "text-amber-500" },
            { id: "mora3", ...agingBuckets.mora3, color: "text-destructive" },
          ].map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() =>
                setAgingFilter((curr) => (curr === b.id ? "all" : b.id))
              }
              className={`border-border-subtle hover:border-primary/40 block rounded-lg border p-2.5 text-left transition-all ${
                agingFilter === b.id
                  ? "border-primary bg-primary/5 ring-primary/20 ring-1"
                  : "bg-card/50"
              }`}
            >
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground text-[11px] font-medium">
                  {b.label}
                </span>
                <span className="text-muted-foreground font-mono text-xs tabular-nums">
                  {b.count} ctas
                </span>
              </div>
              <p
                className={`mt-1 font-mono text-sm font-medium tabular-nums ${b.color}`}
              >
                ${b.total.toFixed(2)}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Critical Overdue Banner */}
      {overdueAccounts.length > 0 && (
        <div className="border-destructive/30 bg-destructive/10 text-destructive flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3.5 text-xs">
          <div className="flex items-center gap-2">
            <Icons.Warning className="size-4.5" />
            <div>
              <p className="font-medium">
                {overdueAccounts.length} cuenta
                {overdueAccounts.length > 1 ? "s" : ""} vencida
                {overdueAccounts.length > 1 ? "s" : ""} por un total de $
                {overdueTotal.toLocaleString("es-VE", {
                  minimumFractionDigits: 2,
                })}
              </p>
              {bcv.rate > 0 && (
                <p className="font-mono text-[10px] tabular-nums opacity-90">
                  Equivalente oficial:{" "}
                  {formatDualCurrency(overdueTotal, bcv.rate).bs}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setStatusFilter("overdue")}
            className="border-destructive/40 hover:bg-destructive/20 rounded-lg border px-3 py-1 font-medium transition-colors"
          >
            Filtrar Vencidas
          </button>
        </div>
      )}

      {/* Filter Chips */}
      <div className="mobile-scroll-x flex gap-2 pb-1">
        {[
          { id: "all", label: "Todas las Cuentas" },
          { id: "pending", label: "Pendientes" },
          { id: "partial", label: "Abono Parcial" },
          { id: "overdue", label: "Vencidas" },
          { id: "paid", label: "Pagadas" },
          { id: "written_off", label: "Castigadas" },
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
        {isLoadingAR
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="border-border-subtle surface-card rounded-xl border p-4"
              >
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="mt-2 h-4 w-24" />
              </div>
            ))
          : filteredItems.map((ar) => {
              const customer = customerMap.get(ar.customerId);
              const daysOverdue = computeDaysOverdue(ar.dueDate);
              const isOverdue =
                ar.status === "overdue" ||
                (ar.balance > 0 && daysOverdue > 0 && ar.status !== "paid");
              const effectiveStatus = isOverdue ? "overdue" : ar.status;
              const cfg = STATUS_CONFIG[effectiveStatus] ?? {
                label: effectiveStatus,
                tone: "neutral" as StatusTone,
                icon: "receipt_long",
              };
              const balNum = Number(ar.balance);

              return (
                <div
                  key={ar.id}
                  className="border-border-subtle surface-card rounded-xl border p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link
                        href={`/accounts-receivable/${ar.id}`}
                        className="text-foreground hover:text-primary text-sm font-medium transition-colors"
                      >
                        {customer?.name ??
                          `Cliente ${ar.customerId.slice(0, 8)}`}
                      </Link>
                      {customer?.phone && (
                        <p className="text-muted-foreground font-mono text-[11px]">
                          Tel: {customer.phone}
                        </p>
                      )}
                    </div>
                    <StatusBadge tone={cfg.tone}>{cfg.label}</StatusBadge>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                        Saldo Pendiente
                      </p>
                      <p
                        className={`font-mono text-base font-medium tabular-nums ${
                          balNum > 0 ? "text-primary" : "text-emerald-500"
                        }`}
                      >
                        ${balNum.toFixed(2)}
                      </p>
                      {bcv.rate > 0 && balNum > 0 && (
                        <p className="text-muted-foreground font-mono text-[10px] tabular-nums">
                          {formatDualCurrency(balNum, bcv.rate).bs}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                        Total / Abonado
                      </p>
                      <p className="text-foreground font-mono tabular-nums">
                        ${Number(ar.totalAmount).toFixed(2)}
                      </p>
                      <p className="font-mono text-[10px] text-emerald-500 tabular-nums">
                        Abono: ${Number(ar.paidAmount).toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <div className="border-border-subtle mt-3 flex items-center justify-between border-t pt-2 text-xs">
                    <div>
                      <span className="text-muted-foreground font-mono tabular-nums">
                        Vence:{" "}
                        {new Date(ar.dueDate).toLocaleDateString("es-VE")}
                      </span>
                      {daysOverdue > 0 && ar.status !== "paid" && (
                        <span className="text-destructive ml-2 font-mono font-medium tabular-nums">
                          ({daysOverdue}d mora)
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {balNum > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedArForPayment({
                              id: ar.id,
                              balance: balNum,
                              customerName: customer?.name,
                              orderId: ar.orderId,
                            })
                          }
                          className="bg-primary text-primary-foreground hover:bg-primary/90 min-h-9 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                        >
                          Abonar
                        </button>
                      )}
                      <Link
                        href={`/accounts-receivable/${ar.id}`}
                        className="border-border-subtle hover:border-primary hover:text-primary flex min-h-9 items-center rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors"
                      >
                        Detalle
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}

        {!isLoadingAR && filteredItems.length === 0 && (
          <EmptyState
            icon="ReceiptLong"
            title="No se encontraron cuentas"
            description="No hay cuentas por cobrar que coincidan con los filtros seleccionados."
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
                Cliente
              </th>
              <th
                className={`text-muted-foreground ${cellPx} text-xs font-medium tracking-widest uppercase`}
              >
                Orden / Ref
              </th>
              <th
                className={`text-muted-foreground ${cellPx} text-center text-xs font-medium tracking-widest uppercase`}
              >
                Estado
              </th>
              <th
                className={`text-muted-foreground ${cellPx} text-right text-xs font-medium tracking-widest uppercase`}
              >
                Monto Original
              </th>
              <th
                className={`text-muted-foreground ${cellPx} text-right text-xs font-medium tracking-widest uppercase`}
              >
                Abonado
              </th>
              <th
                className={`text-muted-foreground ${cellPx} text-right text-xs font-medium tracking-widest uppercase`}
              >
                Saldo Pendiente
              </th>
              <th
                className={`text-muted-foreground ${cellPx} text-xs font-medium tracking-widest uppercase`}
              >
                Vencimiento
              </th>
              <th
                className={`text-muted-foreground ${cellPx} text-right text-xs font-medium tracking-widest uppercase`}
              >
                Mora
              </th>
              <th
                className={`text-muted-foreground ${cellPx} text-right text-xs font-medium tracking-widest uppercase`}
              >
                Acción
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoadingAR
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-border-subtle border-b">
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} className={cellPx}>
                        <Skeleton className="h-5 w-16" />
                      </td>
                    ))}
                  </tr>
                ))
              : filteredItems.map((ar) => {
                  const customer = customerMap.get(ar.customerId);
                  const daysOverdue = computeDaysOverdue(ar.dueDate);
                  const isOverdue =
                    ar.status === "overdue" ||
                    (ar.balance > 0 && daysOverdue > 0 && ar.status !== "paid");
                  const effectiveStatus = isOverdue ? "overdue" : ar.status;
                  const cfg = STATUS_CONFIG[effectiveStatus] ?? {
                    label: effectiveStatus,
                    tone: "neutral" as StatusTone,
                    icon: "receipt_long",
                  };
                  const balNum = Number(ar.balance);

                  return (
                    <tr
                      key={ar.id}
                      className="border-border-subtle hover:bg-accent/50 border-b transition-colors"
                    >
                      <td className={cellPx}>
                        <Link
                          href={`/accounts-receivable/${ar.id}`}
                          className="text-foreground hover:text-primary block text-xs font-medium transition-colors"
                        >
                          {customer?.name ?? `ID: ${ar.customerId.slice(0, 8)}`}
                        </Link>
                        {customer?.phone && (
                          <span className="text-muted-foreground font-mono text-[10px]">
                            {customer.phone}
                          </span>
                        )}
                      </td>
                      <td
                        className={`text-muted-foreground ${cellPx} font-mono text-xs tabular-nums`}
                      >
                        {ar.orderId ? (
                          <Link
                            href={`/orders/${ar.orderId}`}
                            className="text-primary hover:underline"
                          >
                            {ar.orderId.slice(0, 8)}…
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className={`${cellPx} text-center`}>
                        <StatusBadge tone={cfg.tone}>{cfg.label}</StatusBadge>
                      </td>
                      <td
                        className={`text-muted-foreground ${cellPx} text-right font-mono text-xs tabular-nums`}
                      >
                        ${Number(ar.totalAmount).toFixed(2)}
                      </td>
                      <td
                        className={`text-emerald-500 ${cellPx} text-right font-mono text-xs font-medium tabular-nums`}
                      >
                        ${Number(ar.paidAmount).toFixed(2)}
                      </td>
                      <td
                        className={`text-foreground ${cellPx} text-right font-mono font-medium tabular-nums`}
                      >
                        <span
                          className={
                            balNum > 0
                              ? "text-primary font-medium"
                              : "text-emerald-500"
                          }
                        >
                          ${balNum.toFixed(2)}
                        </span>
                        {bcv.rate > 0 && balNum > 0 && (
                          <p className="text-muted-foreground text-[10px] font-normal tabular-nums">
                            {formatDualCurrency(balNum, bcv.rate).bs}
                          </p>
                        )}
                      </td>
                      <td
                        className={`text-muted-foreground ${cellPx} font-mono text-xs tabular-nums`}
                      >
                        {new Date(ar.dueDate).toLocaleDateString("es-VE")}
                      </td>
                      <td
                        className={`${cellPx} text-right font-mono text-xs tabular-nums ${
                          daysOverdue > 0 && ar.status !== "paid"
                            ? "text-destructive font-medium"
                            : "text-muted-foreground"
                        }`}
                      >
                        {daysOverdue > 0 && ar.status !== "paid"
                          ? `${daysOverdue}d`
                          : "—"}
                      </td>
                      <td className={`${cellPx} text-right`}>
                        <div className="flex items-center justify-end gap-1.5">
                          {balNum > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedArForPayment({
                                  id: ar.id,
                                  balance: balNum,
                                  customerName: customer?.name,
                                  orderId: ar.orderId,
                                })
                              }
                              className="border-border-subtle hover:border-primary hover:text-primary min-h-8 rounded-lg border px-2 py-1 text-xs font-medium transition-colors"
                            >
                              Abonar
                            </button>
                          )}
                          <Link
                            href={`/accounts-receivable/${ar.id}`}
                            className="border-border-subtle hover:bg-accent flex min-h-8 items-center rounded-lg border px-2 py-1 text-xs font-medium transition-colors"
                          >
                            Ver
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}

            {!isLoadingAR && filteredItems.length === 0 && (
              <tr className="hover:bg-transparent">
                <td colSpan={9} className="px-4 py-6">
                  <EmptyState
                    icon="ReceiptLong"
                    title="No se encontraron cuentas"
                    description="No hay cuentas por cobrar que coincidan con los filtros seleccionados."
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      <CreateArDialog open={showCreate} onClose={() => setShowCreate(false)} />

      <RecordArPaymentDialog
        open={selectedArForPayment !== null}
        onClose={() => setSelectedArForPayment(null)}
        receivable={selectedArForPayment}
      />
    </div>
  );
}
