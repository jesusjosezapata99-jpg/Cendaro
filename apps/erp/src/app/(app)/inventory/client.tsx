"use client";

import { lazy, Suspense, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";

import type { IconName } from "@cendaro/ui/icons";
import { Button, Input } from "@cendaro/ui";
import { Icon, Icons } from "@cendaro/ui/icons";

import type { StatusTone } from "~/components/status-badge";
import { EmptyState } from "~/components/empty-state";
import { PageHeader } from "~/components/page-header";
import { Skeleton } from "~/components/skeleton";
import { StatCard } from "~/components/stat-card";
import { StatusBadge } from "~/components/status-badge";
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

/** Sales channels → system chart tokens (zero hardcodes). */
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
      label: "ML",
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

/** Stock level → semantic token chip (single source of truth). */
const STATUS_CONFIG: Record<string, { label: string; tone: StatusTone }> = {
  in_stock: { label: "En Stock", tone: "success" },
  low_stock: { label: "Stock Bajo", tone: "warning" },
  out_of_stock: { label: "Sin Stock", tone: "destructive" },
};

/** Shared cell padding + fixed column widths (keeps the split tables aligned). */
const cellPx = "px-4 py-3";
const colWidths = ["w-40", "", "w-28", "w-24", "w-20", "w-20", "w-28"];

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
  stock: number;
}

function getStockStatus(item: StockItem): string {
  if (item.totalStock <= 0) return "out_of_stock";
  if (item.totalStock <= 5) return "low_stock";
  return "in_stock";
}

export default function InventoryClient() {
  const trpc = useTRPC();
  const { data: products, isLoading } = useQuery(
    trpc.inventory.stockOverview.queryOptions({}),
  );
  const { data: channelData } = useQuery(
    trpc.inventory.channelSummary.queryOptions(),
  );
  const { data: warehouses } = useQuery(
    trpc.inventory.listWarehouses.queryOptions(),
  );

  const [showTransfer, setShowTransfer] = useState(false);
  const [showCycle, setShowCycle] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const tableScrollRef = useRef<HTMLDivElement>(null);

  const items = useMemo(() => (products ?? []) as StockItem[], [products]);
  const filtered = useMemo(
    () =>
      items.filter((item) => {
        const stockStatus = getStockStatus(item);
        const matchStatus =
          statusFilter === "all" || stockStatus === statusFilter;
        const matchSearch =
          !searchTerm ||
          item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.sku.toLowerCase().includes(searchTerm.toLowerCase());
        return matchStatus && matchSearch;
      }),
    [items, statusFilter, searchTerm],
  );

  const channelStock = (channelData ??
    CHANNELS.map((ch) => ({
      channel: ch.key,
      stock: 0,
    }))) as ChannelRow[];

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

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => tableScrollRef.current,
    estimateSize: () => 49,
    overscan: 10,
  });

  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 space-y-6 py-4 duration-200 lg:py-8">
      <PageHeader
        title="Inventario"
        description="Control multicanal de stock"
        actions={
          <div className="flex w-full gap-2 sm:w-auto">
            <Button
              variant="secondary"
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

      {/* Channel Stock — horizontal scrollable on mobile */}
      <div className="mobile-scroll-x flex gap-3 pb-1">
        {CHANNELS.map((ch) => {
          const chData = channelStock.find(
            (cs: ChannelRow) => cs.channel === ch.key,
          );
          return (
            <div
              key={ch.key}
              className="border-border-subtle surface-card flex min-w-40 shrink-0 items-center gap-3 rounded-xl border p-4"
            >
              <span
                aria-hidden
                className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${ch.tone}`}
              >
                <Icon name={ch.icon} className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                  {ch.label}
                </p>
                <p className="text-foreground font-mono text-lg font-medium tabular-nums">
                  {(chData?.stock ?? 0).toLocaleString("es-VE")}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Warehouses */}
      {warehouses && warehouses.length > 0 && (
        <div className="mobile-scroll-x flex gap-3 pb-1">
          {warehouses.map((w) => (
            <Link
              key={w.id}
              href={`/inventory/warehouse/${w.id}`}
              className="border-border-subtle surface-card hover:border-primary/30 flex min-w-45 shrink-0 items-center gap-3 rounded-xl border p-4 transition-colors"
            >
              <span className="bg-secondary text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-lg">
                <Icons.Warehouse className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-foreground truncate text-sm font-medium">
                  {w.name}
                </p>
                <p className="text-muted-foreground truncate text-xs">
                  {w.location}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Search + Filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <div className="relative flex-1">
          <Icons.Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            type="text"
            placeholder="Buscar producto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="min-h-11 pl-10"
          />
        </div>
        <div className="mobile-scroll-x flex gap-2 pb-1">
          {["all", "in_stock", "low_stock", "out_of_stock"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`min-h-9 shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === s
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border-subtle text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              }`}
            >
              {s === "all" ? "Todos" : (STATUS_CONFIG[s]?.label ?? s)}
            </button>
          ))}
        </div>
      </div>

      {/* ── Mobile: Card View ─────────────────────── */}
      <div className="space-y-3 md:hidden">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="border-border-subtle surface-card rounded-xl border p-4"
              >
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="mt-2 h-4 w-24" />
              </div>
            ))
          : filtered.map((item) => {
              const statusCfg = STATUS_CONFIG[getStockStatus(item)] ?? {
                label: item.status,
                tone: "neutral" as StatusTone,
              };
              return (
                <div
                  key={item.id}
                  className="border-border-subtle surface-card rounded-xl border p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground truncate font-medium">
                        {item.name}
                      </p>
                      <p className="text-muted-foreground mt-0.5 font-mono text-xs tabular-nums">
                        {item.sku}
                      </p>
                    </div>
                    <StatusBadge tone={statusCfg.tone}>
                      {statusCfg.label}
                    </StatusBadge>
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                    {[
                      { l: "Total", v: item.totalStock, strong: true },
                      { l: "Tienda", v: item.storeStock, strong: false },
                      { l: "ML", v: item.mlStock, strong: false },
                      { l: "Vend.", v: item.vendorStock, strong: false },
                    ].map((c) => (
                      <div key={c.l}>
                        <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                          {c.l}
                        </p>
                        <p
                          className={`text-foreground mt-0.5 font-mono text-sm tabular-nums ${c.strong ? "font-medium" : ""}`}
                        >
                          {c.v.toLocaleString("es-VE")}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
        {!isLoading && filtered.length === 0 && (
          <EmptyState
            icon="Inventory2"
            title="No se encontraron items"
            description="Ajusta la búsqueda o el filtro de stock e inténtalo de nuevo."
          />
        )}
      </div>

      {/* ── Desktop: Virtual Table View ───────────────── */}
      <div className="border-border-subtle surface-card hidden gap-0 overflow-hidden rounded-xl border py-0 md:block">
        <table className="w-full table-fixed text-left text-sm">
          <thead>
            <tr className="border-border-subtle border-b">
              {[
                "SKU",
                "Producto",
                "Estado",
                "Total",
                "Tienda",
                "ML",
                "Vendedores",
              ].map((h, j) => (
                <th
                  key={h}
                  className={`text-muted-foreground ${cellPx} ${colWidths[j]} text-xs font-medium tracking-widest uppercase ${
                    j >= 3 ? "text-right" : j === 2 ? "text-center" : ""
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
        </table>
        <div
          ref={tableScrollRef}
          style={{ height: "min(600px, 70vh)", overflow: "auto" }}
        >
          <table className="w-full table-fixed text-left text-sm">
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr
                    key={i}
                    className="border-border-subtle border-b"
                    style={{ height: "49px" }}
                  >
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className={cellPx}>
                        <Skeleton className="h-5 w-16" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <>
                  {virtualizer.getVirtualItems().map((virtualRow) => {
                    const item = filtered[virtualRow.index];
                    if (!item) return null;
                    const statusCfg = STATUS_CONFIG[getStockStatus(item)] ?? {
                      label: item.status,
                      tone: "neutral" as StatusTone,
                    };
                    return (
                      <tr
                        key={item.id}
                        data-index={virtualRow.index}
                        ref={virtualizer.measureElement}
                        className="border-border-subtle hover:bg-accent/50 border-b transition-colors"
                      >
                        <td
                          className={`text-muted-foreground ${cellPx} ${colWidths[0]} truncate font-mono text-xs tabular-nums`}
                        >
                          {item.sku}
                        </td>
                        <td
                          className={`text-foreground ${cellPx} truncate font-medium`}
                        >
                          {item.name}
                        </td>
                        <td className={`${cellPx} ${colWidths[2]} text-center`}>
                          <StatusBadge tone={statusCfg.tone}>
                            {statusCfg.label}
                          </StatusBadge>
                        </td>
                        <td
                          className={`text-foreground ${cellPx} ${colWidths[3]} text-right font-mono font-medium tabular-nums`}
                        >
                          {item.totalStock.toLocaleString("es-VE")}
                        </td>
                        <td
                          className={`text-muted-foreground ${cellPx} ${colWidths[4]} text-right font-mono text-sm tabular-nums`}
                        >
                          {item.storeStock.toLocaleString("es-VE")}
                        </td>
                        <td
                          className={`text-muted-foreground ${cellPx} ${colWidths[5]} text-right font-mono text-sm tabular-nums`}
                        >
                          {item.mlStock.toLocaleString("es-VE")}
                        </td>
                        <td
                          className={`text-muted-foreground ${cellPx} ${colWidths[6]} text-right font-mono text-sm tabular-nums`}
                        >
                          {item.vendorStock.toLocaleString("es-VE")}
                        </td>
                      </tr>
                    );
                  })}
                </>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr className="hover:bg-transparent">
                  <td colSpan={7} className="px-4 py-6">
                    <EmptyState
                      icon="Inventory2"
                      title="No se encontraron items"
                      description="Ajusta la búsqueda o el filtro de stock e inténtalo de nuevo."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
