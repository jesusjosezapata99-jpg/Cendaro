"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@cendaro/ui";

import type { StatusTone } from "~/components/status-badge";
import { EmptyState } from "~/components/empty-state";
import { PageHeader } from "~/components/page-header";
import { Skeleton } from "~/components/skeleton";
import { StatCard } from "~/components/stat-card";
import { StatusBadge } from "~/components/status-badge";
import { useBcvRate } from "~/hooks/use-bcv-rate";
import { formatDualCurrency } from "~/lib/format-currency";
import { useTRPC } from "~/trpc/client";

const CreateOrderDialog = dynamic(
  () =>
    import("~/components/forms/create-order").then((m) => ({
      default: m.CreateOrderDialog,
    })),
  { ssr: false },
);

/** Order status → semantic token chip (single source of truth). */
const STATUS_CONFIG: Record<string, { label: string; tone: StatusTone }> = {
  draft: { label: "Borrador", tone: "neutral" },
  pending: { label: "Pendiente", tone: "warning" },
  pending_confirmation: { label: "Por Confirmar", tone: "warning" },
  confirmed: { label: "Confirmado", tone: "primary" },
  prepared: { label: "Preparado", tone: "primary" },
  dispatched: { label: "Despachado", tone: "primary" },
  delivered: { label: "Entregado", tone: "success" },
  invoiced: { label: "Facturado", tone: "primary" },
  cancelled: { label: "Anulado", tone: "destructive" },
  returned: { label: "Devuelto", tone: "neutral" },
};

const CHANNEL_ICONS: Record<string, string> = {
  store: "store",
  mercadolibre: "shopping_cart",
  vendors: "local_shipping",
  whatsapp: "chat",
  instagram: "photo_camera",
};

/** Shared cell padding for the orders table. */
const cellPx = "px-4 py-3";

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
              | "draft"
              | "pending"
              | "pending_confirmation"
              | "confirmed"
              | "prepared"
              | "dispatched"
              | "delivered"
              | "invoiced"
              | "cancelled"
              | "returned")
          : undefined,
    }),
  );

  const list = orders ?? [];
  const bcv = useBcvRate();
  const totalIngresos = list.reduce((s, o) => s + Number(o.total), 0);
  const totalCobrado = list.reduce((s, o) => s + Number(o.totalPaid), 0);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 space-y-6 p-4 duration-200 lg:p-8">
      <PageHeader
        title="Órdenes de Venta"
        description="Gestión de pedidos multicanal"
        actions={
          <div className="flex w-full gap-2 sm:w-auto">
            <Button
              onClick={() => setShowCreate(true)}
              className="min-h-11 flex-1 sm:flex-initial"
            >
              <span className="material-symbols-outlined text-lg">add</span>
              Nueva Orden
            </Button>
          </div>
        }
      />

      <CreateOrderDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="Órdenes"
          value={isLoading ? "—" : list.length.toLocaleString("es-VE")}
          icon="list_alt"
        />
        <StatCard
          label="Total Ingresos"
          value={
            isLoading ? "—" : formatDualCurrency(totalIngresos, bcv.rate).usd
          }
          sub={
            isLoading
              ? undefined
              : formatDualCurrency(totalIngresos, bcv.rate).bs
          }
          icon="payments"
          tone="primary"
        />
        <StatCard
          label="Total Cobrado"
          value={
            isLoading ? "—" : formatDualCurrency(totalCobrado, bcv.rate).usd
          }
          sub={
            isLoading
              ? undefined
              : formatDualCurrency(totalCobrado, bcv.rate).bs
          }
          icon="check_circle"
          tone="success"
        />
      </div>

      {/* Filter chips — wraps on mobile */}
      <div className="mobile-scroll-x flex gap-2 pb-1">
        {["all", ...Object.keys(STATUS_CONFIG)].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`min-h-9 shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              statusFilter === s
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border-subtle text-muted-foreground hover:bg-accent/50 hover:text-foreground"
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
              <div
                key={i}
                className="border-border-subtle surface-card rounded-xl border p-4"
              >
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="mt-2 h-4 w-24" />
              </div>
            ))
          : list.map((order) => {
              const statusCfg = STATUS_CONFIG[order.status] ?? {
                label: order.status,
                tone: "neutral" as StatusTone,
              };
              const isPaid = Number(order.totalPaid) >= Number(order.total);
              return (
                <Link
                  key={order.id}
                  href={`/orders/${order.id}`}
                  className="border-border-subtle surface-card hover:border-primary/30 block rounded-xl border p-4 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className="material-symbols-outlined text-muted-foreground text-lg"
                        title={order.channel}
                      >
                        {CHANNEL_ICONS[order.channel] ?? "list_alt"}
                      </span>
                      <span className="text-primary font-mono text-sm font-semibold tabular-nums">
                        {order.orderNumber}
                      </span>
                    </div>
                    <StatusBadge tone={statusCfg.tone}>
                      {statusCfg.label}
                    </StatusBadge>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div>
                      <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                        Total
                      </p>
                      <p className="text-foreground font-mono font-semibold tabular-nums">
                        ${Number(order.total).toFixed(2)}
                      </p>
                      {bcv.rate > 0 && (
                        <p className="text-muted-foreground text-xs">
                          {formatDualCurrency(Number(order.total), bcv.rate).bs}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                        Pagado
                      </p>
                      <p
                        className={`font-mono font-semibold tabular-nums ${
                          isPaid ? "text-success-soft" : "text-warning-soft"
                        }`}
                      >
                        ${Number(order.totalPaid).toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <p className="text-muted-foreground mt-2 font-mono text-xs tabular-nums">
                    {new Date(order.createdAt).toLocaleString("es-VE")}
                  </p>
                </Link>
              );
            })}
        {!isLoading && list.length === 0 && (
          <EmptyState
            icon="shopping_cart_off"
            title="No se encontraron órdenes"
            description="Ajusta el filtro de estado o crea una nueva orden para comenzar."
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
                Orden
              </th>
              <th
                className={`text-muted-foreground ${cellPx} text-xs font-medium tracking-widest uppercase`}
              >
                Canal
              </th>
              <th
                className={`text-muted-foreground ${cellPx} text-center text-xs font-medium tracking-widest uppercase`}
              >
                Estado
              </th>
              <th
                className={`text-muted-foreground ${cellPx} text-right text-xs font-medium tracking-widest uppercase`}
              >
                Total
              </th>
              <th
                className={`text-muted-foreground ${cellPx} text-right text-xs font-medium tracking-widest uppercase`}
              >
                Pagado
              </th>
              <th
                className={`text-muted-foreground ${cellPx} text-xs font-medium tracking-widest uppercase`}
              >
                Fecha
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-border-subtle border-b">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className={cellPx}>
                        <Skeleton className="h-5 w-16" />
                      </td>
                    ))}
                  </tr>
                ))
              : list.map((order) => {
                  const statusCfg = STATUS_CONFIG[order.status] ?? {
                    label: order.status,
                    tone: "neutral" as StatusTone,
                  };
                  const isPaid = Number(order.totalPaid) >= Number(order.total);
                  return (
                    <tr
                      key={order.id}
                      className="border-border-subtle hover:bg-accent/50 border-b transition-colors"
                    >
                      <td className={cellPx}>
                        <Link
                          href={`/orders/${order.id}`}
                          className="text-primary font-mono text-xs font-semibold tabular-nums hover:underline"
                        >
                          {order.orderNumber}
                        </Link>
                      </td>
                      <td className={cellPx}>
                        <span
                          aria-hidden
                          className="material-symbols-outlined text-muted-foreground text-lg"
                          title={order.channel}
                        >
                          {CHANNEL_ICONS[order.channel] ?? "list_alt"}
                        </span>
                      </td>
                      <td className={`${cellPx} text-center`}>
                        <StatusBadge tone={statusCfg.tone}>
                          {statusCfg.label}
                        </StatusBadge>
                      </td>
                      <td
                        className={`text-foreground ${cellPx} text-right font-mono font-semibold tabular-nums`}
                      >
                        ${Number(order.total).toFixed(2)}
                        {bcv.rate > 0 && (
                          <span className="text-muted-foreground ml-1 text-xs font-normal tabular-nums">
                            {
                              formatDualCurrency(Number(order.total), bcv.rate)
                                .bs
                            }
                          </span>
                        )}
                      </td>
                      <td
                        className={`${cellPx} text-right font-mono font-semibold tabular-nums ${
                          isPaid ? "text-success-soft" : "text-warning-soft"
                        }`}
                      >
                        ${Number(order.totalPaid).toFixed(2)}
                        {bcv.rate > 0 && (
                          <span className="text-muted-foreground ml-1 text-xs font-normal tabular-nums">
                            {
                              formatDualCurrency(
                                Number(order.totalPaid),
                                bcv.rate,
                              ).bs
                            }
                          </span>
                        )}
                      </td>
                      <td
                        className={`text-muted-foreground ${cellPx} font-mono text-xs tabular-nums`}
                      >
                        {new Date(order.createdAt).toLocaleString("es-VE")}
                      </td>
                    </tr>
                  );
                })}
            {!isLoading && list.length === 0 && (
              <tr className="hover:bg-transparent">
                <td colSpan={6} className="px-4 py-6">
                  <EmptyState
                    icon="shopping_cart_off"
                    title="No se encontraron órdenes"
                    description="Ajusta el filtro de estado o crea una nueva orden para comenzar."
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
