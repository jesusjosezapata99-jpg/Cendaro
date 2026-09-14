"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import type { IconName } from "@cendaro/ui/icons";
import type { StatusTone } from "@cendaro/ui/status-pill";
import { Button } from "@cendaro/ui";
import { Icon, Icons } from "@cendaro/ui/icons";
import { StatusPill } from "@cendaro/ui/status-pill";

import { DataTable } from "~/components/data-table/data-table";
import { PageHeader } from "~/components/page-header";
import { StatCard } from "~/components/stat-card";
import { useBcvRate } from "~/hooks/use-bcv-rate";
import { formatDualCurrency } from "~/lib/format-currency";
import { getStatus } from "~/lib/status";
import { useTRPC } from "~/trpc/client";

const InvoiceVoucherDialog = dynamic(
  () =>
    import("~/components/modals/invoice-voucher-dialog").then((m) => ({
      default: m.InvoiceVoucherDialog,
    })),
  { ssr: false },
);

const CHANNEL_ICONS: Record<string, IconName> = {
  store: "Store",
  mercadolibre: "ShoppingCart",
  vendors: "LocalShipping",
  whatsapp: "Chat",
  instagram: "PhotoCamera",
};

const CHANNEL_LABELS: Record<string, string> = {
  store: "Tienda",
  mercadolibre: "Mercado Libre",
  vendors: "Vendedores",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
};

interface InvoiceItem {
  id: string;
  orderNumber: string;
  customerId: string | null;
  status: string;
  channel: string;
  total: string | number;
  totalPaid?: string | number | null;
  createdAt: Date | string;
}

export default function InvoicesClient() {
  const router = useRouter();
  const trpc = useTRPC();
  const bcv = useBcvRate();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const {
    data: ordersData,
    isLoading: ordersLoading,
    isError,
    refetch,
  } = useQuery(trpc.sales.listOrders.queryOptions({ limit: 100 }));

  const { data: customersData } = useQuery(
    trpc.sales.listCustomers.queryOptions({ limit: 100 }),
  );

  const customerMap = useMemo(() => {
    return new Map((customersData ?? []).map((c) => [c.id, c.name]));
  }, [customersData]);

  const orders = useMemo(
    () => (ordersData ?? []) as InvoiceItem[],
    [ordersData],
  );

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

  const columns = useMemo<ColumnDef<InvoiceItem>[]>(
    () => [
      {
        accessorKey: "orderNumber",
        header: "Factura #",
        meta: { sticky: true, className: "w-36" },
        cell: ({ row }) => (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedOrderId(row.original.id);
            }}
            className="text-primary font-mono text-xs font-medium tabular-nums hover:underline"
          >
            FAC-{row.original.orderNumber}
          </button>
        ),
      },
      {
        id: "orderRef",
        header: "Orden Ref.",
        meta: { className: "w-32" },
        cell: ({ row }) => (
          <Link
            href={`/orders/${row.original.id}`}
            onClick={(e) => e.stopPropagation()}
            className="text-muted-foreground hover:text-foreground font-mono text-xs tabular-nums hover:underline"
          >
            {row.original.orderNumber}
          </Link>
        ),
      },
      {
        id: "customer",
        header: "Cliente",
        meta: { className: "min-w-44" },
        cell: ({ row }) => {
          const customerName =
            (row.original.customerId
              ? customerMap.get(row.original.customerId)
              : null) ?? "Cliente Ocasional";
          return (
            <span className="text-foreground truncate text-xs font-medium">
              {customerName}
            </span>
          );
        },
      },
      {
        accessorKey: "channel",
        header: "Canal",
        meta: { className: "w-36" },
        cell: ({ row }) => {
          const ch = row.original.channel;
          return (
            <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <Icon
                name={CHANNEL_ICONS[ch] ?? "Store"}
                className="size-4 shrink-0"
              />
              <span className="truncate">{CHANNEL_LABELS[ch] ?? ch}</span>
            </div>
          );
        },
      },
      {
        accessorKey: "createdAt",
        header: "Fecha",
        meta: {
          className:
            "w-28 font-mono text-xs tabular-nums text-muted-foreground",
        },
        cell: ({ row }) => (
          <span className="text-muted-foreground font-mono text-xs tabular-nums">
            {new Date(row.original.createdAt).toLocaleDateString("es-VE")}
          </span>
        ),
      },
      {
        accessorKey: "total",
        header: "Total",
        meta: {
          numeric: true,
          align: "right",
          className: "w-36 text-right font-mono tabular-nums",
        },
        cell: ({ row }) => {
          const val = Number(row.original.total);
          return (
            <div className="text-right font-mono tabular-nums">
              <span className="text-foreground font-medium">
                ${val.toFixed(2)}
              </span>
              {bcv.rate > 0 ? (
                <span className="text-muted-foreground ml-1.5 text-[10px] font-normal">
                  {formatDualCurrency(val, bcv.rate).bs}
                </span>
              ) : null}
            </div>
          );
        },
      },
      {
        accessorKey: "totalPaid",
        header: "Cobrado",
        meta: {
          numeric: true,
          align: "right",
          className: "w-36 text-right font-mono tabular-nums",
        },
        cell: ({ row }) => {
          const paid = Number(row.original.totalPaid ?? 0);
          return (
            <div className="text-right font-mono tabular-nums">
              <span className="text-foreground font-medium">
                ${paid.toFixed(2)}
              </span>
              {bcv.rate > 0 ? (
                <span className="text-muted-foreground ml-1.5 text-[10px] font-normal">
                  {formatDualCurrency(paid, bcv.rate).bs}
                </span>
              ) : null}
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Estado",
        meta: { align: "center", className: "w-32 text-center" },
        cell: ({ row }) => {
          const s = getStatus("order", row.original.status);
          return <StatusPill tone={s.tone}>{s.label}</StatusPill>;
        },
      },
      {
        id: "payment",
        header: "Cobro",
        meta: { align: "center", className: "w-28 text-center" },
        cell: ({ row }) => {
          const isPaid =
            Number(row.original.totalPaid) >= Number(row.original.total);
          const isPartial =
            Number(row.original.totalPaid) > 0 &&
            Number(row.original.totalPaid) < Number(row.original.total);
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
          return <StatusPill tone={paymentTone}>{paymentLabel}</StatusPill>;
        },
      },
      {
        id: "actions",
        header: "Acciones",
        meta: { align: "right", className: "w-28 text-right" },
        cell: ({ row }) => (
          <div
            className="flex items-center justify-end gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedOrderId(row.original.id)}
              className="min-h-7 px-2 text-[11px]"
              title="Ver Comprobante de Facturación"
            >
              <Icons.ReceiptLong className="mr-1 size-3.5" />
              Comprobante
            </Button>
            <Button
              variant="outline"
              size="sm"
              asChild
              className="min-h-7 px-1.5 text-xs"
              title="Ir a Detalle de Pedido"
            >
              <Link href={`/orders/${row.original.id}`}>
                <Icons.OpenInNew className="size-3.5" />
              </Link>
            </Button>
          </div>
        ),
      },
    ],
    [bcv.rate, customerMap],
  );

  const handleRowClick = useCallback(
    (order: InvoiceItem) => {
      router.push(`/orders/${order.id}`);
    },
    [router],
  );

  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 space-y-6 py-4 duration-200 lg:py-8">
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
              <Icons.ReceiptLong className="size-4.5" />
              Modelo Comprobante
            </Button>
            <Button asChild className="min-h-11 flex-1 sm:flex-initial">
              <Link href="/orders">
                <Icons.Add className="size-4.5" />
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
          icon="ReceiptLong"
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
          icon="Payments"
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
          icon="CheckCircle"
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
          icon="Pending"
          tone="warning"
        />
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Icons.Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por Factura #, Orden # o Cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-border bg-card text-foreground placeholder:text-muted-foreground focus:border-primary w-full border py-2 pr-4 pl-9 text-xs focus:outline-none"
          />
        </div>

        {/* Filter chips — Clean sharp style */}
        <div className="mobile-scroll-x flex items-center gap-1.5">
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
              type="button"
              onClick={() => setFilter(f.key)}
              className={`flex min-h-8 items-center border px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                filter === f.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:bg-secondary hover:text-foreground border-[--line] hover:border-[--line-hover]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Data Table with 45px rows */}
      <DataTable
        columns={columns}
        data={filteredInvoices}
        isLoading={ordersLoading}
        isError={isError}
        onRetry={() => void refetch()}
        onRowClick={handleRowClick}
        onResetFilters={
          filter !== "all" || search
            ? () => {
                setFilter("all");
                setSearch("");
              }
            : undefined
        }
        emptyTitle="No se encontraron facturas"
        emptyDescription="No hay comprobantes que coincidan con los filtros seleccionados."
      />

      {/* Invoice Voucher Modal */}
      <InvoiceVoucherDialog
        open={!!selectedOrderId}
        onClose={() => setSelectedOrderId(null)}
        orderId={selectedOrderId}
      />
    </div>
  );
}
