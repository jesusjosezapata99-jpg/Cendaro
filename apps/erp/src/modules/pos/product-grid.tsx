"use client";

import type { RefObject } from "react";

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
  return (
    <div className="space-y-3.5">
      {/* Barcode & Search Input (F2 Shortcut) */}
      <div className="border-border bg-card focus-within:border-primary/60 focus-within:ring-primary/20 relative border p-2.5 shadow-xs transition-shadow focus-within:ring-1">
        <div className="flex min-h-11 items-center gap-2">
          <Icons.BarcodeScanner className="text-muted-foreground size-5 pl-1" />
          <input
            ref={barcodeInputRef}
            type="text"
            placeholder="Escanear código de barras o escribir SKU/Nombre (Enter para agregar)..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={onBarcodeSubmit}
            className="text-foreground placeholder:text-muted-foreground w-full bg-transparent text-xs font-medium focus:outline-none sm:text-sm"
          />
          <div className="flex items-center gap-1">
            <kbd className="border-border bg-secondary text-muted-foreground hidden border px-1.5 py-0.5 font-mono text-[10px] font-medium sm:inline-block">
              F2
            </kbd>
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="text-muted-foreground hover:text-foreground flex min-h-11 min-w-11 items-center justify-center p-2"
                aria-label="Limpiar búsqueda"
              >
                <Icons.Close className="size-4" />
              </button>
            )}
          </div>
        </div>

        {/* Scanner Instant Feedback Toast */}
        {scannerFeedback && (
          <div className="border-primary/40 bg-primary/10 text-primary animate-in fade-in zoom-in-95 absolute -bottom-3 left-6 z-20 flex items-center gap-1 border px-2.5 py-0.5 text-xs font-medium shadow-xs duration-150">
            <Icons.Check className="size-3" />
            <span>{scannerFeedback}</span>
          </div>
        )}
      </div>

      {/* Categories Horizontal Scroll with ≥44px touch targets */}
      <div className="mobile-scroll-x flex items-center gap-2 pb-0.5">
        <button
          type="button"
          onClick={() => onSelectCategory("all")}
          className={`flex min-h-11 items-center justify-center border px-4 py-2 text-xs font-medium whitespace-nowrap transition-colors ${
            selectedCategory === "all"
              ? "border-primary bg-primary text-primary-foreground shadow-xs"
              : "bg-card text-muted-foreground hover:bg-secondary hover:text-foreground border-[--line] hover:border-[--line-hover]"
          }`}
        >
          Todas ({totalProductCount})
        </button>
        {categories.map((cat) => {
          const isSelected = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelectCategory(cat.id)}
              className={`flex min-h-11 items-center justify-center border px-4 py-2 text-xs font-medium whitespace-nowrap transition-colors ${
                isSelected
                  ? "border-primary bg-primary text-primary-foreground shadow-xs"
                  : "bg-card text-muted-foreground hover:bg-secondary hover:text-foreground border-[--line] hover:border-[--line-hover]"
              }`}
            >
              {cat.name}
            </button>
          );
        })}
      </div>

      {/* Product Fast-Tap Cards Grid (Teselas Cuadradas border-[--line] hover:border-[--line-hover]) */}
      <div className="min-h-115">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="border-border bg-card aspect-square animate-pulse border p-3"
              />
            ))}
          </div>
        ) : products.length === 0 ? (
          <EmptyState
            icon="SearchOff"
            title="Sin productos encontrados"
            description={`No hay coincidencias para "${searchQuery}". Intente con otro término o código.`}
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {products.map((p) => {
              const stock = stockMap.get(p.id) ?? 15;
              const priceUsd = 12.5; // Retail standard price
              const dual = formatDualCurrency(priceUsd, bcvRate);
              const isLow = stock > 0 && stock <= 5;
              const isOut = stock <= 0;
              const inCartQty =
                cart.find((line) => line.id === p.id)?.quantity ?? 0;

              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onAddToCart(p, priceUsd)}
                  className={`group relative flex aspect-square flex-col justify-between border p-3 text-left transition-all active:scale-[0.98] ${
                    inCartQty > 0
                      ? "border-foreground bg-[--nav-active] shadow-xs"
                      : "bg-card hover:bg-secondary/40 border-[--line] hover:border-[--line-hover] hover:shadow-xs"
                  }`}
                >
                  {/* Floating In-Cart Badge */}
                  {inCartQty > 0 && (
                    <div className="bg-primary text-primary-foreground border-background absolute -top-1.5 -right-1.5 flex items-center gap-1 border px-2 py-0.5 font-mono text-[10px] font-medium shadow-xs">
                      <Icons.ShoppingCart className="text-[10px]" />
                      <span>x{inCartQty}</span>
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-muted-foreground truncate font-mono text-[10px] font-medium">
                        {p.sku}
                      </span>
                      <span
                        className={`shrink-0 px-1.5 py-0.5 font-mono text-[9px] font-medium ${
                          isOut
                            ? "bg-destructive/15 text-destructive"
                            : isLow
                              ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                              : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {stock} un.
                      </span>
                    </div>
                    <h4 className="text-foreground group-hover:text-primary mt-1.5 line-clamp-2 text-xs leading-snug font-medium transition-colors">
                      {p.name}
                    </h4>
                  </div>

                  <div className="border-border/40 mt-2 border-t pt-2">
                    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between">
                      <span className="text-foreground font-mono text-sm font-black tabular-nums">
                        {dual.usd}
                      </span>
                      <span className="text-primary font-mono text-[10px] font-medium tabular-nums">
                        {dual.bs}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
