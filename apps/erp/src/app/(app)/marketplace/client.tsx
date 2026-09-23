"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { StatusTone } from "@cendaro/ui/status-pill";
import { Button } from "@cendaro/ui";
import { Icons } from "@cendaro/ui/icons";
import { StatusPill } from "@cendaro/ui/status-pill";
import { can } from "@cendaro/validators";

import { DataTable } from "~/components/data-table/data-table";
import { EmptyState } from "~/components/empty-state";
import { SyncMlListingDialog } from "~/components/modals/sync-ml-listing-dialog";
import { PageHeader } from "~/components/page-header";
import { StatCard } from "~/components/stat-card";
import { useBcvRate } from "~/hooks/use-bcv-rate";
import { useCurrentUser } from "~/hooks/use-current-user";
import { formatDualCurrency } from "~/lib/format-currency";
import { useTRPC } from "~/trpc/client";

type TabType = "listings" | "orders" | "logs";

interface MlListingItem {
  id: string;
  mlItemId: string;
  title: string;
  price: number;
  stockSynced: number | null;
  status: string;
  lastSyncAt: Date | string | null;
}

interface MlOrderItem {
  id: string;
  mlOrderId: string;
  buyerNickname: string | null;
  unitPrice: number;
  quantity: number;
  shippingStatus: string | null;
  isImported: boolean;
  createdAt: Date | string;
}

function getListingStatus(status: string): { label: string; tone: StatusTone } {
  switch (status) {
    case "active":
      return { label: "Activo", tone: "success" };
    case "paused":
      return { label: "Pausado", tone: "warning" };
    case "closed":
      return { label: "Cerrado", tone: "default" };
    case "out_of_stock":
      return { label: "Sin Stock", tone: "destructive" };
    case "error":
      return { label: "Error", tone: "destructive" };
    default:
      return { label: status, tone: "neutral" };
  }
}

export default function MarketplacePage() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const bcv = useBcvRate();

  const [tab, setTab] = useState<TabType>("listings");
  const [search, setSearch] = useState("");
  const [listingFilter, setListingFilter] = useState<string>("all");
  const [syncingListing, setSyncingListing] = useState<MlListingItem | null>(
    null,
  );
  const { profile } = useCurrentUser();
  // Importing an ML order creates a sales order: management only
  // (marketplace.create). Marketing works listings, not orders.
  const canImport = can(profile?.role, "marketplace", "create");

  const {
    data: listings,
    isLoading: listingsLoading,
    isError: listingsError,
    refetch: refetchListings,
  } = useQuery(trpc.integrations.listMlListings.queryOptions({ limit: 50 }));
  const {
    data: orders,
    isLoading: ordersLoading,
    isError: ordersError,
    refetch: refetchOrders,
  } = useQuery(trpc.integrations.listMlOrders.queryOptions({ limit: 50 }));
  const { data: logs, isLoading: logsLoading } = useQuery(
    trpc.integrations.listLogs.queryOptions({
      source: "mercadolibre",
      limit: 50,
    }),
  );

  const importOrder = useMutation(
    trpc.integrations.importMlOrder.mutationOptions({
      onSuccess: () => {
        toast.success("Orden importada exitosamente al ERP");
        void qc.invalidateQueries({ queryKey: [["integrations"]] });
        void qc.invalidateQueries({ queryKey: [["sales"]] });
      },
      onError: (err) => {
        toast.error(`Error al importar orden: ${err.message}`);
      },
    }),
  );

  const resolveLog = useMutation(
    trpc.integrations.resolveLog.mutationOptions({
      onSuccess: () => {
        toast.success("Alerta marcada como resuelta");
        void qc.invalidateQueries({ queryKey: [["integrations"]] });
      },
      onError: (err) => {
        toast.error(`Error al resolver alerta: ${err.message}`);
      },
    }),
  );

  const listingItems = useMemo(
    () => (listings ?? []) as unknown as MlListingItem[],
    [listings],
  );
  const orderItems = useMemo(
    () => (orders ?? []) as unknown as MlOrderItem[],
    [orders],
  );
  const logItems = useMemo(() => logs ?? [], [logs]);

  const activeListings = useMemo(
    () => listingItems.filter((l) => l.status === "active").length,
    [listingItems],
  );
  const pendingImport = useMemo(
    () => orderItems.filter((o) => !o.isImported).length,
    [orderItems],
  );
  const activeAlerts = useMemo(
    () => logItems.filter((a) => !a.isResolved && a.level === "error").length,
    [logItems],
  );

  const filteredListings = useMemo(() => {
    let result = listingItems;
    if (listingFilter !== "all") {
      result = result.filter((l) => l.status === listingFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          l.title.toLowerCase().includes(q) ||
          l.mlItemId.toLowerCase().includes(q),
      );
    }
    return result;
  }, [listingItems, listingFilter, search]);

  const filteredOrders = useMemo(() => {
    if (!search.trim()) return orderItems;
    const q = search.toLowerCase();
    return orderItems.filter(
      (o) =>
        o.mlOrderId.toLowerCase().includes(q) ||
        Boolean(o.buyerNickname?.toLowerCase().includes(q)),
    );
  }, [orderItems, search]);

  const filteredLogs = useMemo(() => {
    if (!search.trim()) return logItems;
    const q = search.toLowerCase();
    return logItems.filter(
      (l) =>
        l.message.toLowerCase().includes(q) ||
        l.source.toLowerCase().includes(q),
    );
  }, [logItems, search]);

  const handleSyncAll = () => {
    void qc.invalidateQueries({ queryKey: [["integrations"]] });
    toast.success("Sincronización de catálogo solicitada");
  };

  const listingColumns = useMemo<ColumnDef<MlListingItem>[]>(
    () => [
      {
        accessorKey: "mlItemId",
        header: "ML ID",
        cell: ({ row }) => (
          <span className="text-primary font-mono text-xs font-medium">
            {row.original.mlItemId}
          </span>
        ),
      },
      {
        accessorKey: "title",
        header: "Título de Publicación",
        cell: ({ row }) => (
          <span className="text-foreground max-w-md truncate text-xs font-medium">
            {row.original.title}
          </span>
        ),
      },
      {
        accessorKey: "price",
        header: () => <div className="text-right">Precio USD / Bs</div>,
        cell: ({ row }) => {
          const dual = formatDualCurrency(row.original.price, bcv.rate);
          return (
            <div className="text-right">
              <span className="text-foreground font-mono text-xs font-medium tabular-nums">
                {dual.usd}
              </span>
              {bcv.rate > 0 && (
                <span className="text-muted-foreground ml-1.5 font-mono text-[10px] tabular-nums">
                  {dual.bs}
                </span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        header: () => <div className="text-center">Estado</div>,
        cell: ({ row }) => {
          const { label, tone } = getListingStatus(row.original.status);
          return (
            <div className="text-center">
              <StatusPill tone={tone}>{label}</StatusPill>
            </div>
          );
        },
      },
      {
        accessorKey: "stockSynced",
        header: () => <div className="text-right">Stock Sincronizado</div>,
        cell: ({ row }) => (
          <div className="text-foreground text-right font-mono text-xs font-medium tabular-nums">
            {row.original.stockSynced ?? 0}
          </div>
        ),
      },
      {
        accessorKey: "lastSyncAt",
        header: "Última Sincronización",
        cell: ({ row }) => (
          <span className="text-muted-foreground font-mono text-xs tabular-nums">
            {row.original.lastSyncAt
              ? new Date(row.original.lastSyncAt).toLocaleString("es-VE")
              : "Nunca"}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => <div className="text-right">Acciones</div>,
        cell: ({ row }) => (
          <div className="text-right">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSyncingListing(row.original)}
              className="border-border h-7 px-2 text-xs font-medium"
            >
              <Icons.Sync className="mr-1 size-3.5" />
              Sincronizar
            </Button>
          </div>
        ),
      },
    ],
    [bcv.rate],
  );

  const orderColumns = useMemo<ColumnDef<MlOrderItem>[]>(
    () => [
      {
        accessorKey: "mlOrderId",
        header: "Orden ML",
        cell: ({ row }) => (
          <span className="text-primary font-mono text-xs font-medium">
            {row.original.mlOrderId}
          </span>
        ),
      },
      {
        accessorKey: "buyerNickname",
        header: "Comprador",
        cell: ({ row }) => (
          <span className="text-foreground text-xs font-medium">
            {row.original.buyerNickname ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "unitPrice",
        header: () => <div className="text-right">Precio Unit.</div>,
        cell: ({ row }) => (
          <div className="text-muted-foreground text-right font-mono text-xs tabular-nums">
            ${row.original.unitPrice.toFixed(2)}
          </div>
        ),
      },
      {
        accessorKey: "quantity",
        header: () => <div className="text-right">Cant.</div>,
        cell: ({ row }) => (
          <div className="text-muted-foreground text-right font-mono text-xs tabular-nums">
            {row.original.quantity}
          </div>
        ),
      },
      {
        id: "total",
        header: () => <div className="text-right">Total USD / Bs</div>,
        cell: ({ row }) => {
          const total = row.original.unitPrice * row.original.quantity;
          const dual = formatDualCurrency(total, bcv.rate);
          return (
            <div className="text-right">
              <span className="text-foreground font-mono text-xs font-medium tabular-nums">
                {dual.usd}
              </span>
              {bcv.rate > 0 && (
                <span className="text-muted-foreground ml-1.5 font-mono text-[10px] tabular-nums">
                  {dual.bs}
                </span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "shippingStatus",
        header: () => <div className="text-center">Estado Envío</div>,
        cell: ({ row }) => (
          <div className="text-muted-foreground text-center font-mono text-xs">
            {row.original.shippingStatus ?? "—"}
          </div>
        ),
      },
      {
        accessorKey: "isImported",
        header: () => <div className="text-center">Estado ERP</div>,
        cell: ({ row }) => (
          <div className="text-center">
            <StatusPill tone={row.original.isImported ? "success" : "warning"}>
              {row.original.isImported ? "Importado" : "Pendiente"}
            </StatusPill>
          </div>
        ),
      },
      {
        id: "actions",
        header: () => <div className="text-right">Acción</div>,
        cell: ({ row }) => {
          const o = row.original;
          if (o.isImported) {
            return (
              <div className="text-right">
                <span className="font-mono text-xs text-emerald-500 tabular-nums">
                  Listo
                </span>
              </div>
            );
          }
          if (!canImport) return null;
          return (
            <div className="text-right">
              <Button
                variant="outline"
                size="sm"
                onClick={() => importOrder.mutate({ id: o.id })}
                disabled={importOrder.isPending}
                className="border-border h-7 px-2 text-xs font-medium"
              >
                <Icons.CloudUpload className="mr-1 size-3.5" />
                Importar
              </Button>
            </div>
          );
        },
      },
    ],
    [bcv.rate, importOrder, canImport],
  );

  return (
    <div className="space-y-6 py-4 lg:py-8">
      {/* Header */}
      <PageHeader
        title="Mercado Libre B2B"
        description="Panel de integración omnicanal, sincronización de publicaciones y gestión de pedidos"
        actions={
          <Button
            variant="outline"
            onClick={handleSyncAll}
            className="min-h-11 flex-1 sm:flex-initial"
          >
            <Icons.Sync className="size-4.5" />
            Sincronizar Todo
          </Button>
        }
      />

      {/* 4 StatCards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Publicaciones Activas"
          value={activeListings}
          icon="Storefront"
          tone="success"
        />
        <StatCard
          label="Total Publicadas"
          value={listingItems.length}
          icon="Inventory2"
          tone="default"
        />
        <StatCard
          label="Órdenes Pendientes"
          value={pendingImport}
          icon="MoveToInbox"
          tone={pendingImport > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Alertas Activas"
          value={activeAlerts}
          icon="Warning"
          tone={activeAlerts > 0 ? "destructive" : "default"}
        />
      </div>

      {/* Active Alerts Banner */}
      {activeAlerts > 0 && (
        <div className="border-destructive/30 bg-destructive/10 flex items-center justify-between gap-3 border p-4">
          <div className="flex items-center gap-3">
            <Icons.Warning className="text-destructive size-5" />
            <div>
              <p className="text-destructive text-sm font-medium">
                {activeAlerts} alerta{activeAlerts > 1 ? "s" : ""} de
                integración requieren atención
              </p>
              <p className="text-destructive/80 text-xs">
                Se detectaron eventos críticos en la sincronización con Mercado
                Libre
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setTab("logs")}
            className="border-destructive/30 text-destructive hover:bg-destructive/20 h-8"
          >
            Ver Logs
          </Button>
        </div>
      )}

      {/* Tabs & Search */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="border-border bg-card flex gap-1 border p-1">
          <button
            type="button"
            onClick={() => setTab("listings")}
            className={`flex items-center gap-2 px-4 py-1.5 text-xs font-medium transition-colors ${
              tab === "listings"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icons.Package2 className="size-3.5" />
            Publicaciones
            <span
              className={`py-0.2 ml-1 px-1.5 font-mono text-[10px] tabular-nums ${
                tab === "listings"
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {listingItems.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setTab("orders")}
            className={`flex items-center gap-2 px-4 py-1.5 text-xs font-medium transition-colors ${
              tab === "orders"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icons.ShoppingCart className="size-3.5" />
            Órdenes ML
            <span
              className={`py-0.2 ml-1 px-1.5 font-mono text-[10px] tabular-nums ${
                tab === "orders"
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {orderItems.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setTab("logs")}
            className={`flex items-center gap-2 px-4 py-1.5 text-xs font-medium transition-colors ${
              tab === "logs"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icons.ListAlt className="size-3.5" />
            Logs & Eventos
            <span
              className={`py-0.2 ml-1 px-1.5 font-mono text-[10px] tabular-nums ${
                tab === "logs"
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {logItems.length}
            </span>
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Icons.Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por ID, título, comprador..."
            className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-foreground min-h-9 w-full border py-1.5 pr-4 pl-9 text-xs transition-colors outline-none"
          />
        </div>
      </div>

      {/* Listings Tab */}
      {tab === "listings" && (
        <div className="space-y-4">
          {/* Subfilter Chips */}
          <div className="mobile-scroll-x flex gap-1.5">
            {[
              { key: "all", label: "Todas" },
              { key: "active", label: "Activas" },
              { key: "paused", label: "Pausadas" },
              { key: "out_of_stock", label: "Sin Stock" },
              { key: "closed", label: "Cerradas" },
            ].map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setListingFilter(f.key)}
                className={`h-8 shrink-0 border px-2.5 text-xs font-medium transition-colors ${
                  listingFilter === f.key
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {listingsLoading ? (
            <div className="border-border bg-card border">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="border-border flex h-11.25 animate-pulse items-center border-b px-4 last:border-b-0"
                >
                  <div className="bg-muted h-4 w-24" />
                  <div className="bg-muted ml-6 h-4 w-48" />
                  <div className="bg-muted ml-auto h-4 w-20" />
                </div>
              ))}
            </div>
          ) : filteredListings.length === 0 ? (
            <div className="border-border bg-card border p-12">
              <EmptyState
                icon="Storefront"
                title="No se encontraron publicaciones"
                description="No hay artículos sincronizados que coincidan con los filtros seleccionados."
              />
            </div>
          ) : (
            <>
              {/* Mobile Cards */}
              <div className="grid grid-cols-1 gap-3 md:hidden">
                {filteredListings.map((l) => {
                  const dual = formatDualCurrency(l.price, bcv.rate);
                  const { label, tone } = getListingStatus(l.status);
                  return (
                    <div
                      key={l.id}
                      className="border-border bg-card space-y-3 border p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <span className="text-primary font-mono text-xs font-medium">
                            {l.mlItemId}
                          </span>
                          <p className="text-foreground mt-0.5 line-clamp-2 text-sm font-medium">
                            {l.title}
                          </p>
                        </div>
                        <StatusPill tone={tone}>{label}</StatusPill>
                      </div>

                      <div className="border-border flex items-center justify-between border-t pt-2 text-xs">
                        <div>
                          <p className="text-muted-foreground text-[10px] tracking-wider uppercase">
                            Precio de Venta
                          </p>
                          <p className="text-foreground font-mono text-sm font-medium tabular-nums">
                            {dual.usd}
                          </p>
                          {bcv.rate > 0 && (
                            <p className="text-muted-foreground font-mono text-[10px] tabular-nums">
                              {dual.bs}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-muted-foreground text-[10px] tracking-wider uppercase">
                            Stock ML
                          </p>
                          <p className="text-foreground font-mono text-sm font-medium tabular-nums">
                            {l.stockSynced ?? 0} uds
                          </p>
                        </div>
                      </div>

                      <div className="border-border flex items-center justify-between border-t pt-2">
                        <span className="text-muted-foreground font-mono text-[10px] tabular-nums">
                          {l.lastSyncAt
                            ? `Sync: ${new Date(l.lastSyncAt).toLocaleDateString("es-VE")}`
                            : "Sin sync"}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSyncingListing(l)}
                          className="border-border h-7 px-2 text-xs font-medium"
                        >
                          <Icons.Sync className="mr-1 size-3.5" />
                          Ajustar
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block">
                <DataTable
                  columns={listingColumns}
                  data={filteredListings}
                  isLoading={listingsLoading}
                  isError={listingsError}
                  onRetry={() => void refetchListings()}
                  onResetFilters={
                    search || listingFilter !== "all"
                      ? () => {
                          setSearch("");
                          setListingFilter("all");
                        }
                      : undefined
                  }
                  emptyTitle="No se encontraron publicaciones"
                  emptyDescription="No hay artículos sincronizados que coincidan con los filtros seleccionados."
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* Orders Tab */}
      {tab === "orders" && (
        <div className="space-y-4">
          {ordersLoading ? (
            <div className="border-border bg-card border">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="border-border flex h-11.25 animate-pulse items-center border-b px-4 last:border-b-0"
                >
                  <div className="bg-muted h-4 w-28" />
                  <div className="bg-muted ml-6 h-4 w-32" />
                  <div className="bg-muted ml-auto h-4 w-24" />
                </div>
              ))}
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="border-border bg-card border p-12">
              <EmptyState
                icon="ShoppingCart"
                title="No hay órdenes de Mercado Libre"
                description="Las ventas originadas en Mercado Libre se sincronizarán y mostrarán aquí para su importación al ERP."
              />
            </div>
          ) : (
            <>
              {/* Mobile Cards */}
              <div className="grid grid-cols-1 gap-3 md:hidden">
                {filteredOrders.map((o) => {
                  const total = o.unitPrice * o.quantity;
                  const dual = formatDualCurrency(total, bcv.rate);
                  return (
                    <div
                      key={o.id}
                      className="border-border bg-card space-y-3 border p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-primary font-mono text-xs font-medium">
                            {o.mlOrderId}
                          </span>
                          <p className="text-foreground mt-0.5 text-sm font-medium">
                            {o.buyerNickname ?? "Comprador anónimo"}
                          </p>
                        </div>
                        <StatusPill tone={o.isImported ? "success" : "warning"}>
                          {o.isImported ? "Importado" : "Pendiente"}
                        </StatusPill>
                      </div>

                      <div className="border-border flex items-center justify-between border-t pt-2 text-xs">
                        <div>
                          <p className="text-muted-foreground text-[10px] tracking-wider uppercase">
                            Total Orden
                          </p>
                          <p className="text-foreground font-mono text-sm font-medium tabular-nums">
                            {dual.usd}
                          </p>
                          {bcv.rate > 0 && (
                            <p className="text-muted-foreground font-mono text-[10px] tabular-nums">
                              {dual.bs}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-muted-foreground text-[10px] tracking-wider uppercase">
                            Cantidad
                          </p>
                          <p className="text-foreground font-mono text-sm font-medium tabular-nums">
                            {o.quantity} uds (${o.unitPrice.toFixed(2)} c/u)
                          </p>
                        </div>
                      </div>

                      <div className="border-border flex items-center justify-between border-t pt-2">
                        <span className="text-muted-foreground text-xs font-medium">
                          Envío: {o.shippingStatus ?? "Pendiente"}
                        </span>
                        {!o.isImported && canImport && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => importOrder.mutate({ id: o.id })}
                            disabled={importOrder.isPending}
                            className="border-border h-7 px-2 text-xs font-medium"
                          >
                            <Icons.CloudUpload className="mr-1 size-3.5" />
                            Importar
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block">
                <DataTable
                  columns={orderColumns}
                  data={filteredOrders}
                  isLoading={ordersLoading}
                  isError={ordersError}
                  onRetry={() => void refetchOrders()}
                  onResetFilters={search ? () => setSearch("") : undefined}
                  emptyTitle="No hay órdenes de Mercado Libre"
                  emptyDescription="Las ventas originadas en Mercado Libre se sincronizarán y mostrarán aquí para su importación al ERP."
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* Logs Tab */}
      {tab === "logs" && (
        <div className="space-y-3">
          {logsLoading ? (
            <div className="border-border bg-card border">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="border-border flex h-16 animate-pulse items-center border-b px-4 last:border-b-0"
                >
                  <div className="bg-muted h-5 w-20" />
                  <div className="bg-muted ml-4 h-4 w-64" />
                </div>
              ))}
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="border-border bg-card border p-12">
              <EmptyState
                icon="ListAlt"
                title="Sin registros de eventos"
                description="No hay incidencias o registros de sincronización de Mercado Libre."
              />
            </div>
          ) : (
            filteredLogs.map((log) => {
              const tone: StatusTone =
                log.level === "error"
                  ? "destructive"
                  : log.level === "warning"
                    ? "warning"
                    : "neutral";
              return (
                <div
                  key={log.id}
                  className={`border-border bg-card border p-4 transition-colors ${
                    log.isResolved ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <StatusPill tone={tone}>
                        {log.level.toUpperCase()}
                      </StatusPill>
                      <div>
                        <p
                          className={`text-sm font-medium ${
                            log.isResolved
                              ? "text-muted-foreground line-through"
                              : "text-foreground"
                          }`}
                        >
                          {log.message}
                        </p>
                        <p className="text-muted-foreground mt-1 font-mono text-xs tabular-nums">
                          {new Date(log.createdAt).toLocaleString("es-VE")} ·
                          Origen: {log.source}
                        </p>
                      </div>
                    </div>
                    {!log.isResolved && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => resolveLog.mutate({ id: log.id })}
                        disabled={resolveLog.isPending}
                        className="border-border h-7 self-start px-2 text-xs font-medium sm:self-auto"
                      >
                        <Icons.CheckCircle className="mr-1 size-3.5" />
                        Resolver
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Sync Listing Dialog */}
      <SyncMlListingDialog
        open={Boolean(syncingListing)}
        onClose={() => setSyncingListing(null)}
        listing={syncingListing}
      />
    </div>
  );
}
