"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { IconName } from "@cendaro/ui/icons";
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

const DeliveryNoteVoucherDialog = dynamic(
  () =>
    import("~/components/modals/delivery-note-voucher-dialog").then((m) => ({
      default: m.DeliveryNoteVoucherDialog,
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
  store: "Tienda / Retiro",
  mercadolibre: "Mercado Libre",
  vendors: "Vendedores",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
};

interface OrderItem {
  id: string;
  orderNumber: string;
  customerId: string | null;
  status: string;
  channel: string;
  total: string | number;
  totalPaid?: string | number | null;
  createdAt: Date | string;
}

export default function DeliveryNotesClient() {
  const router = useRouter();
  const trpc = useTRPC();
  const qc = useQueryClient();
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

  const orders = useMemo(() => (ordersData ?? []) as OrderItem[], [ordersData]);

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

  const handleAdvanceStatus = useCallback(
    (orderId: string, currentStatus: string) => {
      if (currentStatus === "confirmed" || currentStatus === "prepared") {
        updateStatus.mutate({ id: orderId, status: "dispatched" });
      } else if (currentStatus === "dispatched") {
        updateStatus.mutate({ id: orderId, status: "delivered" });
      }
    },
    [updateStatus],
  );

  const columns = useMemo<ColumnDef<OrderItem>[]>(
    () => [
      {
        accessorKey: "orderNumber",
        header: "Nota #",
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
            NE-{row.original.orderNumber}
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
        header: "Cliente / Destino",
        meta: { className: "min-w-44" },
        cell: ({ row }) => {
          const customerName =
            (row.original.customerId
              ? customerMap.get(row.original.customerId)
              : null) ?? "Cliente Mostrador";
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
                name={CHANNEL_ICONS[ch] ?? "LocalShipping"}
                className="size-4 shrink-0"
              />
              <span className="truncate">{CHANNEL_LABELS[ch] ?? ch}</span>
            </div>
          );
        },
      },
      {
        accessorKey: "createdAt",
        header: "Emisión",
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
        header: "Valor Carga",
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
        accessorKey: "status",
        header: "Estado",
        meta: { align: "center", className: "w-36 text-center" },
        cell: ({ row }) => {
          const s = getStatus("deliveryNote", row.original.status);
          return <StatusPill tone={s.tone}>{s.label}</StatusPill>;
        },
      },
      {
        id: "quickAction",
        header: "Acción Rápida",
        meta: { align: "center", className: "w-32 text-center" },
        cell: ({ row }) => {
          const o = row.original;
          const canDispatch =
            o.status === "confirmed" || o.status === "prepared";
          const canDeliver = o.status === "dispatched";

          if (canDispatch) {
            return (
              <Button
                size="sm"
                variant="outline"
                disabled={updateStatus.isPending}
                onClick={(e) => {
                  e.stopPropagation();
                  handleAdvanceStatus(o.id, o.status);
                }}
                className="min-h-7 px-2 text-[11px]"
              >
                <Icons.FlightTakeoff className="mr-1 size-3.5" />
                Despachar
              </Button>
            );
          }
          if (canDeliver) {
            return (
              <Button
                size="sm"
                variant="outline"
                disabled={updateStatus.isPending}
                onClick={(e) => {
                  e.stopPropagation();
                  handleAdvanceStatus(o.id, o.status);
                }}
                className="min-h-7 px-2 text-[11px]"
              >
                <Icons.CheckCircle className="mr-1 size-3.5" />
                Entregar
              </Button>
            );
          }
          return (
            <span className="text-muted-foreground font-mono text-xs">—</span>
          );
        },
      },
      {
        id: "actions",
        header: "Guía",
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
              title="Ver Guía de Despacho Imprimible"
            >
              <Icons.LocalShipping className="mr-1 size-3.5" />
              Guía
            </Button>
            <Button
              variant="outline"
              size="sm"
              asChild
              className="min-h-7 px-1.5 text-xs"
              title="Ver Detalle de Pedido"
            >
              <Link href={`/orders/${row.original.id}`}>
                <Icons.OpenInNew className="size-3.5" />
              </Link>
            </Button>
          </div>
        ),
      },
    ],
    [bcv.rate, customerMap, handleAdvanceStatus, updateStatus.isPending],
  );

  const handleRowClick = useCallback(
    (order: OrderItem) => {
      router.push(`/orders/${order.id}`);
    },
    [router],
  );

  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 space-y-6 py-4 duration-200 lg:py-8">
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
              <Icons.LocalShipping className="size-4.5" />
              Modelo Guía
            </Button>
            <Button asChild className="min-h-11 flex-1 sm:flex-initial">
              <Link href="/orders">
                <Icons.Add className="size-4.5" />
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
          icon="LocalShipping"
        />
        <StatCard
          label="Por Despachar"
          value={
            ordersLoading ? "—" : porDespacharCount.toLocaleString("es-VE")
          }
          icon="Schedule"
          tone="warning"
        />
        <StatCard
          label="En Tránsito"
          value={ordersLoading ? "—" : enTransitoCount.toLocaleString("es-VE")}
          icon="FlightTakeoff"
          tone="primary"
        />
        <StatCard
          label="Entregadas"
          value={ordersLoading ? "—" : entregadasCount.toLocaleString("es-VE")}
          icon="CheckCircle"
          tone="success"
        />
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Icons.Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por Nota #, Orden # o Destinatario..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-border bg-card text-foreground placeholder:text-muted-foreground focus:border-primary w-full border py-2 pr-4 pl-9 text-xs focus:outline-none"
          />
        </div>

        {/* Filter chips — Clean sharp style */}
        <div className="mobile-scroll-x flex items-center gap-1.5">
          {[
            { key: "all", label: "Todas" },
            { key: "to_dispatch", label: "Por Despachar" },
            { key: "dispatched", label: "En Tránsito" },
            { key: "delivered", label: "Entregadas" },
            { key: "pending", label: "Pendientes" },
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
        data={filteredNotes}
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
        emptyTitle="No se encontraron notas de entrega"
        emptyDescription="No hay guías de despacho que coincidan con los criterios de búsqueda o filtro."
      />

      {/* Delivery Note Voucher Modal */}
      <DeliveryNoteVoucherDialog
        open={!!selectedOrderId}
        onClose={() => setSelectedOrderId(null)}
        orderId={selectedOrderId}
      />
    </div>
  );
}
