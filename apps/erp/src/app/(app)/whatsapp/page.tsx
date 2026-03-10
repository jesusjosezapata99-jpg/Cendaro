"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "~/trpc/client";

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`bg-muted animate-pulse rounded-lg ${className}`} />;
}

const STATUS_CFG: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendiente", color: "bg-amber-500/20 text-amber-400" },
  confirmed: { label: "Confirmado", color: "bg-blue-500/20 text-primary" },
  delivered: {
    label: "Entregado",
    color: "bg-emerald-500/20 text-emerald-400",
  },
  shipped: { label: "Enviado", color: "bg-cyan-500/20 text-cyan-400" },
  prepared: { label: "Preparado", color: "bg-violet-500/20 text-violet-400" },
  dispatched: {
    label: "Despachado",
    color: "bg-indigo-500/20 text-indigo-400",
  },
  cancelled: { label: "Cancelado", color: "bg-red-500/20 text-red-400" },
  returned: {
    label: "Devuelto",
    color: "bg-slate-500/20 text-muted-foreground",
  },
};

export default function WhatsAppPage() {
  const trpc = useTRPC();
  const { data: orders, isLoading } = useQuery(
    trpc.sales.listOrders.queryOptions({ limit: 50 }),
  );

  // Filter WhatsApp channel orders
  const waOrders = (orders ?? []).filter((o) => o.channel === "whatsapp");
  const todayStr = new Date().toISOString().split("T")[0] ?? "";
  const todayOrders = waOrders.filter((o) =>
    o.createdAt.toString().startsWith(todayStr),
  ).length;
  const todayRevenue = waOrders
    .filter((o) => o.createdAt.toString().startsWith(todayStr))
    .reduce((s, o) => s + Number(o.total), 0);

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-black tracking-tight">
            <span className="mr-2">💬</span>WhatsApp
          </h1>
          <p className="text-muted-foreground text-sm">
            Canal de venta asistida
          </p>
        </div>
        <Link
          href="/orders"
          className="text-foreground rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-emerald-500"
        >
          + Registrar Venta
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        {[
          {
            label: "Pedidos Hoy",
            value: todayOrders,
            icon: "📋",
            accent: "border-emerald-500/40",
          },
          {
            label: "Ingresos Hoy",
            value: `$${todayRevenue.toFixed(2)}`,
            icon: "attach_money",
            accent: "border-blue-500/40",
          },
          {
            label: "Total Pedidos WA",
            value: waOrders.length,
            icon: "chat",
            accent: "border-green-500/40",
          },
          {
            label: "Pendientes",
            value: waOrders.filter((o) => o.status === "pending").length,
            icon: "⏳",
            accent: "border-amber-500/40",
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
              <span className="text-muted-foreground text-xs">
                {stat.label}
              </span>
            </div>
            <p className="text-foreground mt-1 text-2xl font-black tracking-tight">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Info card */}
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
        <div className="flex items-center gap-2">
          <span>ℹ️</span>
          <div>
            <p className="text-sm font-medium text-emerald-400">
              Canal híbrido: WhatsApp consume stock de tienda
            </p>
            <p className="text-xs text-emerald-400/60">
              Las ventas se registran manualmente. Operación ligera.
            </p>
          </div>
        </div>
      </div>

      {/* Orders */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : waOrders.length > 0 ? (
        <div className="border-border bg-card overflow-hidden rounded-xl border">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-border text-muted-foreground border-b text-xs uppercase">
                <th className="px-4 py-3 font-medium">Pedido</th>
                <th className="px-4 py-3 font-medium">Cliente ID</th>
                <th className="px-4 py-3 text-right font-medium">Total USD</th>
                <th className="px-4 py-3 text-center font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {waOrders.map((o) => {
                const cfg = STATUS_CFG[o.status];
                return (
                  <tr
                    key={o.id}
                    className="border-border hover:bg-accent/50 border-b transition-colors"
                  >
                    <td className="text-primary px-4 py-3 font-mono text-xs">
                      {o.orderNumber}
                    </td>
                    <td className="text-muted-foreground px-4 py-3 font-mono text-xs">
                      {o.customerId?.slice(0, 8) ?? "—"}
                    </td>
                    <td className="text-foreground px-4 py-3 text-right font-mono font-bold">
                      ${Number(o.total).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg?.color ?? ""}`}
                      >
                        {cfg?.label ?? o.status}
                      </span>
                    </td>
                    <td className="text-muted-foreground px-4 py-3 font-mono text-xs">
                      {new Date(o.createdAt).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="border-border bg-card text-muted-foreground flex flex-col items-center justify-center rounded-xl border py-12">
          <span className="mb-2 text-4xl">💬</span>
          <p className="text-sm">No hay ventas WhatsApp registradas</p>
          <p className="text-muted-foreground/60 mt-1 text-xs">
            Las ventas de este canal se registran desde Pedidos
          </p>
        </div>
      )}
    </div>
  );
}
