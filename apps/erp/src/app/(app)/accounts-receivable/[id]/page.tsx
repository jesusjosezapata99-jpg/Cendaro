"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useTRPC } from "~/trpc/client";
import { useQuery } from "@tanstack/react-query";

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-muted ${className}`} />;
}

const STATUS_MAP: Record<string, { label: string; class: string }> = {
  pending: { label: "Pendiente", class: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  partial: { label: "Pago Parcial", class: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-primary" },
  paid: { label: "Pagado", class: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  overdue: { label: "Vencido", class: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
};

export default function ARDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const trpc = useTRPC();

  const { data: entry, isLoading } = useQuery(
    trpc.vendor.arById.queryOptions({ id }),
  );

  if (isLoading) {
    return (
      <div className="p-4 lg:p-8 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
        <span className="material-symbols-outlined text-5xl mb-3">credit_card_off</span>
        <p className="text-lg font-medium">Cuenta por cobrar no encontrada</p>
        <Link href="/accounts-receivable" className="mt-4 text-sm text-primary hover:underline">← Volver a CxC</Link>
      </div>
    );
  }

  const st = STATUS_MAP[entry.status] ?? { label: entry.status, class: "" };
  const paidPercent = entry.totalAmount > 0 ? (Number(entry.paidAmount) / Number(entry.totalAmount)) * 100 : 0;
  const daysTodue = Math.ceil((new Date(entry.dueDate).getTime() - Date.now()) / 86400000);

  return (
    <div className="p-4 lg:p-8 space-y-6">
      {/* Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/accounts-receivable" className="hover:text-foreground transition-colors">CxC</Link>
          <span className="material-symbols-outlined text-base">chevron_right</span>
          <span className="font-medium text-foreground">{entry.id.slice(0, 8)}…</span>
        </div>
      </div>

      {/* Header */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold tracking-tight">CxC #{entry.id.slice(0, 8)}</h1>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${st.class}`}>
                {st.label}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
              {entry.customerName && (
                <span>
                  Cliente:{" "}
                  <Link href={`/customers/${entry.customerId}`} className="font-semibold text-primary hover:underline">
                    {entry.customerName}
                  </Link>
                </span>
              )}
              {entry.customerIdentification && (
                <span>RIF: <strong className="text-foreground">{entry.customerIdentification}</strong></span>
              )}
              {entry.orderId && (
                <span>
                  Pedido:{" "}
                  <Link href={`/orders/${entry.orderId}`} className="font-semibold text-primary hover:underline">
                    {entry.orderId.slice(0, 8)}…
                  </Link>
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">${Number(entry.balance).toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">saldo pendiente</p>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Monto Original", value: `$${Number(entry.totalAmount).toFixed(2)}`, icon: "receipt_long" },
          { label: "Pagado", value: `$${Number(entry.paidAmount).toFixed(2)}`, icon: "check_circle" },
          { label: "Saldo", value: `$${Number(entry.balance).toFixed(2)}`, icon: "account_balance_wallet" },
          { label: "Vence", value: daysTodue > 0 ? `${daysTodue} días` : "Vencido", icon: daysTodue > 0 ? "schedule" : "warning" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-lg text-muted-foreground">{stat.icon}</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{stat.label}</span>
            </div>
            <p className="mt-1 text-xl font-bold">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Progreso de cobro</span>
          <span className="font-bold">{paidPercent.toFixed(1)}%</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.min(paidPercent, 100)}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>Cobrado: ${Number(entry.paidAmount).toFixed(2)}</span>
          <span>Total: ${Number(entry.totalAmount).toFixed(2)}</span>
        </div>
      </div>

      {/* Notes */}
      {entry.notes && (
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-widest text-muted-foreground">Notas</h2>
          <p className="text-sm text-foreground">{entry.notes}</p>
        </div>
      )}
    </div>
  );
}
