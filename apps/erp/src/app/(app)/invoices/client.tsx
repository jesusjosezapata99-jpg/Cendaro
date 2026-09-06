"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

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

const InvoiceVoucherDialog = dynamic(
  () =>
    import("~/components/modals/invoice-voucher-dialog").then((m) => ({
      default: m.InvoiceVoucherDialog,
    })),
  { ssr: false },
);

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

const CHANNEL_LABELS: Record<string, string> = {
  store: "Tienda",
  mercadolibre: "Mercado Libre",
  vendors: "Vendedores",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
};

export default function InvoicesClient() {
  const trpc = useTRPC();
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

  const customerMap = useMemo(() => {
    return new Map((customersData ?? []).map((c) => [c.id, c.name]));
  }, [customersData]);

  const orders = useMemo(() => ordersData ?? [], [ordersData]);

  // Filter invoices based on selection and search
  const filteredInvoices = useMemo(() => {
    return orders.filter((order) => {
      // Status / Payment filtering
      const isPaid = Number(order.totalPaid) >= Number(order.total);
      if (filter === "invoiced" && order.status !== "invoiced") return false;
      if (filter === "delivered" && order.status !== "delivered") return false;
      if (filter === "dispatched" && order.status !== "dispatched")
        return false;
      if (filter === "confirmed" && order.status !== "confirmed") return false;
      if (filter === "paid" && !isPaid) return false;
      if (filter === "unpaid" && isPaid) return false;

      // Text search
      if (search.trim()) {
        const q = search.toLowerCase();
        const invoiceNum = `FAC-${order.orderNumber}`.toLowerCase();
        const orderNum = order.orderNumber.toLowerCase();
        const customerName = (
          (order.customerId ? customerMap.get(order.customerId) : null) ??
          "Cliente Ocasional"
        ).toLowerCase();

        return (
          invoiceNum.includes(q) ||
          orderNum.includes(q) ||
          customerName.includes(q)
        );
      }

      return true;
    });
  }, [orders, filter, search, customerMap]);

  // Aggregate metrics
  const totalFacturas = orders.length;
  const totalFacturadoUsd = orders.reduce((sum, o) => sum + Number(o.total), 0);
  const totalCobradoUsd = orders.reduce(
    (sum, o) => sum + Number(o.totalPaid ?? 0),
    0,
  );
  const totalPendienteUsd = Math.max(0, totalFacturadoUsd - totalCobradoUsd);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 space-y-6 p-4 duration-200 lg:p-8">
      {/* Page Header */}
      <PageHeader
        title="Facturas Internas"
        description="Emisión de comprobantes proforma, liquidación comercial y estado de cobranza"
        actions={
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <Button
              variant="outline"
              onClick={() => setSelectedOrderId("preview")}
              className="min-h-11 flex-1 sm:flex-initial"
            >
              <span className="material-symbols-outlined text-lg">
                receipt_long
              </span>
              Modelo Comprobante
            </Button>
            <Button asChild className="min-h-11 flex-1 sm:flex-initial">
              <Link href="/orders">
                <span className="material-symbols-outlined text-lg">add</span>
                Nueva Factura / Venta
              </Link>
            </Button>
          </div>
        }
      />

      {/* 4 StatCards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Facturas"
          value={ordersLoading ? "—" : totalFacturas.toLocaleString("es-VE")}
          icon="receipt_long"
        />
        <StatCard
          label="Total Facturado"
          value={
            ordersLoading
              ? "—"
              : formatDualCurrency(totalFacturadoUsd, bcv.rate).usd
          }
          sub={
            ordersLoading
              ? undefined
              : formatDualCurrency(totalFacturadoUsd, bcv.rate).bs
          }
          icon="payments"
          tone="primary"
        />
        <StatCard
          label="Total Cobrado"
          value={
            ordersLoading
              ? "—"
              : formatDualCurrency(totalCobradoUsd, bcv.rate).usd
          }
          sub={
            ordersLoading
              ? undefined
              : formatDualCurrency(totalCobradoUsd, bcv.rate).bs
          }
          icon="check_circle"
          tone="success"
        />
        <StatCard
          label="Saldo Pendiente"
          value={
            ordersLoading
              ? "—"
              : formatDualCurrency(totalPendienteUsd, bcv.rate).usd
          }
          sub={
            ordersLoading
              ? undefined
              : formatDualCurrency(totalPendienteUsd, bcv.rate).bs
          }
          icon="pending"
          tone="warning"
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
            placeholder="Buscar por Factura #, Orden # o Cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-border bg-card text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/20 w-full rounded-xl border py-2.5 pr-4 pl-10 text-sm focus:ring-2 focus:outline-none"
          />
        </div>

        {/* Filter chips */}
        <div className="mobile-scroll-x flex gap-2 pb-1">
          {[
            { key: "all", label: "Todas" },
            { key: "invoiced", label: "Facturadas" },
            { key: "delivered", label: "Entregadas" },
            { key: "dispatched", label: "Despachadas" },
            { key: "confirmed", label: "Confirmadas" },
            { key: "paid", label: "Cobradas" },
            { key: "unpaid", label: "Por Cobrar" },
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
        ) : filteredInvoices.length === 0 ? (
          <EmptyState
            icon="receipt_long"
            title="No se encontraron facturas"
            description="No hay comprobantes que coincidan con los criterios de búsqueda o filtro."
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
          filteredInvoices.map((order) => {
            const isPaid = Number(order.totalPaid) >= Number(order.total);
            const isPartial =
              Number(order.totalPaid) > 0 &&
              Number(order.totalPaid) < Number(order.total);
            const customerName =
              (order.customerId ? customerMap.get(order.customerId) : null) ??
              "Cliente Ocasional";

            const paymentTone: StatusTone = isPaid
              ? "success"
              : isPartial
                ? "warning"
                : "neutral";
            const paymentLabel = isPaid
              ? "Pagada"
              : isPartial
                ? "Pago Parcial"
                : "Por Cobrar";

            const orderStatusCfg = STATUS_CONFIG[order.status] ?? {
              label: order.status,
              tone: "neutral" as StatusTone,
            };

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
                      {CHANNEL_ICONS[order.channel] ?? "receipt_long"}
                    </span>
                    <span className="text-primary font-mono text-sm font-bold tabular-nums">
                      FAC-{order.orderNumber}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <StatusBadge tone={orderStatusCfg.tone}>
                      {orderStatusCfg.label}
                    </StatusBadge>
                    <StatusBadge tone={paymentTone}>{paymentLabel}</StatusBadge>
                  </div>
                </div>

                <div className="space-y-1 text-xs">
                  <p className="text-foreground text-sm font-semibold">
                    {customerName}
                  </p>
                  <p className="text-muted-foreground font-mono">
                    Ref: {order.orderNumber} ·{" "}
                    {new Date(order.createdAt).toLocaleDateString("es-VE")}
                  </p>
                </div>

                <div className="border-border-subtle flex items-baseline justify-between border-t pt-2">
                  <div>
                    <span className="text-muted-foreground text-[10px] font-bold uppercase">
                      Total Facturado
                    </span>
                    <p className="text-foreground font-mono text-base font-bold tabular-nums">
                      ${Number(order.total).toFixed(2)} USD
                    </p>
                    <p className="text-muted-foreground font-mono text-xs tabular-nums">
                      {formatDualCurrency(order.total, bcv.rate).bs}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedOrderId(order.id)}
                      className="min-h-9 text-xs"
                    >
                      <span className="material-symbols-outlined text-base">
                        receipt_long
                      </span>
                      Comprobante
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
                  Factura #
                </TableHead>
                <TableHead className="px-4 py-3 text-xs font-semibold uppercase">
                  Orden Ref.
                </TableHead>
                <TableHead className="px-4 py-3 text-xs font-semibold uppercase">
                  Cliente
                </TableHead>
                <TableHead className="px-4 py-3 text-xs font-semibold uppercase">
                  Canal
                </TableHead>
                <TableHead className="px-4 py-3 text-xs font-semibold uppercase">
                  Fecha
                </TableHead>
                <TableHead className="px-4 py-3 text-right text-xs font-semibold uppercase">
                  Total
                </TableHead>
                <TableHead className="px-4 py-3 text-right text-xs font-semibold uppercase">
                  Cobrado
                </TableHead>
                <TableHead className="px-4 py-3 text-center text-xs font-semibold uppercase">
                  Estado
                </TableHead>
                <TableHead className="px-4 py-3 text-center text-xs font-semibold uppercase">
                  Cobro
                </TableHead>
                <TableHead className="px-4 py-3 text-right text-xs font-semibold uppercase">
                  Acciones
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ordersLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 10 }).map((_, j) => (
                      <TableCell key={j} className="px-4 py-3">
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filteredInvoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="py-12">
                    <EmptyState
                      icon="receipt_long"
                      title="No se encontraron facturas"
                      description="No hay comprobantes que coincidan con los filtros seleccionados."
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
                filteredInvoices.map((order) => {
                  const isPaid = Number(order.totalPaid) >= Number(order.total);
                  const isPartial =
                    Number(order.totalPaid) > 0 &&
                    Number(order.totalPaid) < Number(order.total);
                  const customerName =
                    (order.customerId
                      ? customerMap.get(order.customerId)
                      : null) ?? "Cliente Ocasional";

                  const paymentTone: StatusTone = isPaid
                    ? "success"
                    : isPartial
                      ? "warning"
                      : "neutral";
                  const paymentLabel = isPaid
                    ? "Pagada"
                    : isPartial
                      ? "Parcial"
                      : "Pendiente";

                  const orderStatusCfg = STATUS_CONFIG[order.status] ?? {
                    label: order.status,
                    tone: "neutral" as StatusTone,
                  };

                  return (
                    <TableRow key={order.id} className="text-xs">
                      {/* Factura # */}
                      <TableCell className="text-primary px-4 py-3 font-mono font-bold tabular-nums">
                        FAC-{order.orderNumber}
                      </TableCell>

                      {/* Orden Ref */}
                      <TableCell className="text-muted-foreground px-4 py-3 font-mono tabular-nums">
                        {order.orderNumber}
                      </TableCell>

                      {/* Cliente */}
                      <TableCell className="text-foreground px-4 py-3 font-medium">
                        {customerName}
                      </TableCell>

                      {/* Canal */}
                      <TableCell className="px-4 py-3">
                        <div className="text-muted-foreground flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-base">
                            {CHANNEL_ICONS[order.channel] ?? "store"}
                          </span>
                          <span>
                            {CHANNEL_LABELS[order.channel] ?? order.channel}
                          </span>
                        </div>
                      </TableCell>

                      {/* Fecha */}
                      <TableCell className="text-muted-foreground px-4 py-3 font-mono">
                        {new Date(order.createdAt).toLocaleDateString("es-VE")}
                      </TableCell>

                      {/* Total */}
                      <TableCell className="px-4 py-3 text-right">
                        <p className="text-foreground font-mono font-bold tabular-nums">
                          ${Number(order.total).toFixed(2)}
                        </p>
                        <p className="text-muted-foreground font-mono text-[11px] tabular-nums">
                          {formatDualCurrency(order.total, bcv.rate).bs}
                        </p>
                      </TableCell>

                      {/* Cobrado */}
                      <TableCell className="px-4 py-3 text-right font-mono tabular-nums">
                        <p className="font-medium text-emerald-500">
                          ${Number(order.totalPaid ?? 0).toFixed(2)}
                        </p>
                        <p className="text-muted-foreground text-[11px]">
                          {
                            formatDualCurrency(order.totalPaid ?? 0, bcv.rate)
                              .bs
                          }
                        </p>
                      </TableCell>

                      {/* Estado Factura */}
                      <TableCell className="px-4 py-3 text-center">
                        <StatusBadge tone={orderStatusCfg.tone}>
                          {orderStatusCfg.label}
                        </StatusBadge>
                      </TableCell>

                      {/* Estado Cobro */}
                      <TableCell className="px-4 py-3 text-center">
                        <StatusBadge tone={paymentTone}>
                          {paymentLabel}
                        </StatusBadge>
                      </TableCell>

                      {/* Acciones */}
                      <TableCell className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedOrderId(order.id)}
                            className="min-h-8 px-2.5 text-xs"
                            title="Ver Comprobante de Facturación"
                          >
                            <span className="material-symbols-outlined mr-1 text-base">
                              receipt_long
                            </span>
                            Comprobante
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                            className="min-h-8 px-2 text-xs"
                            title="Ir a Detalle de Pedido"
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

      {/* Invoice Voucher Modal */}
      <InvoiceVoucherDialog
        open={!!selectedOrderId}
        onClose={() => setSelectedOrderId(null)}
        orderId={selectedOrderId}
      />
    </div>
  );
}
