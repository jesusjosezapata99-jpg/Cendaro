"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@cendaro/ui";
import { Icons } from "@cendaro/ui/icons";
import { StatusPill } from "@cendaro/ui/status-pill";

import type { ActiveFilterItem } from "~/components/data-table";
import { DataTable, DataTableFilterBar } from "~/components/data-table";
import { EmptyState } from "~/components/empty-state";
import { Skeleton } from "~/components/skeleton";
import { StatCard } from "~/components/stat-card";
import { getStatus } from "~/lib/status";
import { useTRPC } from "~/trpc/client";

const TYPE_CONFIG: Record<
  string,
  { label: string; tone: "default" | "warning" | "neutral" }
> = {
  physical: { label: "Físico", tone: "default" },
  transit: { label: "En Tránsito", tone: "warning" },
  virtual: { label: "Virtual", tone: "neutral" },
};

interface WarehouseStockItem {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  productStatus: string;
  quantity: number;
  isLocked: boolean;
  updatedAt: string;
}

export default function WarehouseDetailClient() {
  const { id } = useParams<{ id: string }>();
  const trpc = useTRPC();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState("");

  /* Data */
  const { data: warehouse, isLoading: loadingWarehouse } = useQuery(
    trpc.inventory.getWarehouseDetail.queryOptions({ id }),
  );

  const {
    data: stockData,
    isLoading: loadingStock,
    isError: stockError,
    refetch: refetchStock,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery(
    trpc.inventory.warehouseStock.infiniteQueryOptions(
      {
        warehouseId: id,
        search: search || undefined,
        limit: 50,
      },
      {
        getNextPageParam: (lastPage, allPages) => {
          if (lastPage.length < 50) return undefined;
          return allPages.length * 50;
        },
      },
    ),
  );

  const stock = useMemo(
    () => stockData?.pages.flatMap((page) => page) ?? [],
    [stockData?.pages],
  );

  /* Mutations */
  const updateQty = useMutation(
    trpc.inventory.updateStockQuantity.mutationOptions({
      onSuccess: () => {
        toast.success("Stock actualizado correctamente");
        setEditingId(null);
        void qc.invalidateQueries({ queryKey: [["inventory"]] });
      },
    }),
  );

  /* Handlers */
  const startEdit = (stockId: string, currentQty: number) => {
    setEditingId(stockId);
    setEditQty(String(currentQty));
  };

  const submitEdit = useCallback(
    (stockId: string) => {
      const qty = parseInt(editQty, 10);
      if (isNaN(qty) || qty < 0) return;
      updateQty.mutate({ stockLedgerId: stockId, newQuantity: qty });
    },
    [editQty, updateQty],
  );

  // Columns definition
  const columns = useMemo<ColumnDef<WarehouseStockItem>[]>(
    () => [
      {
        accessorKey: "productName",
        header: "Producto",
        meta: { sticky: true, className: "w-48" },
        cell: ({ row }) => (
          <Link
            href={`/catalog/${row.original.productId}`}
            onClick={(e) => e.stopPropagation()}
            className="text-foreground block max-w-sm truncate font-medium hover:underline"
          >
            {row.original.productName}
          </Link>
        ),
      },
      {
        accessorKey: "productSku",
        header: "SKU",
        meta: {
          className:
            "w-32 font-mono text-xs tabular-nums text-muted-foreground",
        },
        cell: ({ row }) => (
          <span className="text-muted-foreground font-mono text-xs tabular-nums">
            {row.original.productSku}
          </span>
        ),
      },
      {
        accessorKey: "productStatus",
        header: "Estado",
        meta: { align: "center", className: "w-32 text-center" },
        cell: ({ row }) => {
          const s = getStatus("product", row.original.productStatus);
          return <StatusPill tone={s.tone}>{s.label}</StatusPill>;
        },
      },
      {
        accessorKey: "quantity",
        header: "Cantidad",
        meta: {
          numeric: true,
          align: "right",
          className: "w-36 text-right font-mono tabular-nums",
        },
        cell: ({ row }) => {
          const item = row.original;
          if (editingId === item.id) {
            return (
              <div
                className="flex items-center justify-end gap-1"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="number"
                  min={0}
                  value={editQty}
                  onChange={(e) => setEditQty(e.target.value)}
                  autoFocus
                  aria-label="Nueva cantidad"
                  className="border-border focus-visible:border-ring h-8 w-20 border bg-transparent px-2 text-right font-mono text-sm tabular-nums outline-none focus-visible:ring-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => submitEdit(item.id)}
                  disabled={updateQty.isPending}
                  className="text-primary hover:text-primary/80 size-8"
                >
                  <Icons.Check className="size-4.5" aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setEditingId(null)}
                  className="text-muted-foreground hover:text-foreground size-8"
                >
                  <Icons.Close className="size-4.5" aria-hidden />
                </Button>
              </div>
            );
          }

          return (
            <span
              className={`font-mono font-medium tabular-nums ${
                item.quantity === 0
                  ? "text-status-destructive-fg"
                  : item.quantity <= 5
                    ? "text-status-warning-fg"
                    : "text-foreground"
              }`}
            >
              {item.quantity.toLocaleString("es-VE")}
            </span>
          );
        },
      },
      {
        accessorKey: "isLocked",
        header: "Bloqueado",
        meta: { align: "center", className: "w-24 text-center" },
        cell: ({ row }) => (
          <div className="flex items-center justify-center">
            {row.original.isLocked ? (
              <Icons.Lock
                className="text-destructive size-4"
                aria-label="Stock bloqueado"
              />
            ) : (
              <Icons.LockOpen
                className="text-muted-foreground/40 size-4"
                aria-label="Stock desbloqueado"
              />
            )}
          </div>
        ),
      },
      {
        id: "actions",
        header: "",
        meta: { align: "right", className: "w-16 text-right" },
        cell: ({ row }) => {
          const item = row.original;
          if (editingId === item.id) return null;
          return (
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                startEdit(item.id, item.quantity);
              }}
              className="text-muted-foreground hover:text-foreground size-8"
              aria-label="Editar cantidad"
            >
              <Icons.Edit className="size-4" aria-hidden />
            </Button>
          );
        },
      },
    ],
    [editingId, editQty, updateQty.isPending, submitEdit],
  );

  const activeFilters = useMemo<ActiveFilterItem[]>(() => {
    if (!search) return [];
    return [
      {
        id: "search",
        label: "Búsqueda",
        valueLabel: search,
        onRemove: () => setSearch(""),
      },
    ];
  }, [search]);

  /* Loading State */
  if (loadingWarehouse) {
    return (
      <div className="animate-in fade-in space-y-6 py-4 duration-200 lg:py-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  if (!warehouse) {
    return (
      <div className="py-4 lg:py-8">
        <EmptyState
          icon="Warehouse"
          title="Almacén no encontrado"
          description="El almacén que buscas no existe o fue eliminado."
          action={
            <Button variant="outline" asChild>
              <Link href="/inventory">Volver a Inventario</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const typeCfg = TYPE_CONFIG[warehouse.type] ?? {
    label: warehouse.type,
    tone: "neutral" as const,
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 space-y-6 py-4 duration-200 lg:py-8">
      {/* Breadcrumb */}
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <Link
          href="/inventory"
          className="hover:text-foreground transition-colors"
        >
          Inventario
        </Link>
        <Icons.ChevronRight className="size-4" aria-hidden />
        <span className="text-foreground font-medium">{warehouse.name}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-foreground text-2xl font-medium tracking-tight">
              {warehouse.name}
            </h1>
            <StatusPill tone={typeCfg.tone}>{typeCfg.label}</StatusPill>
            {!warehouse.isActive && (
              <StatusPill tone="destructive">Inactivo</StatusPill>
            )}
          </div>
          {warehouse.location && (
            <p className="text-muted-foreground flex items-center gap-1 text-sm">
              <Icons.LocationOn className="size-4" aria-hidden />
              {warehouse.location}
            </p>
          )}
        </div>
        <Button asChild className="min-h-11 shrink-0">
          <Link href={`/inventory/warehouse/${id}/import`}>
            <Icons.UploadFile className="size-4.5" />
            Importar Inventario
          </Link>
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Productos"
          value={warehouse.totalProducts.toLocaleString("es-VE")}
          icon="Inventory2"
          tone="primary"
        />
        <StatCard
          label="Stock Total"
          value={warehouse.totalStock.toLocaleString("es-VE")}
          icon="Stacks"
          tone="success"
        />
        <StatCard
          label="Stock Bajo (≤5)"
          value={warehouse.lowStockCount.toLocaleString("es-VE")}
          icon="Warning"
          tone="warning"
        />
        <StatCard
          label="Bloqueados"
          value={warehouse.lockedCount.toLocaleString("es-VE")}
          icon="Lock"
          tone="destructive"
        />
      </div>

      {/* Filter Bar */}
      <DataTableFilterBar
        search={{
          value: search,
          onChange: setSearch,
          placeholder: "Buscar por nombre o SKU...",
        }}
        activeFilters={activeFilters}
        onClearAllFilters={() => setSearch("")}
      />

      {/* Virtualized Data Table */}
      <DataTable
        columns={columns}
        data={stock}
        isLoading={loadingStock}
        isError={stockError}
        onRetry={() => void refetchStock()}
        isFetchingNextPage={isFetchingNextPage}
        hasNextPage={hasNextPage}
        fetchNextPage={fetchNextPage}
        onResetFilters={() => setSearch("")}
        emptyTitle="No hay productos en este almacén"
        emptyDescription="Importa inventario o realiza una transferencia para comenzar."
      />
    </div>
  );
}
