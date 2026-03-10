"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { RoleGuard } from "~/components/role-guard";
import { useTRPC } from "~/trpc/client";

const UpdateOrderStatusDialog = dynamic(
  () =>
    import("~/components/forms/update-order-status").then((m) => ({
      default: m.UpdateOrderStatusDialog,
    })),
  { ssr: false },
);

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`bg-muted animate-pulse rounded-lg ${className}`} />;
}

const STATUS_MAP: Record<string, { label: string; class: string }> = {
  pending: {
    label: "Pendiente",
    class:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  },
  confirmed: {
    label: "Confirmado",
    class: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-primary",
  },
  prepared: {
    label: "Preparado",
    class:
      "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  },
  dispatched: {
    label: "Despachado",
    class: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
  },
  delivered: {
    label: "Entregado",
    class:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  },
  cancelled: {
    label: "Anulado",
    class: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  },
};

export default function OrderDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const trpc = useTRPC();
  const [showStatusDialog, setShowStatusDialog] = useState(false);

  const { data: order, isLoading } = useQuery(
    trpc.sales.orderById.queryOptions({ id }),
  );

  if (isLoading) {
    return (
      <div className="space-y-6 p-4 lg:p-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-muted-foreground flex flex-col items-center justify-center p-12">
        <span className="material-symbols-outlined mb-3 text-5xl">
          search_off
        </span>
        <p className="text-lg font-medium">Pedido no encontrado</p>
        <Link
          href="/orders"
          className="text-primary mt-4 text-sm hover:underline"
        >
          ← Volver a pedidos
        </Link>
      </div>
    );
  }

  const st = STATUS_MAP[order.status] ?? { label: order.status, class: "" };
  const totalPaid = Number(order.totalPaid);
  const total = Number(order.total);
  const balance = total - totalPaid;

  return (
    <div className="space-y-6 p-4 lg:p-8">
      {/* Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Link
            href="/orders"
            className="hover:text-foreground transition-colors"
          >
            Pedidos
          </Link>
          <span className="material-symbols-outlined text-base">
            chevron_right
          </span>
          <span className="text-foreground font-medium">
            {order.orderNumber}
          </span>
        </div>
        <RoleGuard allow={["owner", "admin", "supervisor"]}>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowStatusDialog(true)}
              className="border-border bg-card hover:bg-accent inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
            >
              <span className="material-symbols-outlined text-lg">edit</span>
              Cambiar Estado
            </button>
          </div>
        </RoleGuard>
      </div>

      {showStatusDialog && (
        <UpdateOrderStatusDialog
          open={showStatusDialog}
          onClose={() => setShowStatusDialog(false)}
          orderId={order.id}
          currentStatus={order.status}
        />
      )}

      {/* Header */}
      <div className="border-border bg-card rounded-xl border p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">
                {order.orderNumber}
              </h1>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${st.class}`}
              >
                {st.label}
              </span>
            </div>
            <div className="text-muted-foreground flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <span>
                Canal:{" "}
                <strong className="text-foreground">{order.channel}</strong>
              </span>
              <span>
                Creado:{" "}
                <strong className="text-foreground">
                  {new Date(order.createdAt).toLocaleString("es-VE")}
                </strong>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          {
            label: "Total",
            value: `$${total.toFixed(2)}`,
            icon: "receipt_long",
          },
          {
            label: "Cobrado",
            value: `$${totalPaid.toFixed(2)}`,
            icon: "check_circle",
          },
          {
            label: "Saldo",
            value: `$${balance.toFixed(2)}`,
            icon: "account_balance_wallet",
          },
          { label: "Estado", value: st.label, icon: "flag" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="border-border bg-card rounded-xl border p-4 shadow-sm"
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-muted-foreground text-lg">
                {stat.icon}
              </span>
              <span className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
                {stat.label}
              </span>
            </div>
            <p className="mt-1 text-lg font-bold">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Order metadata */}
      <section className="border-border bg-card rounded-xl border p-6 shadow-sm">
        <h2 className="text-muted-foreground mb-4 text-sm font-bold tracking-widest uppercase">
          Información del Pedido
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { label: "Número", value: order.orderNumber },
            { label: "Canal", value: order.channel },
            { label: "Estado", value: st.label },
            { label: "Total", value: `$${total.toFixed(2)}` },
            { label: "Pagado", value: `$${totalPaid.toFixed(2)}` },
            {
              label: "Creado",
              value: new Date(order.createdAt).toLocaleDateString("es-VE"),
            },
          ].map((a) => (
            <div
              key={a.label}
              className="border-border flex items-center justify-between rounded-lg border p-3"
            >
              <span className="text-muted-foreground text-sm">{a.label}</span>
              <span className="text-sm font-semibold">{a.value}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
