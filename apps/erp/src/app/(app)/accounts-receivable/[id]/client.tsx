"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@cendaro/ui";
import { Icons } from "@cendaro/ui/icons";

import type { StatusTone } from "~/components/status-badge";
import { EmptyState } from "~/components/empty-state";
import { RoleGuard } from "~/components/role-guard";
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

export default function ArDetailClient() {
  const params = useParams();
  const id = params.id as string;
  const trpc = useTRPC();
  const bcv = useBcvRate();

  const [showPayment, setShowPayment] = useState(false);

  const { data: entry, isLoading } = useQuery(
    trpc.vendor.arById.queryOptions({ id }),
  );

  const daysToDue = useMemo(() => {
    if (!entry?.dueDate) return 0;
    const now = new Date();
    return Math.ceil(
      (new Date(entry.dueDate).getTime() - now.getTime()) /
        (1000 * 60 * 60 * 24),
    );
  }, [entry?.dueDate]);

  const daysOverdue = useMemo(() => {
    if (!entry?.dueDate) return 0;
    const now = new Date();
    const diff = Math.floor(
      (now.getTime() - new Date(entry.dueDate).getTime()) /
        (1000 * 60 * 60 * 24),
    );
    return diff > 0 ? diff : 0;
  }, [entry?.dueDate]);

  if (isLoading) {
    return (
      <div className="space-y-6 py-4 lg:py-8">
        <div className="bg-muted h-6 w-48 animate-pulse rounded-lg" />
        <div className="border-border-subtle surface-card h-40 animate-pulse rounded-xl border" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="border-border-subtle surface-card h-28 animate-pulse rounded-xl border"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="space-y-6 py-4 lg:py-8">
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Link
            href="/accounts-receivable"
            className="hover:text-foreground transition-colors"
          >
            Cuentas por Cobrar
          </Link>
          <Icons.ChevronRight className="size-4" />
          <span className="text-foreground font-mono text-xs font-medium">
            {id.slice(0, 8)}…
          </span>
        </div>
        <EmptyState
          icon="CreditCardOff"
          title="Cuenta por cobrar no encontrada"
          description="El registro solicitado no existe o no se tienen permisos para visualizarlo."
          action={
            <Link
              href="/accounts-receivable"
              className="text-primary text-xs font-medium hover:underline"
            >
              ← Volver a Cuentas por Cobrar
            </Link>
          }
        />
      </div>
    );
  }

  const isOverdue =
    entry.status === "overdue" ||
    (entry.balance > 0 && daysOverdue > 0 && entry.status !== "paid");
  const effectiveStatus = isOverdue ? "overdue" : entry.status;
  const cfg = STATUS_CONFIG[effectiveStatus] ?? {
    label: effectiveStatus,
    tone: "neutral" as StatusTone,
    icon: "receipt_long",
  };

  const totalAmount = Number(entry.totalAmount);
  const paidAmount = Number(entry.paidAmount);
  const balance = Number(entry.balance);
  const paidPercent =
    totalAmount > 0 ? Math.min(100, (paidAmount / totalAmount) * 100) : 0;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 space-y-6 py-4 duration-200 lg:py-8">
      {/* Breadcrumb Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Link
            href="/accounts-receivable"
            className="hover:text-foreground flex items-center gap-1 transition-colors"
          >
            <Icons.ArrowBack className="size-4" />
            Cuentas por Cobrar
          </Link>
          <Icons.ChevronRight className="size-4" />
          <span className="text-foreground font-mono text-xs font-medium">
            #{entry.id.slice(0, 8)}
          </span>
        </div>

        {balance > 0 && (
          <RoleGuard allow={["owner", "admin", "supervisor", "employee"]}>
            <Button
              onClick={() => setShowPayment(true)}
              className="min-h-11 flex-1 sm:flex-initial"
            >
              <Icons.Payments className="size-4.5" />
              Registrar Abono
            </Button>
          </RoleGuard>
        )}
      </div>

      {/* Header Account Card */}
      <div className="border-border-subtle surface-card rounded-xl border p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h1 className="text-foreground font-mono text-xl font-medium tracking-tight">
                CxC #{entry.id.slice(0, 8)}
              </h1>
              <StatusBadge tone={cfg.tone}>{cfg.label}</StatusBadge>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 text-xs">
              {entry.customerName && (
                <div>
                  <span className="text-muted-foreground mr-1">Cliente:</span>
                  <Link
                    href={`/customers/${entry.customerId}`}
                    className="text-primary font-medium hover:underline"
                  >
                    {entry.customerName}
                  </Link>
                </div>
              )}
              {entry.customerIdentification && (
                <div>
                  <span className="text-muted-foreground mr-1">
                    RIF / Cédula:
                  </span>
                  <span className="text-foreground font-mono font-medium">
                    {entry.customerIdentification}
                  </span>
                </div>
              )}
              {entry.orderId && (
                <div>
                  <span className="text-muted-foreground mr-1">
                    Pedido Vinculado:
                  </span>
                  <Link
                    href={`/orders/${entry.orderId}`}
                    className="text-primary font-mono hover:underline"
                  >
                    {entry.orderId.slice(0, 8)}…
                  </Link>
                </div>
              )}
              <div>
                <span className="text-muted-foreground mr-1">
                  Fecha Emisión:
                </span>
                <span className="text-foreground font-mono tabular-nums">
                  {new Date(entry.createdAt).toLocaleDateString("es-VE")}
                </span>
              </div>
            </div>
          </div>

          <div className="text-right">
            <p className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
              Saldo Pendiente
            </p>
            <p
              className={`font-mono text-2xl font-medium tabular-nums ${
                balance > 0 ? "text-primary" : "text-emerald-500"
              }`}
            >
              ${balance.toFixed(2)}
            </p>
            {bcv.rate > 0 && balance > 0 && (
              <p className="text-muted-foreground font-mono text-xs tabular-nums">
                {formatDualCurrency(balance, bcv.rate).bs}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <StatCard
          label="Monto Original"
          value={formatDualCurrency(totalAmount, bcv.rate).usd}
          sub={
            bcv.rate > 0
              ? formatDualCurrency(totalAmount, bcv.rate).bs
              : undefined
          }
          icon="ReceiptLong"
        />
        <StatCard
          label="Total Cobrado"
          value={formatDualCurrency(paidAmount, bcv.rate).usd}
          sub={
            bcv.rate > 0
              ? formatDualCurrency(paidAmount, bcv.rate).bs
              : undefined
          }
          icon="CheckCircle"
          tone="success"
        />
        <StatCard
          label="Saldo Restante"
          value={formatDualCurrency(balance, bcv.rate).usd}
          sub={
            bcv.rate > 0 ? formatDualCurrency(balance, bcv.rate).bs : undefined
          }
          icon="Payments"
          tone={balance > 0 ? "primary" : "default"}
        />
        <StatCard
          label="Vencimiento"
          value={
            entry.status === "paid"
              ? "Liquidada"
              : daysOverdue > 0
                ? `${daysOverdue} días de mora`
                : `${daysToDue} días restantes`
          }
          sub={`Plazo: ${new Date(entry.dueDate).toLocaleDateString("es-VE")}`}
          icon={daysOverdue > 0 ? "Warning" : "Schedule"}
          tone={
            entry.status === "paid"
              ? "success"
              : daysOverdue > 0
                ? "destructive"
                : daysToDue <= 7
                  ? "warning"
                  : "default"
          }
        />
      </div>

      {/* Collection Progress Card */}
      <div className="border-border-subtle surface-card rounded-xl border p-5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground font-medium">
            Progreso de Cobranza
          </span>
          <span className="text-foreground font-mono font-medium tabular-nums">
            {paidPercent.toFixed(1)}%
          </span>
        </div>
        <div className="bg-muted mt-2 h-2.5 w-full overflow-hidden rounded-full">
          <div
            className="bg-primary h-full rounded-full transition-all duration-500"
            style={{ width: `${paidPercent}%` }}
          />
        </div>
        <div className="text-muted-foreground mt-2 flex items-center justify-between text-xs">
          <span className="font-mono tabular-nums">
            Cobrado: ${paidAmount.toFixed(2)}
          </span>
          <span className="font-mono tabular-nums">
            Total: ${totalAmount.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Notes / Terms Card */}
      {entry.notes && (
        <div className="border-border-subtle surface-card rounded-xl border p-5">
          <h2 className="text-muted-foreground mb-2 text-xs font-medium tracking-wider uppercase">
            Notas y Términos Comerciales
          </h2>
          <p className="text-foreground text-sm leading-relaxed">
            {entry.notes}
          </p>
        </div>
      )}

      {/* Modal for recording payment */}
      <RecordArPaymentDialog
        open={showPayment}
        onClose={() => setShowPayment(false)}
        receivable={{
          id: entry.id,
          balance,
          totalAmount,
          customerName: entry.customerName ?? undefined,
          orderId: entry.orderId,
        }}
      />
    </div>
  );
}
