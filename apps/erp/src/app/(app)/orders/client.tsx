"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "~/trpc/client";

const CreateOrderDialog = dynamic(
  () =>
    import("~/components/forms/create-order").then((m) => ({
      default: m.CreateOrderDialog,
    })),
  { ssr: false },
);

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`bg-muted animate-pulse rounded-lg ${className}`} />;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: {
    label: "Pendiente",
    color:
      "bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400",
  },
  confirmed: {
    label: "Confirmado",
    color: "bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400",
  },
  prepared: {
    label: "Preparado",
    color: "bg-cyan-100 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400",
  },
  dispatched: {
    label: "Despachado",
    color:
      "bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400",
  },
  delivered: {
    label: "Entregado",
    color:
      "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
  },
  cancelled: {
    label: "Anulado",
    color: "bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400",
  },
  returned: { label: "Devuelto", color: "bg-secondary text-muted-foreground" },
};

const CHANNEL_ICONS: Record<string, string> = {
  store: "store",
  mercadolibre: "shopping_cart",
  vendors: "local_shipping",
  whatsapp: "chat",
  instagram: "photo_camera",
};

export default function OrdersClient() {
  const trpc = useTRPC();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);

  const { data: orders, isLoading } = useQuery(
    trpc.sales.listOrders.queryOptions({
      limit: 50,
      status:
        statusFilter !== "all"
          ? (statusFilter as
              | "pending"
              | "confirmed"
              | "prepared"
              | "dispatched"
              | "delivered"
              | "cancelled")
          : undefined,
    }),
  );

  const list = orders ?? [];

  return (
    <div className="space-y-6 p-4 lg:p-8">
      {/* Header — stacks vertically on mobile */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-black tracking-tight">
            Órdenes de Venta
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Gestión de pedidos multicanal
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-primary text-primary-foreground hover:bg-primary/90 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition-colors sm:w-auto"
        >
          <span className="material-symbols-outlined text-lg">add</span>
          Nueva Orden
        </button>
      </div>

      <CreateOrderDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          {
            label: "Órdenes",
            value: isLoading ? "—" : list.length,
            icon: "list_alt",
            accent: "border-blue-500/40",
          },
          {
            label: "Total Ingresos",
            value: isLoading
              ? "—"
              : `$${list.reduce((s, o) => s + Number(o.total), 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
            icon: "payments",
            accent: "border-emerald-500/40",
          },
          {
            label: "Total Cobrado",
            value: isLoading
              ? "—"
              : `$${list.reduce((s, o) => s + Number(o.totalPaid), 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
            icon: "check_circle",
            accent: "border-violet-500/40",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className={`rounded-xl border-l-4 ${stat.accent} bg-card border-border border p-4`}
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-muted-foreground text-lg">
                {stat.icon}
              </span>
              <span className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
                {stat.label}
              </span>
            </div>
            <p className="text-foreground mt-1 text-2xl font-bold">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Filter chips — wraps on mobile */}
      <div className="mobile-scroll-x flex gap-2 pb-1">
        {[
          "all",
          "pending",
          "confirmed",
          "prepared",
          "dispatched",
          "delivered",
          "cancelled",
        ].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`min-h-[36px] shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
              statusFilter === s
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:bg-accent"
            }`}
          >
            {s === "all" ? "Todos" : (STATUS_CONFIG[s]?.label ?? s)}
          </button>
        ))}
      </div>

      {/* ── Mobile: Card View ─────────────────────── */}
      <div className="space-y-3 md:hidden">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))
          : list.map((order) => {
              const statusCfg = STATUS_CONFIG[order.status] ?? {
                label: order.status,
                color: "",
              };
              const isPaid = Number(order.totalPaid) >= Number(order.total);
              return (
                <Link
                  key={order.id}
                  href={`/orders/${order.id}`}
                  className="border-border bg-card hover:border-primary/30 block rounded-xl border p-4 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="material-symbols-outlined text-muted-foreground text-lg"
                        title={order.channel}
                      >
                        {CHANNEL_ICONS[order.channel] ?? "list_alt"}
                      </span>
                      <span className="text-primary font-mono text-sm font-bold">
                        {order.orderNumber}
                      </span>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${statusCfg.color}`}
                    >
                      {statusCfg.label}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div>
                      <p className="text-muted-foreground text-[10px] font-bold uppercase">
                        Total
                      </p>
                      <p className="text-foreground font-mono font-bold">
                        ${Number(order.total).toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-muted-foreground text-[10px] font-bold uppercase">
                        Pagado
                      </p>
                      <p
                        className={`font-mono font-bold ${isPaid ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}
                      >
                        ${Number(order.totalPaid).toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <p className="text-muted-foreground mt-2 font-mono text-[10px]">
                    {new Date(order.createdAt).toLocaleString("es-VE")}
                  </p>
                </Link>
              );
            })}
        {!isLoading && list.length === 0 && (
          <div className="text-muted-foreground flex flex-col items-center py-12 text-center">
            <span className="material-symbols-outlined mb-2 text-3xl">
              shopping_cart_off
            </span>
            No se encontraron órdenes
          </div>
        )}
      </div>

      {/* ── Desktop: Table View ───────────────────── */}
      <div className="border-border bg-card hidden overflow-hidden rounded-xl border md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-border text-muted-foreground border-b text-[10px] font-bold tracking-widest uppercase">
              <th className="px-4 py-3">Orden</th>
              <th className="px-4 py-3">Canal</th>
              <th className="px-4 py-3 text-center">Estado</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-right">Pagado</th>
              <th className="px-4 py-3">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-border border-b">
                    <td className="px-4 py-3">
                      <Skeleton className="h-5 w-24" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-5 w-8" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="mx-auto h-5 w-20" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="ml-auto h-5 w-20" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="ml-auto h-5 w-20" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-5 w-28" />
                    </td>
                  </tr>
                ))
              : list.map((order) => {
                  const statusCfg = STATUS_CONFIG[order.status] ?? {
                    label: order.status,
                    color: "",
                  };
                  const isPaid = Number(order.totalPaid) >= Number(order.total);
                  return (
                    <tr
                      key={order.id}
                      className="border-border hover:bg-accent/50 border-b transition-colors"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/orders/${order.id}`}
                          className="text-primary font-mono text-xs font-bold hover:underline"
                        >
                          {order.orderNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="material-symbols-outlined text-muted-foreground text-lg"
                          title={order.channel}
                        >
                          {CHANNEL_ICONS[order.channel] ?? "list_alt"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${statusCfg.color}`}
                        >
                          {statusCfg.label}
                        </span>
                      </td>
                      <td className="text-foreground px-4 py-3 text-right font-mono font-bold">
                        ${Number(order.total).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`font-mono ${isPaid ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}
                        >
                          ${Number(order.totalPaid).toFixed(2)}
                        </span>
                      </td>
                      <td className="text-muted-foreground px-4 py-3 font-mono text-xs">
                        {new Date(order.createdAt).toLocaleString("es-VE")}
                      </td>
                    </tr>
                  );
                })}
            {!isLoading && list.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="text-muted-foreground px-4 py-12 text-center"
                >
                  <span className="material-symbols-outlined mb-2 block text-3xl">
                    shopping_cart_off
                  </span>
                  No se encontraron órdenes
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
