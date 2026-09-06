"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@cendaro/ui";

import type { StatusTone } from "~/components/status-badge";
import { EmptyState } from "~/components/empty-state";
import { PageHeader } from "~/components/page-header";
import { Skeleton } from "~/components/skeleton";
import { StatCard } from "~/components/stat-card";
import { StatusBadge } from "~/components/status-badge";
import { useBcvRate } from "~/hooks/use-bcv-rate";
import { formatDualCurrency } from "~/lib/format-currency";
import { useTRPC } from "~/trpc/client";

const DeliveryNoteVoucherDialog = dynamic(
  () =>
    import("~/components/modals/delivery-note-voucher-dialog").then((m) => ({
      default: m.DeliveryNoteVoucherDialog,
    })),
  { ssr: false },
);

const STATUS_CONFIG: Record<string, { label: string; tone: StatusTone }> = {
  draft: { label: "Borrador", tone: "neutral" },
  pending: { label: "Pendiente", tone: "warning" },
  pending_confirmation: { label: "Por Confirmar", tone: "warning" },
  confirmed: { label: "Por Preparar", tone: "primary" },
  prepared: { label: "Listo p/ Despacho", tone: "warning" },
  dispatched: { label: "En Tránsito", tone: "primary" },
  delivered: { label: "Entregado", tone: "success" },
  invoiced: { label: "Completado", tone: "success" },
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

const CHANNEL_LABELS: Record<string, string> = {
  store: "Tienda / Retiro",
  mercadolibre: "Mercado Libre",
  vendors: "Vendedores",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
};

export default function DeliveryNotesClient() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const bcv = useBcvRate();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const { data: ordersData, isLoading: ordersLoading } = useQuery(
    trpc.sales.listOrders.queryOptions({ limit: 100 }),
  );

  const { data: customersData } = useQuery(
    trpc.sales.listCustomers.queryOptions({ limit: 100 }),
  );

  const updateStatus = useMutation(
    trpc.sales.updateOrderStatus.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: [["sales"]] });
      },
    }),
  );

  const customerMap = useMemo(() => {
    return new Map((customersData ?? []).map((c) => [c.id, c.name]));
  }, [customersData]);

  const orders = useMemo(() => ordersData ?? [], [ordersData]);

  // Filter notes based on selection and search
  const filteredNotes = useMemo(() => {
    return orders.filter((order) => {
      // Stage filtering
      if (
        filter === "to_dispatch" &&
        order.status !== "prepared" &&
        order.status !== "confirmed"
      ) {
        return false;
      }
      if (filter === "dispatched" && order.status !== "dispatched") {
        return false;
      }
      if (
        filter === "delivered" &&
        order.status !== "delivered" &&
        order.status !== "invoiced"
      ) {
        return false;
      }
      if (filter === "pending" && order.status !== "pending") {
        return false;
      }

      // Text search
      if (search.trim()) {
        const q = search.toLowerCase();
        const noteNum = `NE-${order.orderNumber}`.toLowerCase();
        const orderNum = order.orderNumber.toLowerCase();
        const customerName = (
          (order.customerId ? customerMap.get(order.customerId) : null) ??
          "Cliente Ocasional"
        ).toLowerCase();

        return (
          noteNum.includes(q) ||
          orderNum.includes(q) ||
          customerName.includes(q)
        );
      }

      return true;
    });
  }, [orders, filter, search, customerMap]);

  // Aggregate metrics
  const totalDespachos = orders.length;
  const porDespacharCount = orders.filter(
    (o) => o.status === "prepared" || o.status === "confirmed",
  ).length;
  const enTransitoCount = orders.filter(
    (o) => o.status === "dispatched",
  ).length;
  const entregadasCount = orders.filter(
    (o) => o.status === "delivered" || o.status === "invoiced",
  ).length;

  const handleAdvanceStatus = (orderId: string, currentStatus: string) => {
    if (currentStatus === "confirmed" || currentStatus === "prepared") {
      updateStatus.mutate({ id: orderId, status: "dispatched" });
    } else if (currentStatus === "dispatched") {
      updateStatus.mutate({ id: orderId, status: "delivered" });
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 space-y-6 p-4 duration-200 lg:p-8">
      {/* Page Header */}
      <PageHeader
        title="Notas de Entrega & Despacho"
        description="Control logístico de expedición, control de transporte y confirmación de recepción"
        actions={
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <Button
              variant="outline"
              onClick={() => setSelectedOrderId("preview")}
              className="min-h-11 flex-1 sm:flex-initial"
            >
              <span className="material-symbols-outlined text-lg">
                local_shipping
              </span>
              Modelo Guía
            </Button>
            <Button asChild className="min-h-11 flex-1 sm:flex-initial">
              <Link href="/orders">
                <span className="material-symbols-outlined text-lg">add</span>
                Nuevo Despacho / Pedido
              </Link>
            </Button>
          </div>
        }
      />

      {/* 4 StatCards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Despachos"
          value={ordersLoading ? "—" : totalDespachos.toLocaleString("es-VE")}
          icon="local_shipping"
        />
        <StatCard
          label="Por Despachar"
          value={
            ordersLoading ? "—" : porDespacharCount.toLocaleString("es-VE")
          }
          icon="schedule"
          tone="warning"
        />
        <StatCard
          label="En Tránsito"
          value={ordersLoading ? "—" : enTransitoCount.toLocaleString("es-VE")}
          icon="flight_takeoff"
          tone="primary"
        />
        <StatCard
          label="Entregadas"
          value={ordersLoading ? "—" : entregadasCount.toLocaleString("es-VE")}
          icon="check_circle"
          tone="success"
        />
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <span className="material-symbols-outlined text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2 text-lg">
            search
          </span>
          <input
            type="text"
            placeholder="Buscar por Nota #, Orden # o Destinatario..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-border bg-card text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/20 w-full rounded-xl border py-2.5 pr-4 pl-10 text-sm focus:ring-2 focus:outline-none"
          />
        </div>

        {/* Filter chips */}
        <div className="mobile-scroll-x flex gap-2 pb-1">
          {[
            { key: "all", label: "Todas" },
            { key: "to_dispatch", label: "Por Despachar" },
            { key: "dispatched", label: "En Tránsito" },
            { key: "delivered", label: "Entregadas" },
            { key: "pending", label: "Pendientes" },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`min-h-9 shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === f.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border-subtle text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Mobile: Card View ─────────────────────── */}
      <div className="space-y-3 md:hidden">
        {ordersLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="border-border-subtle surface-card space-y-2 rounded-xl border p-4"
            >
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-6 w-1/3" />
            </div>
          ))
        ) : filteredNotes.length === 0 ? (
          <EmptyState
            icon="local_shipping"
            title="No se encontraron notas de entrega"
            description="No hay guías de despacho que coincidan con los criterios de búsqueda o filtro."
            action={
              filter !== "all" || search ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setFilter("all");
                    setSearch("");
                  }}
                >
                  Restablecer Filtros
                </Button>
              ) : undefined
            }
          />
        ) : (
          filteredNotes.map((order) => {
            const customerName =
              (order.customerId ? customerMap.get(order.customerId) : null) ??
              "Cliente Mostrador";

            const statusCfg = STATUS_CONFIG[order.status] ?? {
              label: order.status,
              tone: "neutral" as StatusTone,
            };

            const canDispatch =
              order.status === "confirmed" || order.status === "prepared";
            const canDeliver = order.status === "dispatched";

            return (
              <div
                key={order.id}
                className="border-border-subtle surface-card space-y-3 rounded-xl border p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="material-symbols-outlined text-muted-foreground text-lg"
                      title={order.channel}
                    >
                      {CHANNEL_ICONS[order.channel] ?? "local_shipping"}
                    </span>
                    <span className="text-primary font-mono text-sm font-bold tabular-nums">
                      NE-{order.orderNumber}
                    </span>
                  </div>
                  <StatusBadge tone={statusCfg.tone}>
                    {statusCfg.label}
                  </StatusBadge>
                </div>

                <div className="space-y-1 text-xs">
                  <p className="text-foreground text-sm font-semibold">
                    {customerName}
                  </p>
                  <p className="text-muted-foreground font-mono">
                    Orden: {order.orderNumber} ·{" "}
                    {new Date(order.createdAt).toLocaleDateString("es-VE")}
                  </p>
                </div>

                <div className="border-border-subtle flex items-baseline justify-between border-t pt-2">
                  <div>
                    <span className="text-muted-foreground text-[10px] font-bold uppercase">
                      Valor Carga
                    </span>
                    <p className="text-foreground font-mono text-base font-bold tabular-nums">
                      ${Number(order.total).toFixed(2)} USD
                    </p>
                    <p className="text-muted-foreground font-mono text-xs tabular-nums">
                      {formatDualCurrency(order.total, bcv.rate).bs}
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    {canDispatch && (
                      <Button
                        size="sm"
                        disabled={updateStatus.isPending}
                        onClick={() =>
                          handleAdvanceStatus(order.id, order.status)
                        }
                        className="min-h-9 text-xs"
                      >
                        <span className="material-symbols-outlined text-base">
                          flight_takeoff
                        </span>
                        Despachar
                      </Button>
                    )}
                    {canDeliver && (
                      <Button
                        size="sm"
                        disabled={updateStatus.isPending}
                        onClick={() =>
                          handleAdvanceStatus(order.id, order.status)
                        }
                        className="min-h-9 text-xs"
                      >
                        <span className="material-symbols-outlined text-base">
                          check_circle
                        </span>
                        Entregar
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedOrderId(order.id)}
                      className="min-h-9 text-xs"
                    >
                      <span className="material-symbols-outlined text-base">
                        local_shipping
                      </span>
                      Guía
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="min-h-9 text-xs"
                    >
                      <Link href={`/orders/${order.id}`}>
                        <span className="material-symbols-outlined text-base">
                          open_in_new
                        </span>
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Desktop: Table View ───────────────────── */}
      <div className="hidden md:block">
        <div className="border-border-subtle surface-card overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-4 py-3 text-xs font-semibold uppercase">
                  Nota #
                </TableHead>
                <TableHead className="px-4 py-3 text-xs font-semibold uppercase">
                  Orden Ref.
                </TableHead>
                <TableHead className="px-4 py-3 text-xs font-semibold uppercase">
                  Cliente / Destino
                </TableHead>
                <TableHead className="px-4 py-3 text-xs font-semibold uppercase">
                  Canal
                </TableHead>
                <TableHead className="px-4 py-3 text-xs font-semibold uppercase">
                  Fecha Emisión
                </TableHead>
                <TableHead className="px-4 py-3 text-right text-xs font-semibold uppercase">
                  Valor Declarado
                </TableHead>
                <TableHead className="px-4 py-3 text-center text-xs font-semibold uppercase">
                  Estado
                </TableHead>
                <TableHead className="px-4 py-3 text-center text-xs font-semibold uppercase">
                  Acción Rápida
                </TableHead>
                <TableHead className="px-4 py-3 text-right text-xs font-semibold uppercase">
                  Guía / Detalle
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ordersLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <TableCell key={j} className="px-4 py-3">
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filteredNotes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-12">
                    <EmptyState
                      icon="local_shipping"
                      title="No se encontraron notas de entrega"
                      description="No hay registros de despacho para los filtros seleccionados."
                      action={
                        filter !== "all" || search ? (
                          <Button
                            variant="outline"
                            onClick={() => {
                              setFilter("all");
                              setSearch("");
                            }}
                          >
                            Restablecer Filtros
                          </Button>
                        ) : undefined
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                filteredNotes.map((order) => {
                  const customerName =
                    (order.customerId
                      ? customerMap.get(order.customerId)
                      : null) ?? "Cliente Mostrador";

                  const statusCfg = STATUS_CONFIG[order.status] ?? {
                    label: order.status,
                    tone: "neutral" as StatusTone,
                  };

                  const canDispatch =
                    order.status === "confirmed" || order.status === "prepared";
                  const canDeliver = order.status === "dispatched";

                  return (
                    <TableRow key={order.id} className="text-xs">
                      {/* Nota # */}
                      <TableCell className="text-primary px-4 py-3 font-mono font-bold tabular-nums">
                        NE-{order.orderNumber}
                      </TableCell>

                      {/* Orden Ref */}
                      <TableCell className="text-muted-foreground px-4 py-3 font-mono tabular-nums">
                        {order.orderNumber}
                      </TableCell>

                      {/* Cliente / Destino */}
                      <TableCell className="text-foreground px-4 py-3 font-medium">
                        {customerName}
                      </TableCell>

                      {/* Canal */}
                      <TableCell className="px-4 py-3">
                        <div className="text-muted-foreground flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-base">
                            {CHANNEL_ICONS[order.channel] ?? "local_shipping"}
                          </span>
                          <span>
                            {CHANNEL_LABELS[order.channel] ?? order.channel}
                          </span>
                        </div>
                      </TableCell>

                      {/* Fecha Emisión */}
                      <TableCell className="text-muted-foreground px-4 py-3 font-mono">
                        {new Date(order.createdAt).toLocaleDateString("es-VE")}
                      </TableCell>

                      {/* Valor Declarado */}
                      <TableCell className="px-4 py-3 text-right">
                        <p className="text-foreground font-mono font-bold tabular-nums">
                          ${Number(order.total).toFixed(2)}
                        </p>
                        <p className="text-muted-foreground font-mono text-[11px] tabular-nums">
                          {formatDualCurrency(order.total, bcv.rate).bs}
                        </p>
                      </TableCell>

                      {/* Estado Logístico */}
                      <TableCell className="px-4 py-3 text-center">
                        <StatusBadge tone={statusCfg.tone}>
                          {statusCfg.label}
                        </StatusBadge>
                      </TableCell>

                      {/* Acción Rápida */}
                      <TableCell className="px-4 py-3 text-center">
                        {canDispatch ? (
                          <Button
                            size="sm"
                            disabled={updateStatus.isPending}
                            onClick={() =>
                              handleAdvanceStatus(order.id, order.status)
                            }
                            className="min-h-8 px-2.5 text-xs"
                          >
                            <span className="material-symbols-outlined mr-1 text-base">
                              flight_takeoff
                            </span>
                            Despachar
                          </Button>
                        ) : canDeliver ? (
                          <Button
                            size="sm"
                            disabled={updateStatus.isPending}
                            onClick={() =>
                              handleAdvanceStatus(order.id, order.status)
                            }
                            className="min-h-8 px-2.5 text-xs"
                          >
                            <span className="material-symbols-outlined mr-1 text-base">
                              check_circle
                            </span>
                            Entregar
                          </Button>
                        ) : (
                          <span className="text-muted-foreground font-mono text-xs">
                            —
                          </span>
                        )}
                      </TableCell>

                      {/* Guía / Detalle */}
                      <TableCell className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedOrderId(order.id)}
                            className="min-h-8 px-2.5 text-xs"
                            title="Ver Guía de Despacho Imprimible"
                          >
                            <span className="material-symbols-outlined mr-1 text-base">
                              local_shipping
                            </span>
                            Guía
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                            className="min-h-8 px-2 text-xs"
                            title="Ver Detalle de Pedido"
                          >
                            <Link href={`/orders/${order.id}`}>
                              <span className="material-symbols-outlined text-base">
                                open_in_new
                              </span>
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Delivery Note Voucher Modal */}
      <DeliveryNoteVoucherDialog
        open={!!selectedOrderId}
        onClose={() => setSelectedOrderId(null)}
        orderId={selectedOrderId}
      />
    </div>
  );
}
