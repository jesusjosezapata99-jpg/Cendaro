"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useInfiniteQuery } from "@tanstack/react-query";

import type { IconName } from "@cendaro/ui/icons";
import { Button } from "@cendaro/ui";
import { Icon, Icons } from "@cendaro/ui/icons";
import { StatusPill } from "@cendaro/ui/status-pill";

import type { ActiveFilterItem, FilterSection } from "~/components/data-table";
import { DataTable, DataTableFilterBar } from "~/components/data-table";
import { PageHeader } from "~/components/page-header";
import { StatCard } from "~/components/stat-card";
import { useOrderParams } from "~/hooks/params";
import { useOrderFilterParams } from "~/hooks/params/use-order-filter-params";
import { useBcvRate } from "~/hooks/use-bcv-rate";
import { formatDualCurrency } from "~/lib/format-currency";
import { getStatus } from "~/lib/status";
import { useTRPC } from "~/trpc/client";

const CreateOrderDialog = dynamic(
  () =>
    import("~/components/forms/create-order").then((m) => ({
      default: m.CreateOrderDialog,
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

const VALID_ORDER_STATUSES = [
  "draft",
  "pending",
  "pending_confirmation",
  "confirmed",
  "prepared",
  "dispatched",
  "delivered",
  "invoiced",
  "cancelled",
  "returned",
] as const;
type ValidOrderStatus = (typeof VALID_ORDER_STATUSES)[number];

const VALID_CHANNELS = [
  "store",
  "mercadolibre",
  "vendors",
  "whatsapp",
  "instagram",
] as const;
type ValidSalesChannel = (typeof VALID_CHANNELS)[number];

const VALID_SORTS = [
  "createdAt:asc",
  "createdAt:desc",
  "total:asc",
  "total:desc",
  "orderNumber:asc",
  "orderNumber:desc",
] as const;
type ValidOrderSort = (typeof VALID_SORTS)[number];

interface OrderItem {
  id: string;
  orderNumber: string;
  customerId: string | null;
  customerName: string | null;
  channel: string;
  status: string;
  subtotal: string | number;
  discount: string | number;
  total: string | number;
  totalPaid: string | number;
  createdAt: Date | string;
}

export default function OrdersClient() {
  const trpc = useTRPC();
  const bcv = useBcvRate();

  const [filters, setFilters] = useOrderFilterParams();
  const [, setOrderParams] = useOrderParams();

  const clearFilters = useCallback(() => {
    void setFilters({
      search: "",
      status: "all",
      statuses: [],
      channel: "all",
      channels: [],
      dateFrom: "",
      dateTo: "",
      sort: "",
    });
  }, [setFilters]);

  const toggleStatus = useCallback(
    (key: string) => {
      const current = filters.statuses;
      const next = current.includes(key)
        ? current.filter((s) => s !== key)
        : [...current, key];
      void setFilters({ statuses: next, status: "all" });
    },
    [filters.statuses, setFilters],
  );

  const toggleChannel = useCallback(
    (key: string) => {
      const current = filters.channels;
      const next = current.includes(key)
        ? current.filter((c) => c !== key)
        : [...current, key];
      void setFilters({ channels: next, channel: "all" });
    },
    [filters.channels, setFilters],
  );

  // Validated typed parameters for API
  const activeStatuses = useMemo<ValidOrderStatus[] | undefined>(() => {
    const list = filters.statuses.filter((s): s is ValidOrderStatus =>
      VALID_ORDER_STATUSES.includes(s as ValidOrderStatus),
    );
    if (list.length > 0) return list;
    if (
      filters.status &&
      VALID_ORDER_STATUSES.includes(filters.status as ValidOrderStatus)
    ) {
      return [filters.status as ValidOrderStatus];
    }
    return undefined;
  }, [filters.statuses, filters.status]);

  const activeChannels = useMemo<ValidSalesChannel[] | undefined>(() => {
    const list = filters.channels.filter((c): c is ValidSalesChannel =>
      VALID_CHANNELS.includes(c as ValidSalesChannel),
    );
    if (list.length > 0) return list;
    if (
      filters.channel &&
      VALID_CHANNELS.includes(filters.channel as ValidSalesChannel)
    ) {
      return [filters.channel as ValidSalesChannel];
    }
    return undefined;
  }, [filters.channels, filters.channel]);

  const validSort = useMemo<ValidOrderSort | undefined>(() => {
    if (filters.sort && VALID_SORTS.includes(filters.sort as ValidOrderSort)) {
      return filters.sort as ValidOrderSort;
    }
    return undefined;
  }, [filters.sort]);

  // Infinite query for virtualized data table
  const {
    data,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery(
    trpc.sales.listOrders.infiniteQueryOptions(
      {
        limit: 50,
        search: filters.search || undefined,
        statuses: activeStatuses,
        channels: activeChannels,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
        sort: validSort,
      },
      {
        getNextPageParam: (lastPage, allPages) => {
          if (lastPage.length < 50) return undefined;
          return allPages.length * 50;
        },
      },
    ),
  );

  const orders = useMemo<OrderItem[]>(
    () => (data?.pages.flatMap((page) => page) ?? []) as OrderItem[],
    [data?.pages],
  );

  const totalIngresos = useMemo(
    () => orders.reduce((s, o) => s + Number(o.total), 0),
    [orders],
  );

  const totalCobrado = useMemo(
    () => orders.reduce((s, o) => s + Number(o.totalPaid), 0),
    [orders],
  );

  // Table Columns
  const columns = useMemo<ColumnDef<OrderItem>[]>(
    () => [
      {
        accessorKey: "orderNumber",
        header: "Orden",
        meta: { sticky: true, className: "w-40" },
        cell: ({ row }) => (
          <div className="flex min-w-0 flex-col">
            <Link
              href={`/orders/${row.original.id}`}
              onClick={(e) => e.stopPropagation()}
              className="text-foreground truncate font-mono text-xs font-medium tabular-nums hover:underline"
            >
              {row.original.orderNumber}
            </Link>
            {row.original.customerName ? (
              <span className="text-muted-foreground truncate text-[11px]">
                {row.original.customerName}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "channel",
        header: "Canal",
        meta: { className: "w-28" },
        cell: ({ row }) => {
          const ch = row.original.channel;
          const iconName = CHANNEL_ICONS[ch] ?? "ListAlt";
          return (
            <div
              className="text-muted-foreground flex items-center gap-1.5 text-xs"
              title={CHANNEL_LABELS[ch] ?? ch}
            >
              <Icon name={iconName} className="size-4 shrink-0" />
              <span className="truncate">{CHANNEL_LABELS[ch] ?? ch}</span>
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
        header: "Pagado",
        meta: {
          numeric: true,
          align: "right",
          className: "w-36 text-right font-mono tabular-nums",
        },
        cell: ({ row }) => {
          const paid = Number(row.original.totalPaid);
          const total = Number(row.original.total);
          const isPaid = paid >= total && total > 0;
          return (
            <div className="text-right font-mono tabular-nums">
              <span
                className={
                  isPaid
                    ? "text-status-success-fg font-medium"
                    : "text-status-warning-fg font-medium"
                }
              >
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
        accessorKey: "createdAt",
        header: "Fecha",
        meta: {
          align: "right",
          className:
            "w-40 text-right font-mono text-xs tabular-nums text-muted-foreground",
        },
        cell: ({ row }) => (
          <span className="text-muted-foreground font-mono text-xs tabular-nums">
            {new Date(row.original.createdAt).toLocaleString("es-VE", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        ),
      },
    ],
    [bcv.rate],
  );

  // Filter sections for popover
  const filterSections = useMemo<FilterSection[]>(
    () => [
      {
        id: "status",
        title: "Estado del pedido",
        options: VALID_ORDER_STATUSES.map((key) => ({
          value: key,
          label: getStatus("order", key).label,
        })),
        selectedValues: activeStatuses ?? [],
        onToggle: toggleStatus,
      },
      {
        id: "channel",
        title: "Canal de venta",
        options: Object.entries(CHANNEL_LABELS).map(([key, label]) => ({
          value: key,
          label,
        })),
        selectedValues: activeChannels ?? [],
        onToggle: toggleChannel,
      },
    ],
    [activeStatuses, activeChannels, toggleStatus, toggleChannel],
  );

  // Active filter chips
  const activeFilters = useMemo<ActiveFilterItem[]>(() => {
    const items: ActiveFilterItem[] = [];

    if (filters.search) {
      items.push({
        id: "search",
        label: "Búsqueda",
        valueLabel: filters.search,
        onRemove: () => void setFilters({ search: "" }),
      });
    }

    if (activeStatuses && activeStatuses.length > 0) {
      for (const s of activeStatuses) {
        items.push({
          id: `status-${s}`,
          label: "Estado",
          valueLabel: getStatus("order", s).label,
          onRemove: () => toggleStatus(s),
        });
      }
    }

    if (activeChannels && activeChannels.length > 0) {
      for (const ch of activeChannels) {
        items.push({
          id: `channel-${ch}`,
          label: "Canal",
          valueLabel: CHANNEL_LABELS[ch] ?? ch,
          onRemove: () => toggleChannel(ch),
        });
      }
    }

    if (filters.dateFrom || filters.dateTo) {
      const fromStr = filters.dateFrom
        ? new Date(filters.dateFrom).toLocaleDateString("es-VE")
        : "—";
      const toStr = filters.dateTo
        ? new Date(filters.dateTo).toLocaleDateString("es-VE")
        : "—";
      items.push({
        id: "date-range",
        label: "Rango",
        valueLabel: `${fromStr} - ${toStr}`,
        onRemove: () => void setFilters({ dateFrom: "", dateTo: "" }),
      });
    }

    return items;
  }, [
    filters.search,
    filters.dateFrom,
    filters.dateTo,
    activeStatuses,
    activeChannels,
    setFilters,
    toggleStatus,
    toggleChannel,
  ]);

  const activeFilterCount =
    (filters.search ? 1 : 0) +
    (activeStatuses?.length ?? 0) +
    (activeChannels?.length ?? 0) +
    (filters.dateFrom || filters.dateTo ? 1 : 0);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 space-y-6 py-4 duration-200 lg:py-8">
      <PageHeader
        title="Órdenes de Venta"
        description="Gestión de pedidos multicanal"
        actions={
          <div className="flex w-full gap-2 sm:w-auto">
            <Button
              onClick={() => void setFilters({ createOrder: true })}
              className="min-h-11 flex-1 sm:flex-initial"
            >
              <Icons.Add className="size-4.5" />
              Nueva Orden
            </Button>
          </div>
        }
      />

      <CreateOrderDialog
        open={Boolean(filters.createOrder)}
        onClose={() => void setFilters({ createOrder: false })}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="Órdenes"
          value={isLoading ? "—" : orders.length.toLocaleString("es-VE")}
          icon="ListAlt"
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
          icon="Payments"
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
          icon="CheckCircle"
          tone="success"
        />
      </div>

      {/* Filter Bar */}
      <DataTableFilterBar
        search={{
          value: filters.search,
          onChange: (val) => void setFilters({ search: val }),
          placeholder: "Buscar por número de orden o cliente...",
        }}
        popover={{
          sections: filterSections,
          activeCount: activeFilterCount,
          onClearAll: clearFilters,
        }}
        activeFilters={activeFilters}
        onClearAllFilters={clearFilters}
      />

      {/* Virtualized Data Table */}
      <DataTable
        columns={columns}
        data={orders}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => void refetch()}
        isFetchingNextPage={isFetchingNextPage}
        hasNextPage={hasNextPage}
        fetchNextPage={fetchNextPage}
        sort={filters.sort}
        onSortChange={(newSort) => void setFilters({ sort: newSort ?? "" })}
        onRowClick={(order) => void setOrderParams({ orderId: order.id })}
        onResetFilters={clearFilters}
        emptyTitle="No se encontraron órdenes"
        emptyDescription="Prueba otra búsqueda o ajusta los filtros de estado y canal."
      />
    </div>
  );
}
