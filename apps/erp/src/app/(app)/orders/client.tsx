"use client";

import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useTRPC } from "~/trpc/client";
import { useQuery } from "@tanstack/react-query";

const CreateOrderDialog = dynamic(
  () => import("~/components/forms/create-order").then((m) => ({ default: m.CreateOrderDialog })),
  { ssr: false },
);

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-muted ${className}`} />;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendiente", color: "bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400" },
  confirmed: { label: "Confirmado", color: "bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400" },
  prepared: { label: "Preparado", color: "bg-cyan-100 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400" },
  dispatched: { label: "Despachado", color: "bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400" },
  delivered: { label: "Entregado", color: "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" },
  cancelled: { label: "Anulado", color: "bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400" },
  returned: { label: "Devuelto", color: "bg-secondary text-muted-foreground" },
};

const CHANNEL_ICONS: Record<string, string> = {
  store: "store", mercadolibre: "shopping_cart", vendors: "local_shipping",
  whatsapp: "chat", instagram: "photo_camera",
};

export default function OrdersClient() {
  const trpc = useTRPC();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);

  const { data: orders, isLoading } = useQuery(
    trpc.sales.listOrders.queryOptions({
      limit: 50,
      status: statusFilter !== "all" ? (statusFilter as "pending" | "confirmed" | "prepared" | "dispatched" | "delivered" | "cancelled") : undefined,
    }),
  );

  const list = orders ?? [];

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">Órdenes de Venta</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestión de pedidos multicanal</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90">
          <span className="material-symbols-outlined text-lg">add</span>
          Nueva Orden
        </button>
      </div>

      <CreateOrderDialog open={showCreate} onClose={() => setShowCreate(false)} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: "Órdenes", value: isLoading ? "—" : list.length, icon: "list_alt", accent: "border-blue-500/40" },
          { label: "Total Ingresos", value: isLoading ? "—" : `$${list.reduce((s, o) => s + Number(o.total), 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`, icon: "payments", accent: "border-emerald-500/40" },
          { label: "Total Cobrado", value: isLoading ? "—" : `$${list.reduce((s, o) => s + Number(o.totalPaid), 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`, icon: "check_circle", accent: "border-violet-500/40" },
        ].map((stat) => (
          <div key={stat.label} className={`rounded-xl border-l-4 ${stat.accent} bg-card border border-border p-4`}>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-lg text-muted-foreground">{stat.icon}</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{stat.label}</span>
            </div>
            <p className="mt-1 text-2xl font-bold text-foreground">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {["all", "pending", "confirmed", "prepared", "dispatched", "delivered", "cancelled"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
              statusFilter === s ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-accent"
            }`}
          >
            {s === "all" ? "Todos" : STATUS_CONFIG[s]?.label ?? s}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
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
                  <tr key={i} className="border-b border-border">
                    <td className="px-4 py-3"><Skeleton className="h-5 w-24" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-5 w-8" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-5 w-20 mx-auto" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-5 w-20 ml-auto" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-5 w-20 ml-auto" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-5 w-28" /></td>
                  </tr>
                ))
              : list.map((order) => {
                  const statusCfg = STATUS_CONFIG[order.status] ?? { label: order.status, color: "" };
                  const isPaid = Number(order.totalPaid) >= Number(order.total);
                  return (
                    <tr key={order.id} className="border-b border-border transition-colors hover:bg-accent/50">
                      <td className="px-4 py-3">
                        <Link href={`/orders/${order.id}`} className="font-mono text-xs font-bold text-primary hover:underline">
                          {order.orderNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className="material-symbols-outlined text-lg text-muted-foreground" title={order.channel}>
                          {CHANNEL_ICONS[order.channel] ?? "list_alt"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${statusCfg.color}`}>
                          {statusCfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-foreground">
                        ${Number(order.total).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-mono ${isPaid ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                          ${Number(order.totalPaid).toFixed(2)}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {new Date(order.createdAt).toLocaleString("es-VE")}
                      </td>
                    </tr>
                  );
                })}
            {!isLoading && list.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                  <span className="material-symbols-outlined text-3xl mb-2 block">shopping_cart_off</span>
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
