"use client";

import type { RefObject } from "react";
import { useState } from "react";

import { Icons } from "@cendaro/ui/icons";

import type { CartLine, CategoryItem, ProductItem } from "./types";
import { EmptyState } from "~/components/empty-state";
import { formatDualCurrency } from "~/lib/format-currency";

interface ProductGridProps {
  products: ProductItem[];
  categories: CategoryItem[];
  totalProductCount: number;
  selectedCategory: string;
  onSelectCategory: (catId: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onBarcodeSubmit: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  barcodeInputRef: RefObject<HTMLInputElement | null>;
  scannerFeedback: string | null;
  isLoading: boolean;
  stockMap: Map<string, number>;
  bcvRate: number;
  cart: CartLine[];
  onAddToCart: (product: ProductItem, price?: number) => void;
}

export function ProductGrid({
  products,
  categories,
  totalProductCount,
  selectedCategory,
  onSelectCategory,
  searchQuery,
  onSearchChange,
  onBarcodeSubmit,
  barcodeInputRef,
  scannerFeedback,
  isLoading,
  stockMap,
  bcvRate,
  cart,
  onAddToCart,
}: ProductGridProps) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  return (
    <div className="border-border bg-card flex flex-col border p-3.5 shadow-xs">
      {/* Top Bar: Barcode & Search Input (F2 Shortcut) + View Switcher */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="border-border bg-background focus-within:border-primary/60 focus-within:ring-primary/20 relative flex min-h-11 flex-1 items-center gap-2 border px-3 transition-shadow focus-within:ring-1">
          <Icons.BarcodeScanner className="text-primary size-5 shrink-0" />
          <input
            ref={barcodeInputRef}
            id="pos-barcode-search-input"
            name="pos-barcode-search"
            type="text"
            placeholder="Escanear código de barras o buscar por SKU o nombre..."
            aria-label="Escanear código de barras o escribir SKU"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={onBarcodeSubmit}
            className="text-foreground placeholder:text-muted-foreground w-full bg-transparent text-xs font-medium focus:outline-none sm:text-sm"
          />
          <div className="flex items-center gap-1.5">
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="text-muted-foreground hover:text-foreground flex size-7 items-center justify-center"
                aria-label="Limpiar búsqueda"
              >
                <Icons.Close className="size-4" />
              </button>
            )}
            <kbd className="border-border bg-secondary text-muted-foreground hidden border px-1.5 py-0.5 font-mono text-[10px] font-medium sm:inline-block">
              F2
            </kbd>
          </div>

          {/* Scanner Instant Feedback Toast */}
          {scannerFeedback && (
            <div className="border-primary/40 bg-primary/10 text-primary animate-in fade-in zoom-in-95 absolute -bottom-3 left-4 z-20 flex items-center gap-1 border px-2.5 py-0.5 text-xs font-medium shadow-xs duration-150">
              <Icons.Check className="size-3" />
              <span>{scannerFeedback}</span>
            </div>
          )}
        </div>

        {/* View Mode Toggle: Compact Grid vs Dense Table */}
        <div className="border-border bg-secondary/40 flex min-h-11 items-center border p-0.5">
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            title="Vista de tarjetas compactas"
            aria-label="Vista de cuadrícula compacta"
            className={`flex min-h-9 items-center gap-1.5 px-2.5 py-1 text-xs font-medium transition-colors ${
              viewMode === "grid"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icons.Overview className="size-3.5" />
            <span className="hidden sm:inline">Tarjetas</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("list")}
            title="Vista de lista densa para mostrador"
            aria-label="Vista de lista densa"
            className={`flex min-h-9 items-center gap-1.5 px-2.5 py-1 text-xs font-medium transition-colors ${
              viewMode === "list"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icons.Menu className="size-3.5" />
            <span className="hidden sm:inline">Lista</span>
          </button>
        </div>
      </div>

      {/* Categories Horizontal Scroll + Active Result Count */}
      <div className="border-border/60 mt-3 flex items-center justify-between gap-3 border-b pb-2.5">
        <div className="mobile-scroll-x flex items-center gap-1.5 pb-0.5">
          <button
            type="button"
            onClick={() => onSelectCategory("all")}
            className={`flex min-h-9 items-center justify-center border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
              selectedCategory === "all"
                ? "border-primary bg-primary text-primary-foreground shadow-xs"
                : "bg-background text-muted-foreground hover:bg-secondary hover:text-foreground border-(--line) hover:border-(--line-hover)"
            }`}
          >
            Todas ({totalProductCount.toLocaleString("es-VE")})
          </button>
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => onSelectCategory(cat.id)}
                className={`flex min-h-9 items-center justify-center border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground shadow-xs"
                    : "bg-background text-muted-foreground hover:bg-secondary hover:text-foreground border-(--line) hover:border-(--line-hover)"
                }`}
              >
                {cat.name}
              </button>
            );
          })}
        </div>

        <span className="text-muted-foreground hidden shrink-0 font-mono text-[11px] tabular-nums xl:inline-block">
          {products.length} visibles de{" "}
          {totalProductCount.toLocaleString("es-VE")}
        </span>
      </div>

      {/* Product Viewport (Independent Scroll Area for Workstation Ergonomics) */}
      <div className="mt-3 max-h-[calc(100dvh-17.5rem)] min-h-105 overflow-y-auto pr-1">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="border-border bg-secondary/30 h-28 animate-pulse border p-3"
              />
            ))}
          </div>
        ) : products.length === 0 ? (
          <EmptyState
            icon="SearchOff"
            title="Sin productos encontrados"
            description={
              searchQuery
                ? `No hay coincidencias para "${searchQuery}". Intente con otro SKU, código de barras o nombre.`
                : "No hay productos activos en esta categoría."
            }
          />
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
            {products.map((p) => {
              const stock =
                stockMap.get(p.id) ?? p.storeStock ?? p.stockCount ?? 0;
              const priceUsd = p.posPriceUsd ?? p.basePriceUsd ?? 0;
              const dual = formatDualCurrency(priceUsd, bcvRate);
              const isLow = stock > 0 && stock <= 5;
              const isOut = stock <= 0;
              const isUnpriced = priceUsd <= 0;
              const inCartQty =
                cart.find((line) => line.id === p.id)?.quantity ?? 0;

              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={isOut || isUnpriced}
                  onClick={() => onAddToCart(p, priceUsd)}
                  className={`group relative flex min-h-28 flex-col justify-between border p-3 text-left transition-all active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55 ${
                    inCartQty > 0
                      ? "border-primary bg-primary/5 shadow-xs"
                      : "bg-background hover:bg-secondary/40 border-(--line) hover:border-(--line-hover)"
                  }`}
                >
                  {/* Top Row: SKU + Stock Pill */}
                  <div className="flex w-full items-center justify-between gap-1.5">
                    <span className="text-muted-foreground truncate font-mono text-[10px] font-medium">
                      {p.sku}
                    </span>
                    <div className="flex items-center gap-1">
                      {inCartQty > 0 && (
                        <span className="bg-primary text-primary-foreground px-1.5 py-0.5 font-mono text-[10px] font-medium tabular-nums">
                          x{inCartQty}
                        </span>
                      )}
                      <span
                        className={`shrink-0 px-1.5 py-0.5 font-mono text-[10px] font-medium tabular-nums ${
                          isOut
                            ? "bg-destructive/15 text-destructive"
                            : isLow
                              ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                              : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {isOut ? "Agotado" : `${stock} un.`}
                      </span>
                    </div>
                  </div>

                  {/* Middle Row: Product Name (2 lines max, no wasted square whitespace) */}
                  <h4 className="text-foreground group-hover:text-primary my-1.5 line-clamp-2 text-xs leading-snug font-medium transition-colors">
                    {p.name}
                  </h4>

                  {/* Bottom Row: Dual Currency Price */}
                  <div className="border-border/50 flex w-full items-baseline justify-between gap-1 border-t pt-2">
                    <span className="text-foreground font-mono text-sm font-medium tabular-nums">
                      {isUnpriced ? "Sin precio" : dual.usd}
                    </span>
                    <span className="text-primary truncate font-mono text-[10px] font-medium tabular-nums">
                      {isUnpriced ? "—" : dual.bs}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          /* High-Density Cashier Table View */
          <div className="border-border overflow-hidden border">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-border bg-secondary/60 text-muted-foreground border-b text-[10px] tracking-wider uppercase">
                  <th className="px-3 py-2 font-medium">SKU</th>
                  <th className="px-3 py-2 font-medium">Artículo</th>
                  <th className="px-3 py-2 text-right font-medium">Stock</th>
                  <th className="px-3 py-2 text-right font-medium">USD</th>
                  <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">
                    Bolívares (BCV)
                  </th>
                  <th className="px-3 py-2 text-right font-medium">Ticket</th>
                </tr>
              </thead>
              <tbody className="divide-border/50 divide-y">
                {products.map((p) => {
                  const stock =
                    stockMap.get(p.id) ?? p.storeStock ?? p.stockCount ?? 0;
                  const priceUsd = p.posPriceUsd ?? p.basePriceUsd ?? 0;
                  const dual = formatDualCurrency(priceUsd, bcvRate);
                  const isLow = stock > 0 && stock <= 5;
                  const isOut = stock <= 0;
                  const isUnpriced = priceUsd <= 0;
                  const inCartQty =
                    cart.find((line) => line.id === p.id)?.quantity ?? 0;

                  return (
                    <tr
                      key={p.id}
                      onClick={() => {
                        if (!isOut && !isUnpriced) onAddToCart(p, priceUsd);
                      }}
                      className={`transition-colors ${
                        isOut || isUnpriced
                          ? "cursor-not-allowed opacity-55"
                          : "hover:bg-secondary/50 cursor-pointer"
                      } ${inCartQty > 0 ? "bg-primary/5" : "bg-background"}`}
                    >
                      <td className="text-primary px-3 py-2.5 font-mono text-[11px] font-medium whitespace-nowrap">
                        {p.sku}
                      </td>
                      <td className="text-foreground max-w-64 truncate px-3 py-2.5 font-medium">
                        {p.name}
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        <span
                          className={`px-1.5 py-0.5 font-mono text-[10px] font-medium tabular-nums ${
                            isOut
                              ? "bg-destructive/15 text-destructive"
                              : isLow
                                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                                : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {isOut ? "Agotado" : `${stock} un.`}
                        </span>
                      </td>
                      <td className="text-foreground px-3 py-2.5 text-right font-mono font-medium whitespace-nowrap tabular-nums">
                        {isUnpriced ? "Sin precio" : dual.usd}
                      </td>
                      <td className="text-muted-foreground hidden px-3 py-2.5 text-right font-mono text-[11px] whitespace-nowrap tabular-nums sm:table-cell">
                        {isUnpriced ? "—" : dual.bs}
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          disabled={isOut || isUnpriced}
                          onClick={(e) => {
                            e.stopPropagation();
                            onAddToCart(p, priceUsd);
                          }}
                          className={`inline-flex min-h-7 items-center gap-1 border px-2 py-1 font-mono text-[11px] font-medium transition-colors disabled:opacity-40 ${
                            inCartQty > 0
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-secondary text-foreground hover:border-primary"
                          }`}
                        >
                          <Icons.Add className="size-3" />
                          {inCartQty > 0 ? `x${inCartQty}` : "Agregar"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
