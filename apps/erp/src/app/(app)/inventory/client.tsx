"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useTRPC } from "~/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "~/hooks/use-debounce";

const TransferStockDialog = dynamic(
  () => import("~/components/forms/transfer-stock").then((m) => ({ default: m.TransferStockDialog })),
  { ssr: false },
);
const CycleCountDialog = dynamic(
  () => import("~/components/forms/cycle-count").then((m) => ({ default: m.CycleCountDialog })),
  { ssr: false },
);

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-muted ${className}`} />;
}

const WAREHOUSE_ICONS: Record<string, string> = {
  showroom: "storefront",
  warehouse: "warehouse",
  external: "domain",
  transit: "directions_boat",
  reserved: "lock",
  defective: "report",
};

const CHANNEL_META: Record<string, { name: string; icon: string; shared?: boolean }> = {
  store: { name: "Tienda Física", icon: "store" },
  mercadolibre: { name: "Mercado Libre", icon: "shopping_cart" },
  vendors: { name: "Vendedores", icon: "local_shipping" },
  whatsapp: { name: "WhatsApp", icon: "chat", shared: true },
  instagram: { name: "Instagram", icon: "photo_camera", shared: true },
};

export default function InventoryClient() {
  const trpc = useTRPC();

  const { data: stockItems, isLoading: stockLoading } = useQuery(
    trpc.inventory.stockOverview.queryOptions({ search: undefined }),
  );
  const { data: channels } = useQuery(trpc.inventory.channelSummary.queryOptions());
  const { data: warehouses } = useQuery(trpc.inventory.listWarehouses.queryOptions());

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [showLocked, setShowLocked] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showCount, setShowCount] = useState(false);

  const items = stockItems ?? [];
  const filtered = items.filter((p) => {
    const matchSearch =
      !debouncedSearch ||
      p.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      p.sku.toLowerCase().includes(debouncedSearch.toLowerCase());
    const matchLocked = !showLocked || p.locked;
    return matchSearch && matchLocked;
  });

  const totalUnits = items.reduce((s, p) => s + p.totalStock, 0);
  const lockedCount = items.filter((p) => p.locked).length;


  // Build full channel list (live data + shared channels)
  const channelCards = Object.entries(CHANNEL_META).map(([key, meta]) => {
    const live = channels?.find((c) => c.channel === key);
    return {
      id: key,
      ...meta,
      stock: meta.shared ? null : (live?.stock ?? 0),
    };
  });

  return (
    <div className="p-4 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">Inventario</h1>
          <p className="text-sm text-muted-foreground mt-1">Control de stock multialmacén y multicanal</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCount(true)}
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            <span className="material-symbols-outlined text-lg">assignment</span>
            Conteo Cíclico
          </button>
          <button
            onClick={() => setShowTransfer(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <span className="material-symbols-outlined text-lg">swap_horiz</span>
            Transferir Stock
          </button>
        </div>
      </div>

      {/* Channel Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {channelCards.map((ch) => (
          <div key={ch.id} className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-lg text-muted-foreground">{ch.icon}</span>
              <span className="text-xs text-muted-foreground">{ch.name}</span>
            </div>
            <p className="mt-1 text-xl font-bold text-foreground">
              {ch.stock !== null ? ch.stock.toLocaleString() : "—"}
            </p>
            {ch.stock === null && (
              <p className="text-[10px] text-muted-foreground">Usa stock tienda</p>
            )}
          </div>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        {[
          { label: "Total Unidades", value: totalUnits.toLocaleString(), icon: "inventory_2", accent: "border-blue-500/40" },
          { label: "SKUs Únicos", value: items.length, icon: "label", accent: "border-emerald-500/40" },
          { label: "Bloqueados", value: lockedCount, icon: "lock", accent: "border-red-500/40" },
          { label: "Valor Inventario", value: "Sin precios", icon: "attach_money", accent: "border-violet-500/40" },
        ].map((stat) => (
          <div key={stat.label} className={`rounded-xl border-l-4 ${stat.accent} bg-card border border-border p-4`}>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-lg text-muted-foreground">{stat.icon}</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{stat.label}</span>
            </div>
            <p className="mt-1 text-2xl font-bold text-foreground">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Warehouses */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Almacenes</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {(warehouses ?? []).map((wh) => (
            <div key={wh.id} className="rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/30">
              <span className="material-symbols-outlined text-lg text-muted-foreground">
                {WAREHOUSE_ICONS[wh.type] ?? "warehouse"}
              </span>
              <p className="mt-1 text-sm font-medium text-foreground">{wh.name}</p>
              <p className="text-xs text-muted-foreground">{wh.type}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Buscar por nombre o SKU..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-lg border border-border bg-secondary px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/20"
        />
        <label className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={showLocked}
            onChange={(e) => setShowLocked(e.target.checked)}
            className="accent-destructive"
          />
          Solo bloqueados
        </label>
      </div>

      {/* Stock Table */}
      {stockLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
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
              {filtered.map((item) => (
                <tr
                  key={item.id}
                  className={`border-b border-border transition-colors hover:bg-accent/50 ${
                    item.locked ? "bg-red-50 dark:bg-red-900/10" : ""
                  }`}
                >
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.sku}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{item.name}</td>
                  <td className="px-4 py-3 text-center">
                    {item.locked ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/20 px-2.5 py-0.5 text-xs font-bold text-red-600 dark:text-red-400">
                        <span className="material-symbols-outlined text-sm">lock</span> Bloqueado
                      </span>
                    ) : item.totalStock === 0 ? (
                      <span className="inline-block rounded-full bg-amber-100 dark:bg-amber-900/20 px-2.5 py-0.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                        Agotado
                      </span>
                    ) : (
                      <span className="inline-block rounded-full bg-emerald-100 dark:bg-emerald-900/20 px-2.5 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        En Stock
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-foreground">{item.totalStock}</td>
                  <td className="px-4 py-3 text-right font-mono text-muted-foreground">{item.storeStock}</td>
                  <td className="px-4 py-3 text-right font-mono text-muted-foreground">{item.mlStock}</td>
                  <td className="px-4 py-3 text-right font-mono text-muted-foreground">{item.vendorStock}</td>

                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filtered.length === 0 && !stockLoading && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-12 text-muted-foreground">
          <span className="material-symbols-outlined text-3xl mb-2">inventory_2</span>
          <p className="text-sm">No se encontraron productos en el inventario</p>
        </div>
      )}

      {showTransfer && <TransferStockDialog open={showTransfer} onClose={() => setShowTransfer(false)} />}
      {showCount && <CycleCountDialog open={showCount} onClose={() => setShowCount(false)} />}
    </div>
  );
}
