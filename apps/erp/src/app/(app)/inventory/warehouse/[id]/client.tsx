"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  Button,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@cendaro/ui";
import { Icons } from "@cendaro/ui/icons";

import type { StatusTone } from "~/components/status-badge";
import { EmptyState } from "~/components/empty-state";
import { Skeleton } from "~/components/skeleton";
import { StatCard } from "~/components/stat-card";
import { StatusBadge } from "~/components/status-badge";
import { useTRPC } from "~/trpc/client";

/** Warehouse type → semantic token chip. */
const TYPE_CONFIG: Record<string, { label: string; tone: StatusTone }> = {
  physical: { label: "Físico", tone: "primary" },
  transit: { label: "En Tránsito", tone: "warning" },
  virtual: { label: "Virtual", tone: "neutral" },
};

/** Product status → semantic token chip (mirrors the catalog). */
const STATUS_CONFIG: Record<string, { label: string; tone: StatusTone }> = {
  active: { label: "Activo", tone: "success" },
  draft: { label: "Borrador", tone: "warning" },
  discontinued: { label: "Descontinuado", tone: "destructive" },
};

/** Shared cell padding for the stock table. */
const cellPx = "px-4 py-3";

export default function WarehouseDetailPage() {
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

  const { data: stock, isLoading: loadingStock } = useQuery(
    trpc.inventory.warehouseStock.queryOptions({
      warehouseId: id,
      search: search || undefined,
    }),
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

  const submitEdit = (stockId: string) => {
    const qty = parseInt(editQty, 10);
    if (isNaN(qty) || qty < 0) return;
    updateQty.mutate({ stockLedgerId: stockId, newQuantity: qty });
  };

  /* Loading */
  if (loadingWarehouse) {
    return (
      <div className="animate-in fade-in space-y-6 py-4 duration-200 lg:py-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
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
    tone: "neutral" as StatusTone,
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
            <StatusBadge tone={typeCfg.tone}>{typeCfg.label}</StatusBadge>
            {!warehouse.isActive && (
              <StatusBadge tone="destructive">Inactivo</StatusBadge>
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

      {/* Search */}
      <div className="relative max-w-sm">
        <Icons.Search
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden
        />
        <Input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre o SKU..."
          className="min-h-11 pl-10"
        />
      </div>

      {/* Stock Table */}
      <div className="border-border-subtle surface-card gap-0 overflow-hidden rounded-xl border py-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead
                className={`text-muted-foreground ${cellPx} text-xs font-medium tracking-widest uppercase`}
              >
                Producto
              </TableHead>
              <TableHead
                className={`text-muted-foreground ${cellPx} text-xs font-medium tracking-widest uppercase`}
              >
                SKU
              </TableHead>
              <TableHead
                className={`text-muted-foreground ${cellPx} text-center text-xs font-medium tracking-widest uppercase`}
              >
                Estado
              </TableHead>
              <TableHead
                className={`text-muted-foreground ${cellPx} text-right text-xs font-medium tracking-widest uppercase`}
              >
                Cantidad
              </TableHead>
              <TableHead
                className={`text-muted-foreground ${cellPx} text-center text-xs font-medium tracking-widest uppercase`}
              >
                Bloqueado
              </TableHead>
              <TableHead
                className={`text-muted-foreground ${cellPx} text-right text-xs font-medium tracking-widest uppercase`}
              >
                Acciones
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingStock ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j} className={cellPx}>
                      <Skeleton className="h-5 w-16" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : !stock?.length ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="px-4 py-6">
                  <EmptyState
                    icon="Inventory2"
                    title="No hay productos en este almacén"
                    description="Importa inventario o transfiere stock para empezar a gestionarlo."
                    action={
                      <Button variant="outline" asChild>
                        <Link href={`/inventory/warehouse/${id}/import`}>
                          Importar Inventario
                        </Link>
                      </Button>
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              stock.map((item) => {
                const statusCfg = STATUS_CONFIG[item.productStatus] ?? {
                  label: item.productStatus,
                  tone: "neutral" as StatusTone,
                };
                return (
                  <TableRow key={item.id}>
                    <TableCell className={cellPx}>
                      <Link
                        href={`/catalog/${item.productId}`}
                        className="text-foreground hover:text-primary font-medium transition-colors"
                      >
                        {item.productName}
                      </Link>
                    </TableCell>
                    <TableCell
                      className={`text-muted-foreground ${cellPx} font-mono text-xs tabular-nums`}
                    >
                      {item.productSku}
                    </TableCell>
                    <TableCell className={`${cellPx} text-center`}>
                      <StatusBadge tone={statusCfg.tone}>
                        {statusCfg.label}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className={`${cellPx} text-right`}>
                      {editingId === item.id ? (
                        <div className="flex items-center justify-end gap-1">
                          <input
                            type="number"
                            min={0}
                            value={editQty}
                            onChange={(e) => setEditQty(e.target.value)}
                            autoFocus
                            aria-label="Nueva cantidad"
                            className="border-border-subtle focus-visible:border-ring focus-visible:ring-ring/50 h-8 w-20 rounded-md border bg-transparent px-2 text-right font-mono text-sm tabular-nums outline-none focus-visible:ring-2"
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
                      ) : (
                        <span
                          className={`font-mono font-medium tabular-nums ${
                            item.quantity === 0
                              ? "text-destructive-soft"
                              : item.quantity <= 5
                                ? "text-warning-soft"
                                : "text-foreground"
                          }`}
                        >
                          {item.quantity.toLocaleString("es-VE")}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className={`${cellPx} text-center`}>
                      {item.isLocked ? (
                        <Icons.Lock
                          className="text-destructive size-4.5"
                          aria-label="Stock bloqueado"
                        />
                      ) : (
                        <Icons.LockOpen
                          className="text-muted-foreground/50 size-4.5"
                          aria-label="Stock desbloqueado"
                        />
                      )}
                    </TableCell>
                    <TableCell className={`${cellPx} text-right`}>
                      {editingId !== item.id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => startEdit(item.id, item.quantity)}
                          className="text-muted-foreground hover:text-foreground size-8"
                          aria-label="Editar cantidad"
                        >
                          <Icons.Edit className="size-4.5" aria-hidden />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
