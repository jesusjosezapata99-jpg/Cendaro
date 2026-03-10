"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";

import { useDebounce } from "~/hooks/use-debounce";
import { useTRPC } from "~/trpc/client";

const TransferStockDialog = dynamic(
  () =>
    import("~/components/forms/transfer-stock").then((m) => ({
      default: m.TransferStockDialog,
    })),
  { ssr: false },
);
const CycleCountDialog = dynamic(
  () =>
    import("~/components/forms/cycle-count").then((m) => ({
      default: m.CycleCountDialog,
    })),
  { ssr: false },
);

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`bg-muted animate-pulse rounded-lg ${className}`} />;
}

const WAREHOUSE_ICONS: Record<string, string> = {
  showroom: "storefront",
  warehouse: "warehouse",
  external: "domain",
  transit: "directions_boat",
  reserved: "lock",
  defective: "report",
};

const CHANNEL_META: Record<
  string,
  { name: string; icon: string; shared?: boolean }
> = {
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
  const { data: channels } = useQuery(
    trpc.inventory.channelSummary.queryOptions(),
  );
  const { data: warehouses } = useQuery(
    trpc.inventory.listWarehouses.queryOptions(),
  );

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
    <div className="space-y-6 p-4 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-black tracking-tight">
            Inventario
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Control de stock multialmacén y multicanal
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCount(true)}
            className="border-border bg-card text-foreground hover:bg-accent flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
          >
            <span className="material-symbols-outlined text-lg">
              assignment
            </span>
            Conteo Cíclico
          </button>
          <button
            onClick={() => setShowTransfer(true)}
            className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            <span className="material-symbols-outlined text-lg">
              swap_horiz
            </span>
            Transferir Stock
          </button>
        </div>
      </div>

      {/* Channel Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {channelCards.map((ch) => (
          <div
            key={ch.id}
            className="border-border bg-card rounded-xl border p-3"
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-muted-foreground text-lg">
                {ch.icon}
              </span>
              <span className="text-muted-foreground text-xs">{ch.name}</span>
            </div>
            <p className="text-foreground mt-1 text-xl font-bold">
              {ch.stock !== null ? ch.stock.toLocaleString() : "—"}
            </p>
            {ch.stock === null && (
              <p className="text-muted-foreground text-[10px]">
                Usa stock tienda
              </p>
            )}
          </div>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        {[
          {
            label: "Total Unidades",
            value: totalUnits.toLocaleString(),
            icon: "inventory_2",
            accent: "border-blue-500/40",
          },
          {
            label: "SKUs Únicos",
            value: items.length,
            icon: "label",
            accent: "border-emerald-500/40",
          },
          {
            label: "Bloqueados",
            value: lockedCount,
            icon: "lock",
            accent: "border-red-500/40",
          },
          {
            label: "Valor Inventario",
            value: "Sin precios",
            icon: "attach_money",
            accent: "border-violet-500/40",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className={`rounded-xl border-l-4 ${stat.accent} bg-card border-border border p-4`}
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-muted-foreground text-lg">
                {stat.icon}
              </span>
              <span className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
                {stat.label}
              </span>
            </div>
            <p className="text-foreground mt-1 text-2xl font-bold">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Warehouses */}
      <div>
        <h2 className="text-muted-foreground mb-3 text-sm font-semibold">
          Almacenes
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {(warehouses ?? []).map((wh) => (
            <div
              key={wh.id}
              className="border-border bg-card hover:border-primary/30 rounded-lg border p-3 transition-colors"
            >
              <span className="material-symbols-outlined text-muted-foreground text-lg">
                {WAREHOUSE_ICONS[wh.type] ?? "warehouse"}
              </span>
              <p className="text-foreground mt-1 text-sm font-medium">
                {wh.name}
              </p>
              <p className="text-muted-foreground text-xs">{wh.type}</p>
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
          className="border-border bg-secondary text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-ring/20 flex-1 rounded-lg border px-4 py-2.5 text-sm outline-none focus:ring-2"
        />
        <label className="border-border bg-card text-foreground flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
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
        <div className="border-border bg-card overflow-hidden rounded-xl border">
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
              {filtered.map((item) => (
                <tr
                  key={item.id}
                  className={`border-border hover:bg-accent/50 border-b transition-colors ${
                    item.locked ? "bg-red-50 dark:bg-red-900/10" : ""
                  }`}
                >
                  <td className="text-muted-foreground px-4 py-3 font-mono text-xs">
                    {item.sku}
                  </td>
                  <td className="text-foreground px-4 py-3 font-medium">
                    {item.name}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {item.locked ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-600 dark:bg-red-900/20 dark:text-red-400">
                        <span className="material-symbols-outlined text-sm">
                          lock
                        </span>{" "}
                        Bloqueado
                      </span>
                    ) : item.totalStock === 0 ? (
                      <span className="inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-600 dark:bg-amber-900/20 dark:text-amber-400">
                        Agotado
                      </span>
                    ) : (
                      <span className="inline-block rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
                        En Stock
                      </span>
                    )}
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
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filtered.length === 0 && !stockLoading && (
        <div className="border-border bg-card text-muted-foreground flex flex-col items-center justify-center rounded-xl border py-12">
          <span className="material-symbols-outlined mb-2 text-3xl">
            inventory_2
          </span>
          <p className="text-sm">
            No se encontraron productos en el inventario
          </p>
        </div>
      )}

      {showTransfer && (
        <TransferStockDialog
          open={showTransfer}
          onClose={() => setShowTransfer(false)}
        />
      )}
      {showCount && (
        <CycleCountDialog
          open={showCount}
          onClose={() => setShowCount(false)}
        />
      )}
    </div>
  );
}
