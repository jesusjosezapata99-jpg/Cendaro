"use client";

import { lazy, Suspense, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

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

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`bg-muted animate-pulse rounded-lg ${className}`} />;
}

const CHANNELS = [
  { key: "store", label: "Tienda", icon: "store", color: "text-blue-500" },
  {
    key: "mercadolibre",
    label: "ML",
    icon: "shopping_cart",
    color: "text-amber-500",
  },
  {
    key: "vendors",
    label: "Vendedores",
    icon: "group",
    color: "text-cyan-500",
  },
];

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  in_stock: {
    label: "En Stock",
    color:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  },
  low_stock: {
    label: "Stock Bajo",
    color:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  },
  out_of_stock: {
    label: "Sin Stock",
    color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  },
};

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

  const items = (products ?? []) as StockItem[];
  const filtered = items.filter((item) => {
    const stockStatus = getStockStatus(item);
    const matchStatus = statusFilter === "all" || stockStatus === statusFilter;
    const matchSearch =
      !searchTerm ||
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchTerm.toLowerCase());
    return matchStatus && matchSearch;
  });

  const channelStock = (channelData ??
    CHANNELS.map((ch) => ({
      channel: ch.key,
      stock: 0,
    }))) as ChannelRow[];

  const totalStock = items.reduce((s, it) => s + it.totalStock, 0);
  const lowStockCount = items.filter(
    (it) => getStockStatus(it) === "low_stock",
  ).length;
  const outOfStockCount = items.filter(
    (it) => getStockStatus(it) === "out_of_stock",
  ).length;

  return (
    <div className="space-y-6 p-4 lg:p-8">
      {/* Header — stacks vertically on mobile */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-black tracking-tight">
            Inventario
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Control multicanal de stock
          </p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <button
            onClick={() => setShowTransfer(true)}
            className="bg-secondary text-foreground hover:bg-accent flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors sm:flex-initial"
          >
            <span className="material-symbols-outlined text-lg">
              swap_horiz
            </span>
            <span>Transferir</span>
          </button>
          <button
            onClick={() => setShowCycle(true)}
            className="bg-primary text-primary-foreground hover:bg-primary/90 flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-bold transition-colors sm:flex-initial"
          >
            <span className="material-symbols-outlined text-lg">
              fact_check
            </span>
            <span>Conteo</span>
          </button>
        </div>
      </div>

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
        {[
          {
            label: "Stock Total",
            value: isLoading ? "—" : totalStock.toLocaleString(),
            icon: "inventory_2",
            accent: "border-blue-500/40",
          },
          {
            label: "Productos",
            value: isLoading ? "—" : items.length,
            icon: "category",
            accent: "border-emerald-500/40",
          },
          {
            label: "Bajo Stock",
            value: isLoading ? "—" : lowStockCount,
            icon: "trending_down",
            accent: "border-amber-500/40",
          },
          {
            label: "Sin Stock",
            value: isLoading ? "—" : outOfStockCount,
            icon: "error",
            accent: "border-red-500/40",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className={`rounded-xl border-l-4 ${stat.accent} bg-card border-border border p-3`}
          >
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-muted-foreground text-lg">
                {stat.icon}
              </span>
              <span className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
                {stat.label}
              </span>
            </div>
            <p className="text-foreground mt-1 text-lg font-bold">
              {stat.value}
            </p>
          </div>
        ))}
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
              className="border-border bg-card flex min-w-[160px] shrink-0 items-center gap-3 rounded-xl border p-4"
            >
              <span
                className={`material-symbols-outlined text-2xl ${ch.color}`}
              >
                {ch.icon}
              </span>
              <div>
                <p className="text-muted-foreground text-[10px] font-bold uppercase">
                  {ch.label}
                </p>
                <p className="text-foreground text-lg font-bold">
                  {chData?.stock ?? 0}
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
              className="border-border bg-card hover:border-primary/30 flex min-w-[180px] shrink-0 items-center gap-3 rounded-xl border p-4 transition-colors"
            >
              <span className="material-symbols-outlined text-muted-foreground text-2xl">
                warehouse
              </span>
              <div>
                <p className="text-foreground text-sm font-bold">{w.name}</p>
                <p className="text-muted-foreground text-xs">{w.location}</p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Search + Filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <input
          type="text"
          placeholder="Buscar producto..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="border-border bg-card text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-ring/20 min-h-[44px] flex-1 rounded-lg border px-4 py-2.5 text-sm transition-colors outline-none focus:ring-2"
        />
        <div className="mobile-scroll-x flex gap-2 pb-1">
          {["all", "in_stock", "low_stock", "out_of_stock"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`min-h-[36px] shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                statusFilter === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:bg-accent"
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
              <Skeleton key={i} className="h-24 w-full" />
            ))
          : filtered.map((item) => {
              const stockStatus = getStockStatus(item);
              const statusCfg = STATUS_CONFIG[stockStatus] ?? {
                label: stockStatus,
                color: "",
              };
              return (
                <div
                  key={item.id}
                  className="border-border bg-card rounded-xl border p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground truncate font-medium">
                        {item.name}
                      </p>
                      <p className="text-muted-foreground mt-0.5 font-mono text-xs">
                        {item.sku}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${statusCfg.color}`}
                    >
                      {statusCfg.label}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                    <div>
                      <p className="text-muted-foreground text-[10px] font-bold uppercase">
                        Total
                      </p>
                      <p className="text-foreground font-mono text-sm font-bold">
                        {item.totalStock}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-[10px] font-bold uppercase">
                        Tienda
                      </p>
                      <p className="text-foreground font-mono text-sm">
                        {item.storeStock}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-[10px] font-bold uppercase">
                        ML
                      </p>
                      <p className="text-foreground font-mono text-sm">
                        {item.mlStock}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-[10px] font-bold uppercase">
                        Vend.
                      </p>
                      <p className="text-foreground font-mono text-sm">
                        {item.vendorStock}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
        {!isLoading && filtered.length === 0 && (
          <div className="text-muted-foreground flex flex-col items-center py-12 text-center">
            <span className="material-symbols-outlined mb-2 text-3xl">
              inventory_2
            </span>
            No se encontraron items
          </div>
        )}
      </div>

      {/* ── Desktop: Table View ───────────────────── */}
      <div className="border-border bg-card hidden overflow-hidden rounded-xl border md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-border text-muted-foreground border-b text-[10px] font-bold tracking-widest uppercase">
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">Producto</th>
              <th className="px-4 py-3 text-center">Estado</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-right">Tienda</th>
              <th className="px-4 py-3 text-right">ML</th>
              <th className="px-4 py-3 text-right">Vendedores</th>
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-border border-b">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <Skeleton className="h-5 w-16" />
                      </td>
                    ))}
                  </tr>
                ))
              : filtered.map((item) => {
                  const stockStatus = getStockStatus(item);
                  const statusCfg = STATUS_CONFIG[stockStatus] ?? {
                    label: stockStatus,
                    color: "",
                  };
                  return (
                    <tr
                      key={item.id}
                      className="border-border hover:bg-accent/50 border-b transition-colors"
                    >
                      <td className="text-muted-foreground px-4 py-3 font-mono text-xs">
                        {item.sku}
                      </td>
                      <td className="text-foreground px-4 py-3 font-medium">
                        {item.name}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${statusCfg.color}`}
                        >
                          {statusCfg.label}
                        </span>
                      </td>
                      <td className="text-foreground px-4 py-3 text-right font-mono font-bold">
                        {item.totalStock}
                      </td>
                      <td className="text-muted-foreground px-4 py-3 text-right font-mono">
                        {item.storeStock}
                      </td>
                      <td className="text-muted-foreground px-4 py-3 text-right font-mono">
                        {item.mlStock}
                      </td>
                      <td className="text-muted-foreground px-4 py-3 text-right font-mono">
                        {item.vendorStock}
                      </td>
                    </tr>
                  );
                })}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="text-muted-foreground px-4 py-12 text-center"
                >
                  <span className="material-symbols-outlined mb-2 block text-3xl">
                    inventory_2
                  </span>
                  No se encontraron items
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
