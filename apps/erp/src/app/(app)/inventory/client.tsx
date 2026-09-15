"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { lazy, Suspense, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import type { IconName } from "@cendaro/ui/icons";
import { Button } from "@cendaro/ui";
import { Icon, Icons } from "@cendaro/ui/icons";
import { StatusPill } from "@cendaro/ui/status-pill";

import type { ActiveFilterItem, FilterSection } from "~/components/data-table";
import { DataTable, DataTableFilterBar } from "~/components/data-table";
import { PageHeader } from "~/components/page-header";
import { StatCard } from "~/components/stat-card";
import { useInventoryFilterParams } from "~/hooks/params/use-inventory-filter-params";
import { getStatus } from "~/lib/status";
import { useTRPC } from "~/trpc/client";

const TransferStockDialog = lazy(() =>
  import("~/components/forms/transfer-stock").then((m) => ({
    default: m.TransferStockDialog,
  })),
);
const CycleCountDialog = lazy(() =>
  import("~/components/forms/cycle-count").then((m) => ({
    default: m.CycleCountDialog,
  })),
);

/** Sales channels with system chart tokens */
const CHANNELS: { key: string; label: string; icon: IconName; tone: string }[] =
  [
    {
      key: "store",
      label: "Tienda",
      icon: "Store",
      tone: "bg-chart-1/15 text-chart-1",
    },
    {
      key: "mercadolibre",
      label: "Mercado Libre",
      icon: "ShoppingCart",
      tone: "bg-chart-2/15 text-chart-2",
    },
    {
      key: "vendors",
      label: "Vendedores",
      icon: "Group",
      tone: "bg-chart-3/15 text-chart-3",
    },
  ];

const VALID_STOCK_STATUSES = ["in_stock", "low_stock", "out_of_stock"] as const;
type ValidStockStatus = (typeof VALID_STOCK_STATUSES)[number];

const VALID_INVENTORY_SORTS = [
  "name:asc",
  "name:desc",
  "sku:asc",
  "sku:desc",
  "totalStock:asc",
  "totalStock:desc",
] as const;
type ValidInventorySort = (typeof VALID_INVENTORY_SORTS)[number];

interface StockItem {
  id: string;
  sku: string;
  name: string;
  status: string;
  totalStock: number;
  locked: boolean;
  storeStock: number;
  mlStock: number;
  vendorStock: number;
}

interface ChannelRow {
  channel: string;
  totalStock: string | number | null;
}

function getStockStatus(item: StockItem): ValidStockStatus {
  if (item.totalStock <= 0) return "out_of_stock";
  if (item.totalStock <= 5) return "low_stock";
  return "in_stock";
}

export default function InventoryClient() {
  const router = useRouter();
  const trpc = useTRPC();
  const [filters, setFilters] = useInventoryFilterParams();

  const [showTransfer, setShowTransfer] = useState(false);
  const [showCycle, setShowCycle] = useState(false);

  const clearFilters = useCallback(() => {
    void setFilters({
      search: "",
      status: "all",
      statuses: [],
      warehouseId: "",
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

  // Validated status filter
  const activeStatuses = useMemo<ValidStockStatus[] | undefined>(() => {
    const list = filters.statuses.filter((s): s is ValidStockStatus =>
      VALID_STOCK_STATUSES.includes(s as ValidStockStatus),
    );
    if (list.length > 0) return list;
    if (
      filters.status &&
      VALID_STOCK_STATUSES.includes(filters.status as ValidStockStatus)
    ) {
      return [filters.status as ValidStockStatus];
    }
    return undefined;
  }, [filters.statuses, filters.status]);

  const validSort = useMemo<ValidInventorySort | undefined>(() => {
    if (
      filters.sort &&
      VALID_INVENTORY_SORTS.includes(filters.sort as ValidInventorySort)
    ) {
      return filters.sort as ValidInventorySort;
    }
    return undefined;
  }, [filters.sort]);

  const {
    data,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery(
    trpc.inventory.stockOverview.infiniteQueryOptions(
      {
        limit: 50,
        search: filters.search || undefined,
        statuses: activeStatuses,
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

  const items = useMemo(
    () => data?.pages.flatMap((page) => page) ?? [],
    [data?.pages],
  );

  const { data: channelData } = useQuery(
    trpc.inventory.channelSummary.queryOptions(),
  );
  const { data: warehouses } = useQuery(
    trpc.inventory.listWarehouses.queryOptions(),
  );

  const channelStock = useMemo(
    () =>
      (channelData ??
        CHANNELS.map((ch) => ({
          channel: ch.key,
          totalStock: 0,
        }))) as ChannelRow[],
    [channelData],
  );

  const { totalStock, lowStockCount, outOfStockCount } = useMemo(() => {
    let ts = 0;
    let ls = 0;
    let os = 0;
    for (const it of items) {
      ts += it.totalStock;
      const status = getStockStatus(it);
      if (status === "low_stock") ls++;
      if (status === "out_of_stock") os++;
    }
    return { totalStock: ts, lowStockCount: ls, outOfStockCount: os };
  }, [items]);

  // Columns definition
  const columns = useMemo<ColumnDef<StockItem>[]>(
    () => [
      {
        accessorKey: "sku",
        header: "SKU",
        meta: {
          sticky: true,
          className:
            "w-36 font-mono text-xs tabular-nums text-muted-foreground",
        },
        cell: ({ row }) => (
          <span className="text-muted-foreground font-mono text-xs tabular-nums">
            {row.original.sku}
          </span>
        ),
      },
      {
        accessorKey: "name",
        header: "Producto",
        cell: ({ row }) => (
          <Link
            href={`/catalog/${row.original.id}`}
            onClick={(e) => e.stopPropagation()}
            className="text-foreground block max-w-md truncate font-medium hover:underline"
          >
            {row.original.name}
          </Link>
        ),
      },
      {
        accessorKey: "status",
        header: "Estado",
        meta: { align: "center", className: "w-32 text-center" },
        cell: ({ row }) => {
          const st = getStockStatus(row.original);
          const s = getStatus("stock", st);
          return <StatusPill tone={s.tone}>{s.label}</StatusPill>;
        },
      },
      {
        accessorKey: "totalStock",
        header: "Total",
        meta: {
          numeric: true,
          align: "right",
          className: "w-28 text-right font-mono font-medium tabular-nums",
        },
        cell: ({ row }) => (
          <span className="font-mono font-medium tabular-nums">
            {row.original.totalStock.toLocaleString("es-VE")}
          </span>
        ),
      },
      {
        accessorKey: "storeStock",
        header: "Tienda",
        meta: {
          numeric: true,
          align: "right",
          className:
            "w-24 text-right font-mono text-xs tabular-nums text-muted-foreground",
        },
        cell: ({ row }) => (
          <span className="text-muted-foreground font-mono text-xs tabular-nums">
            {row.original.storeStock.toLocaleString("es-VE")}
          </span>
        ),
      },
      {
        accessorKey: "mlStock",
        header: "ML",
        meta: {
          numeric: true,
          align: "right",
          className:
            "w-24 text-right font-mono text-xs tabular-nums text-muted-foreground",
        },
        cell: ({ row }) => (
          <span className="text-muted-foreground font-mono text-xs tabular-nums">
            {row.original.mlStock.toLocaleString("es-VE")}
          </span>
        ),
      },
      {
        accessorKey: "vendorStock",
        header: "Vendedores",
        meta: {
          numeric: true,
          align: "right",
          className:
            "w-28 text-right font-mono text-xs tabular-nums text-muted-foreground",
        },
        cell: ({ row }) => (
          <span className="text-muted-foreground font-mono text-xs tabular-nums">
            {row.original.vendorStock.toLocaleString("es-VE")}
          </span>
        ),
      },
    ],
    [],
  );

  // Filter sections for popover
  const filterSections = useMemo<FilterSection[]>(
    () => [
      {
        id: "status",
        title: "Nivel de stock",
        options: VALID_STOCK_STATUSES.map((key) => ({
          value: key,
          label: getStatus("stock", key).label,
        })),
        selectedValues: activeStatuses ?? [],
        onToggle: toggleStatus,
      },
    ],
    [activeStatuses, toggleStatus],
  );

  // Active filter chips
  const activeFilters = useMemo<ActiveFilterItem[]>(() => {
    const res: ActiveFilterItem[] = [];

    if (filters.search) {
      res.push({
        id: "search",
        label: "Búsqueda",
        valueLabel: filters.search,
        onRemove: () => void setFilters({ search: "" }),
      });
    }

    if (activeStatuses && activeStatuses.length > 0) {
      for (const s of activeStatuses) {
        res.push({
          id: `status-${s}`,
          label: "Estado",
          valueLabel: getStatus("stock", s).label,
          onRemove: () => toggleStatus(s),
        });
      }
    }

    return res;
  }, [filters.search, activeStatuses, setFilters, toggleStatus]);

  const activeFilterCount =
    (filters.search ? 1 : 0) + (activeStatuses?.length ?? 0);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 space-y-6 py-4 duration-200 lg:py-8">
      <PageHeader
        title="Inventario"
        description="Control multicanal de existencias"
        actions={
          <div className="flex w-full gap-2 sm:w-auto">
            <Button
              variant="outline"
              onClick={() => setShowTransfer(true)}
              className="min-h-11 flex-1 sm:flex-initial"
            >
              <Icons.SwapHoriz className="size-4.5" />
              Transferir
            </Button>
            <Button
              onClick={() => setShowCycle(true)}
              className="min-h-11 flex-1 sm:flex-initial"
            >
              <Icons.FactCheck className="size-4.5" />
              Conteo
            </Button>
          </div>
        }
      />

      <Suspense>
        <TransferStockDialog
          open={showTransfer}
          onClose={() => setShowTransfer(false)}
        />
        <CycleCountDialog
          open={showCycle}
          onClose={() => setShowCycle(false)}
        />
      </Suspense>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Stock Total"
          value={isLoading ? "—" : totalStock.toLocaleString("es-VE")}
          icon="Inventory2"
          tone="primary"
        />
        <StatCard
          label="Productos"
          value={isLoading ? "—" : items.length.toLocaleString("es-VE")}
          icon="Category"
        />
        <StatCard
          label="Bajo Stock"
          value={isLoading ? "—" : lowStockCount.toLocaleString("es-VE")}
          icon="TrendingDown"
          tone="warning"
        />
        <StatCard
          label="Sin Stock"
          value={isLoading ? "—" : outOfStockCount.toLocaleString("es-VE")}
          icon="Error"
          tone="destructive"
        />
      </div>

      {/* Channel Stock Breakdown (Monochrome Style) */}
      <div className="mobile-scroll-x flex gap-3 pb-1">
        {CHANNELS.map((ch) => {
          const chData = channelStock.find(
            (cs: ChannelRow) => cs.channel === ch.key,
          );
          const val = Number(chData?.totalStock ?? 0);
          return (
            <div
              key={ch.key}
              className="border-border bg-background flex min-w-40 shrink-0 items-center gap-3 border p-4"
            >
              <span
                aria-hidden
                className={`flex size-10 shrink-0 items-center justify-center ${ch.tone}`}
              >
                <Icon name={ch.icon} className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                  {ch.label}
                </p>
                <p className="text-foreground font-mono text-lg font-medium tabular-nums">
                  {val.toLocaleString("es-VE")}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Warehouses (Monochrome Style) */}
      {warehouses && warehouses.length > 0 && (
        <div className="mobile-scroll-x flex gap-3 pb-1">
          {warehouses.map((w) => (
            <Link
              key={w.id}
              href={`/inventory/warehouse/${w.id}`}
              className="border-border bg-background hover:border-foreground/30 flex min-w-48 shrink-0 items-center gap-3 border p-4 transition-colors"
            >
              <span className="bg-secondary text-muted-foreground flex size-10 shrink-0 items-center justify-center">
                <Icons.Warehouse className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-foreground truncate text-sm font-medium">
                  {w.name}
                </p>
                <p className="text-muted-foreground truncate text-xs">
                  {w.location ?? "Principal"}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Filter Bar */}
      <DataTableFilterBar
        search={{
          value: filters.search,
          onChange: (val) => void setFilters({ search: val }),
          placeholder: "Buscar producto por nombre o SKU...",
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
        data={items}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => void refetch()}
        isFetchingNextPage={isFetchingNextPage}
        hasNextPage={hasNextPage}
        fetchNextPage={fetchNextPage}
        sort={filters.sort}
        onSortChange={(newSort) => void setFilters({ sort: newSort ?? "" })}
        onRowClick={(item) => router.push(`/catalog/${item.id}`)}
        onResetFilters={clearFilters}
        emptyTitle="No se encontraron items en inventario"
        emptyDescription="Ajusta la búsqueda o el filtro de nivel de stock."
      />
    </div>
  );
}
