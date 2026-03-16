"use client";

/**
 * Cendaro — Catalog Preview Step
 *
 * Step 5 (Initialize mode only): shows brands and products
 * that will be created. Allows the user to review before importing.
 *
 * PRD: FEATURE_PRD_INVENTORY_IMPORT.md §23
 */
import { useMemo, useState } from "react";

import type { InitializeValidatedRow } from "../lib/inventory-validators";

// ── Props ────────────────────────────────────────

interface CatalogPreviewProps {
  initializeRows: InitializeValidatedRow[];
  catalogPreview: {
    brands: { name: string; isNew: boolean }[];
    products: {
      sku: string;
      name: string;
      brand: string;
      isNew: boolean;
    }[];
  };
  onProceed: () => void;
  onBack: () => void;
}

// ── Component ────────────────────────────────────

export function CatalogPreview({
  catalogPreview,
  onProceed,
  onBack,
}: CatalogPreviewProps) {
  const [tab, setTab] = useState<"brands" | "products">("brands");

  const { brands, products } = catalogPreview;

  const newBrands = useMemo(() => brands.filter((b) => b.isNew), [brands]);
  const existingBrands = useMemo(
    () => brands.filter((b) => !b.isNew),
    [brands],
  );
  const newProducts = useMemo(
    () => products.filter((p) => p.isNew),
    [products],
  );
  const existingProducts = useMemo(
    () => products.filter((p) => !p.isNew),
    [products],
  );

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Marcas nuevas"
          value={newBrands.length}
          icon="add_circle"
          color="emerald"
        />
        <StatCard
          label="Marcas existentes"
          value={existingBrands.length}
          icon="check_circle"
          color="sky"
        />
        <StatCard
          label="Productos nuevos"
          value={newProducts.length}
          icon="inventory_2"
          color="emerald"
        />
        <StatCard
          label="Productos existentes"
          value={existingProducts.length}
          icon="inventory"
          color="sky"
        />
      </div>

      {/* Tabs */}
      <div className="border-border flex items-center gap-1 border-b">
        <button
          onClick={() => setTab("brands")}
          className={`rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
            tab === "brands"
              ? "text-foreground -mb-px border-b-2 border-emerald-500"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Marcas ({brands.length})
        </button>
        <button
          onClick={() => setTab("products")}
          className={`rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
            tab === "products"
              ? "text-foreground -mb-px border-b-2 border-emerald-500"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Productos ({products.length})
        </button>
      </div>

      {/* Table */}
      <div className="bg-card border-border overflow-hidden rounded-lg border">
        <div className="max-h-[400px] overflow-auto">
          {tab === "brands" ? (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="text-muted-foreground px-4 py-2 text-left font-medium">
                    Marca
                  </th>
                  <th className="text-muted-foreground px-4 py-2 text-center font-medium">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {brands.map((b, i) => (
                  <tr key={i} className="hover:bg-muted/30 transition-colors">
                    <td className="text-foreground px-4 py-2 font-medium">
                      {b.name}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <StatusBadge isNew={b.isNew} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="text-muted-foreground px-4 py-2 text-left font-medium">
                    SKU
                  </th>
                  <th className="text-muted-foreground px-4 py-2 text-left font-medium">
                    Producto
                  </th>
                  <th className="text-muted-foreground px-4 py-2 text-left font-medium">
                    Marca
                  </th>
                  <th className="text-muted-foreground px-4 py-2 text-center font-medium">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {products.map((p, i) => (
                  <tr key={i} className="hover:bg-muted/30 transition-colors">
                    <td className="text-muted-foreground px-4 py-2 font-mono text-xs">
                      {p.sku}
                    </td>
                    <td className="text-foreground px-4 py-2">{p.name}</td>
                    <td className="text-muted-foreground px-4 py-2">
                      {p.brand}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <StatusBadge isNew={p.isNew} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          Volver al inicio
        </button>
        <button
          onClick={onProceed}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-emerald-700 hover:shadow-lg active:scale-95"
        >
          <span className="material-symbols-outlined text-lg">
            check_circle
          </span>
          Continuar al Resumen
        </button>
      </div>
    </div>
  );
}

// ── Sub Components ───────────────────────────────

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: string;
  color: "emerald" | "sky";
}) {
  const colorClasses =
    color === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400"
      : "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-900/20 dark:text-sky-400";

  return (
    <div className={`rounded-lg border p-3 ${colorClasses}`}>
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-xl">{icon}</span>
        <span className="text-2xl font-bold">{value}</span>
      </div>
      <p className="mt-1 text-xs font-medium opacity-80">{label}</p>
    </div>
  );
}

function StatusBadge({ isNew }: { isNew: boolean }) {
  if (isNew) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
        <span className="material-symbols-outlined text-sm">add_circle</span>
        Nueva
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
      <span className="material-symbols-outlined text-sm">check_circle</span>
      Existente
    </span>
  );
}
