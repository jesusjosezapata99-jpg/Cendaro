"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Icons } from "@cendaro/ui/icons";

import { EmptyState } from "~/components/empty-state";
import { SyncMlListingDialog } from "~/components/modals/sync-ml-listing-dialog";
import { PageHeader } from "~/components/page-header";
import { StatCard } from "~/components/stat-card";
import { StatusBadge } from "~/components/status-badge";
import { useBcvRate } from "~/hooks/use-bcv-rate";
import { formatDualCurrency } from "~/lib/format-currency";
import { useTRPC } from "~/trpc/client";

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`bg-muted animate-pulse rounded-lg ${className}`} />;
}

type TabType = "listings" | "orders" | "logs";

export default function MarketplacePage() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const bcv = useBcvRate();

  const [tab, setTab] = useState<TabType>("listings");
  const [search, setSearch] = useState("");
  const [listingFilter, setListingFilter] = useState<string>("all");
  const [syncingListing, setSyncingListing] = useState<{
    id: string;
    mlItemId: string;
    title: string;
    price: number;
    stockSynced: number | null;
    status: string;
  } | null>(null);

  const { data: listings, isLoading: listingsLoading } = useQuery(
    trpc.integrations.listMlListings.queryOptions({ limit: 50 }),
  );
  const { data: orders, isLoading: ordersLoading } = useQuery(
    trpc.integrations.listMlOrders.queryOptions({ limit: 50 }),
  );
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

  const listingItems = useMemo(() => listings ?? [], [listings]);
  const orderItems = useMemo(() => orders ?? [], [orders]);
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

  const getListingTone = (status: string) => {
    switch (status) {
      case "active":
        return "success";
      case "paused":
        return "warning";
      case "out_of_stock":
      case "error":
        return "destructive";
      default:
        return "neutral";
    }
  };

  const getListingLabel = (status: string) => {
    switch (status) {
      case "active":
        return "Activo";
      case "paused":
        return "Pausado";
      case "closed":
        return "Cerrado";
      case "out_of_stock":
        return "Sin Stock";
      case "error":
        return "Error";
      default:
        return status;
    }
  };

  return (
    <div className="space-y-6 py-4 lg:py-8">
      {/* Header */}
      <PageHeader
        title="Mercado Libre B2B"
        description="Panel de integración omnicanal, sincronización de publicaciones y gestión de pedidos"
        actions={
          <button
            type="button"
            onClick={handleSyncAll}
            className="surface-card border-border text-foreground hover:bg-accent flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all active:scale-[0.98]"
          >
            <Icons.Sync className="size-4" />
            Sincronizar Todo
          </button>
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
        <div className="surface-card flex items-center justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4">
          <div className="flex items-center gap-3">
            <Icons.Warning className="size-5 text-rose-400" />
            <div>
              <p className="text-sm font-medium text-rose-400">
                {activeAlerts} alerta{activeAlerts > 1 ? "s" : ""} de
                integración requieren atención
              </p>
              <p className="text-xs text-rose-400/80">
                Se detectaron eventos críticos en la sincronización con Mercado
                Libre
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setTab("logs")}
            className="surface-card rounded-lg border border-rose-500/30 px-3 py-1.5 text-xs font-medium text-rose-400 transition-colors hover:bg-rose-500/20"
          >
            Ver Logs
          </button>
        </div>
      )}

      {/* Tabs & Search */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="surface-card flex gap-1 rounded-xl p-1">
          <button
            type="button"
            onClick={() => setTab("listings")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === "listings"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icons.Package2 className="size-4" />
            Publicaciones
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
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
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === "orders"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icons.ShoppingCart className="size-4" />
            Órdenes ML
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
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
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === "logs"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icons.ListAlt className="size-4" />
            Logs & Eventos
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
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
          <Icons.Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4.5 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por ID, título, comprador..."
            className="border-border bg-card text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-ring/20 min-h-10 w-full rounded-lg border py-2 pr-4 pl-10 text-sm transition-colors outline-none focus:ring-2"
          />
        </div>
      </div>

      {/* Listings Tab */}
      {tab === "listings" && (
        <div className="space-y-4">
          {/* Subfilter Chips */}
          <div className="flex flex-wrap gap-2">
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
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  listingFilter === f.key
                    ? "bg-primary text-primary-foreground"
                    : "surface-card text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {listingsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : filteredListings.length === 0 ? (
            <EmptyState
              icon="Storefront"
              title="No se encontraron publicaciones"
              description="No hay artículos sincronizados que coincidan con los filtros seleccionados."
            />
          ) : (
            <>
              {/* Mobile Cards */}
              <div className="grid grid-cols-1 gap-3 md:hidden">
                {filteredListings.map((l) => {
                  const dual = formatDualCurrency(l.price, bcv.rate);
                  return (
                    <div
                      key={l.id}
                      className="surface-card space-y-3 rounded-xl p-4"
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
                        <StatusBadge tone={getListingTone(l.status)}>
                          {getListingLabel(l.status)}
                        </StatusBadge>
                      </div>

                      <div className="border-border/50 flex items-center justify-between border-t pt-2 text-xs">
                        <div>
                          <p className="text-muted-foreground text-[10px] tracking-wider uppercase">
                            Precio de Venta
                          </p>
                          <p className="text-foreground font-mono text-sm font-medium">
                            {dual.usd}
                          </p>
                          {bcv.rate > 0 && (
                            <p className="text-muted-foreground font-mono text-[10px]">
                              {dual.bs}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-muted-foreground text-[10px] tracking-wider uppercase">
                            Stock ML
                          </p>
                          <p className="text-foreground font-mono text-sm font-medium">
                            {l.stockSynced ?? 0} uds
                          </p>
                        </div>
                      </div>

                      <div className="border-border/50 flex items-center justify-between border-t pt-2">
                        <span className="text-muted-foreground font-mono text-[10px]">
                          {l.lastSyncAt
                            ? `Sync: ${new Date(l.lastSyncAt).toLocaleDateString()}`
                            : "Sin sync"}
                        </span>
                        <button
                          type="button"
                          onClick={() => setSyncingListing(l)}
                          className="surface-card border-border text-foreground hover:bg-accent flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition-all active:scale-[0.98]"
                        >
                          <Icons.Sync className="size-3.5" />
                          Ajustar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table */}
              <div className="surface-card border-border hidden overflow-hidden rounded-xl border md:block">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-border bg-muted/30 text-muted-foreground border-b text-xs font-medium uppercase">
                      <th className="px-4 py-3 font-mono">ML ID</th>
                      <th className="px-4 py-3">Título de Publicación</th>
                      <th className="px-4 py-3 text-right">Precio USD / Bs</th>
                      <th className="px-4 py-3 text-center">Estado</th>
                      <th className="px-4 py-3 text-right">
                        Stock Sincronizado
                      </th>
                      <th className="px-4 py-3">Última Sincronización</th>
                      <th className="px-4 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-border divide-y">
                    {filteredListings.map((l) => {
                      const dual = formatDualCurrency(l.price, bcv.rate);
                      return (
                        <tr
                          key={l.id}
                          className="hover:bg-accent/40 transition-colors"
                        >
                          <td className="text-primary px-4 py-3 font-mono text-xs font-medium">
                            {l.mlItemId}
                          </td>
                          <td className="text-foreground max-w-md truncate px-4 py-3 font-medium">
                            {l.title}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <p className="text-foreground font-mono text-sm font-medium">
                              {dual.usd}
                            </p>
                            {bcv.rate > 0 && (
                              <p className="text-muted-foreground font-mono text-[10px]">
                                {dual.bs}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <StatusBadge tone={getListingTone(l.status)}>
                              {getListingLabel(l.status)}
                            </StatusBadge>
                          </td>
                          <td className="text-foreground px-4 py-3 text-right font-mono font-medium">
                            {l.stockSynced ?? 0}
                          </td>
                          <td className="text-muted-foreground px-4 py-3 font-mono text-xs">
                            {l.lastSyncAt
                              ? new Date(l.lastSyncAt).toLocaleString()
                              : "Nunca"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => setSyncingListing(l)}
                              className="surface-card border-border text-foreground hover:bg-accent ml-auto flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all active:scale-[0.98]"
                            >
                              <Icons.Sync className="size-3.5" />
                              Sincronizar
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Orders Tab */}
      {tab === "orders" && (
        <div className="space-y-4">
          {ordersLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : filteredOrders.length === 0 ? (
            <EmptyState
              icon="ShoppingCart"
              title="No hay órdenes de Mercado Libre"
              description="Las ventas originadas en Mercado Libre se sincronizarán y mostrarán aquí para su importación al ERP."
            />
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
                      className="surface-card space-y-3 rounded-xl p-4"
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
                        <StatusBadge
                          tone={o.isImported ? "success" : "warning"}
                        >
                          {o.isImported ? "Importado a ERP" : "Pendiente"}
                        </StatusBadge>
                      </div>

                      <div className="border-border/50 flex items-center justify-between border-t pt-2 text-xs">
                        <div>
                          <p className="text-muted-foreground text-[10px] tracking-wider uppercase">
                            Total Orden
                          </p>
                          <p className="text-foreground font-mono text-sm font-medium">
                            {dual.usd}
                          </p>
                          {bcv.rate > 0 && (
                            <p className="text-muted-foreground font-mono text-[10px]">
                              {dual.bs}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-muted-foreground text-[10px] tracking-wider uppercase">
                            Cantidad
                          </p>
                          <p className="text-foreground font-mono text-sm font-medium">
                            {o.quantity} uds (${o.unitPrice.toFixed(2)} c/u)
                          </p>
                        </div>
                      </div>

                      <div className="border-border/50 flex items-center justify-between border-t pt-2">
                        <span className="text-muted-foreground text-xs font-medium">
                          Envío: {o.shippingStatus ?? "Pendiente"}
                        </span>
                        {!o.isImported && (
                          <button
                            type="button"
                            onClick={() => importOrder.mutate({ id: o.id })}
                            disabled={importOrder.isPending}
                            className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium shadow-sm transition-all active:scale-[0.98] disabled:opacity-50"
                          >
                            <Icons.CloudUpload className="size-3.5" />
                            Importar
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table */}
              <div className="surface-card border-border hidden overflow-hidden rounded-xl border md:block">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-border bg-muted/30 text-muted-foreground border-b text-xs font-medium uppercase">
                      <th className="px-4 py-3 font-mono">Orden ML</th>
                      <th className="px-4 py-3">Comprador</th>
                      <th className="px-4 py-3 text-right">Precio Unit.</th>
                      <th className="px-4 py-3 text-right">Cant.</th>
                      <th className="px-4 py-3 text-right">Total USD / Bs</th>
                      <th className="px-4 py-3 text-center">Estado Envío</th>
                      <th className="px-4 py-3 text-center">Estado ERP</th>
                      <th className="px-4 py-3 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-border divide-y">
                    {filteredOrders.map((o) => {
                      const total = o.unitPrice * o.quantity;
                      const dual = formatDualCurrency(total, bcv.rate);
                      return (
                        <tr
                          key={o.id}
                          className="hover:bg-accent/40 transition-colors"
                        >
                          <td className="text-primary px-4 py-3 font-mono text-xs font-medium">
                            {o.mlOrderId}
                          </td>
                          <td className="text-foreground px-4 py-3 font-medium">
                            {o.buyerNickname ?? "—"}
                          </td>
                          <td className="text-muted-foreground px-4 py-3 text-right font-mono">
                            ${o.unitPrice.toFixed(2)}
                          </td>
                          <td className="text-muted-foreground px-4 py-3 text-right font-mono">
                            {o.quantity}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <p className="text-foreground font-mono text-sm font-medium">
                              {dual.usd}
                            </p>
                            {bcv.rate > 0 && (
                              <p className="text-muted-foreground font-mono text-[10px]">
                                {dual.bs}
                              </p>
                            )}
                          </td>
                          <td className="text-muted-foreground px-4 py-3 text-center font-mono text-xs">
                            {o.shippingStatus ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <StatusBadge
                              tone={o.isImported ? "success" : "warning"}
                            >
                              {o.isImported ? "Importado" : "Pendiente"}
                            </StatusBadge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {!o.isImported ? (
                              <button
                                type="button"
                                onClick={() => importOrder.mutate({ id: o.id })}
                                disabled={importOrder.isPending}
                                className="bg-primary text-primary-foreground hover:bg-primary/90 ml-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium shadow-sm transition-all active:scale-[0.98] disabled:opacity-50"
                              >
                                <Icons.CloudUpload className="size-3.5" />
                                Importar
                              </button>
                            ) : (
                              <Icons.CheckCircle className="size-4 text-emerald-400" />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Logs Tab */}
      {tab === "logs" && (
        <div className="space-y-3">
          {logsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredLogs.length === 0 ? (
            <EmptyState
              icon="ListAlt"
              title="Sin registros de eventos"
              description="No hay incidencias o registros de sincronización de Mercado Libre."
            />
          ) : (
            filteredLogs.map((log) => {
              const tone =
                log.level === "error"
                  ? "destructive"
                  : log.level === "warning"
                    ? "warning"
                    : "neutral";
              return (
                <div
                  key={log.id}
                  className={`surface-card rounded-xl border p-4 transition-colors ${
                    log.isResolved
                      ? "border-border/60 opacity-60"
                      : "border-border"
                  }`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <StatusBadge tone={tone}>
                        {log.level.toUpperCase()}
                      </StatusBadge>
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
                        <p className="text-muted-foreground mt-1 font-mono text-xs">
                          {new Date(log.createdAt).toLocaleString()} · Origen:{" "}
                          {log.source}
                        </p>
                      </div>
                    </div>
                    {!log.isResolved && (
                      <button
                        type="button"
                        onClick={() => resolveLog.mutate({ id: log.id })}
                        disabled={resolveLog.isPending}
                        className="surface-card border-border text-foreground hover:bg-accent flex items-center gap-1.5 self-start rounded-lg border px-3 py-1.5 text-xs font-medium transition-all active:scale-[0.98] disabled:opacity-50 sm:self-auto"
                      >
                        <Icons.CheckCircle className="size-3.5" />
                        Resolver
                      </button>
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
