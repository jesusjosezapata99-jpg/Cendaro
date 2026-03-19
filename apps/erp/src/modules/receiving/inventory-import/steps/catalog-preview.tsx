"use client";

/**
 * Cendaro — Catalog Preview Step
 *
 * Step 5 (Initialize mode only): shows brands and products
 * that will be created. Allows inline editing of brand/product
 * names before proceeding to the dry-run summary.
 *
 * PRD: FEATURE_PRD_INVENTORY_IMPORT.md §23
 */
import { useCallback, useMemo, useState } from "react";

import type { ImportState } from "../hooks/use-inventory-import";
import type { InitializeValidatedRow } from "../lib/inventory-validators";

// ── Props ────────────────────────────────────────

interface CatalogPreviewProps {
  initializeRows: InitializeValidatedRow[];
  catalogPreview: NonNullable<ImportState["catalogPreview"]>;
  /** Callback to propagate edited rows + catalog back to state machine */
  onUpdateRows: (
    rows: InitializeValidatedRow[],
    catalog: NonNullable<ImportState["catalogPreview"]>,
  ) => void;
  onProceed: () => void;
  onBack: () => void;
}

// ── Component ────────────────────────────────────

type CatalogFilter =
  | "all"
  | "newBrands"
  | "existingBrands"
  | "newProducts"
  | "existingProducts";

export function CatalogPreview({
  initializeRows,
  catalogPreview,
  onUpdateRows,
  onProceed,
  onBack,
}: CatalogPreviewProps) {
  const [tab, setTab] = useState<"brands" | "products">("brands");
  const [catalogFilter, setCatalogFilter] = useState<CatalogFilter>("all");

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

  // Filtered data based on active stat card
  const displayedBrands = useMemo(() => {
    if (catalogFilter === "newBrands") return newBrands;
    if (catalogFilter === "existingBrands") return existingBrands;
    return brands;
  }, [catalogFilter, brands, newBrands, existingBrands]);

  const displayedProducts = useMemo(() => {
    if (catalogFilter === "newProducts") return newProducts;
    if (catalogFilter === "existingProducts") return existingProducts;
    return products;
  }, [catalogFilter, products, newProducts, existingProducts]);

  // Handle stat card click — toggle + auto-switch tab
  const handleFilterClick = useCallback(
    (filter: CatalogFilter) => {
      const newFilter = catalogFilter === filter ? "all" : filter;
      setCatalogFilter(newFilter);

      // Auto-switch tab based on filter type
      if (newFilter.includes("Brand")) setTab("brands");
      else if (newFilter.includes("Product")) setTab("products");
    },
    [catalogFilter],
  );

  // ── Inline editing helpers ──────────────────

  const handleBrandRename = useCallback(
    (oldName: string, newName: string) => {
      if (!newName.trim() || oldName === newName) return;

      // Update all initializeRows with this brand
      const updatedRows = initializeRows.map((r) =>
        r.brand === oldName ? { ...r, brand: newName } : r,
      );

      // Rebuild catalog preview
      const updatedBrands = brands.map((b) =>
        b.name === oldName ? { ...b, name: newName } : b,
      );
      const updatedProducts = products.map((p) =>
        p.brand === oldName ? { ...p, brand: newName } : p,
      );

      onUpdateRows(updatedRows, {
        brands: updatedBrands,
        products: updatedProducts,
      });
    },
    [initializeRows, brands, products, onUpdateRows],
  );

  const handleProductRename = useCallback(
    (sku: string, field: "name" | "brand", newValue: string) => {
      if (!newValue.trim()) return;

      const updatedRows = initializeRows.map((r) => {
        if (r.sku !== sku) return r;
        return field === "name"
          ? { ...r, productName: newValue }
          : { ...r, brand: newValue };
      });

      const updatedProducts = products.map((p) => {
        if (p.sku !== sku) return p;
        return field === "name"
          ? { ...p, name: newValue }
          : { ...p, brand: newValue };
      });

      // Rebuild brand list from updated products
      const brandSet = new Map<string, boolean>();
      for (const p of updatedProducts) {
        if (!brandSet.has(p.brand)) {
          brandSet.set(p.brand, p.isNew);
        }
      }
      const updatedBrands = Array.from(brandSet.entries()).map(
        ([name, isNew]) => ({
          name,
          isNew,
        }),
      );

      onUpdateRows(updatedRows, {
        brands: updatedBrands,
        products: updatedProducts,
      });
    },
    [initializeRows, products, onUpdateRows],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-foreground text-xl font-bold">
          Vista Previa del Catálogo
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Revise y edite las marcas y productos antes de importar. Haga clic en
          las tarjetas para filtrar. Doble clic en un nombre para editarlo.
        </p>
      </div>

      {/* Interactive Summary Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Marcas nuevas"
          value={newBrands.length}
          icon="add_circle"
          color="emerald"
          isActive={catalogFilter === "newBrands"}
          onClick={() => handleFilterClick("newBrands")}
        />
        <StatCard
          label="Marcas existentes"
          value={existingBrands.length}
          icon="check_circle"
          color="sky"
          isActive={catalogFilter === "existingBrands"}
          onClick={() => handleFilterClick("existingBrands")}
        />
        <StatCard
          label="Productos nuevos"
          value={newProducts.length}
          icon="inventory_2"
          color="emerald"
          isActive={catalogFilter === "newProducts"}
          onClick={() => handleFilterClick("newProducts")}
        />
        <StatCard
          label="Productos existentes"
          value={existingProducts.length}
          icon="inventory"
          color="sky"
          isActive={catalogFilter === "existingProducts"}
          onClick={() => handleFilterClick("existingProducts")}
        />
      </div>

      {/* Tabs */}
      <div className="border-border flex items-center gap-1 border-b">
        <button
          onClick={() => {
            setTab("brands");
            if (catalogFilter.includes("Product")) setCatalogFilter("all");
          }}
          className={`rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
            tab === "brands"
              ? "text-foreground -mb-px border-b-2 border-emerald-500"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Marcas ({displayedBrands.length})
        </button>
        <button
          onClick={() => {
            setTab("products");
            if (catalogFilter.includes("Brand")) setCatalogFilter("all");
          }}
          className={`rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
            tab === "products"
              ? "text-foreground -mb-px border-b-2 border-emerald-500"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Productos ({displayedProducts.length})
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
                {displayedBrands.length === 0 ? (
                  <tr>
                    <td
                      colSpan={2}
                      className="text-muted-foreground px-4 py-8 text-center text-sm"
                    >
                      No hay marcas en esta categoría
                    </td>
                  </tr>
                ) : (
                  displayedBrands.map((b, i) => (
                    <tr key={i} className="hover:bg-muted/30 transition-colors">
                      <td className="text-foreground px-4 py-2">
                        <EditableCell
                          value={b.name}
                          onSave={(v) => handleBrandRename(b.name, v)}
                        />
                      </td>
                      <td className="px-4 py-2 text-center">
                        <StatusBadge isNew={b.isNew} />
                      </td>
                    </tr>
                  ))
                )}
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
                {displayedProducts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="text-muted-foreground px-4 py-8 text-center text-sm"
                    >
                      No hay productos en esta categoría
                    </td>
                  </tr>
                ) : (
                  displayedProducts.map((p, i) => (
                    <tr key={i} className="hover:bg-muted/30 transition-colors">
                      <td className="text-muted-foreground px-4 py-2 font-mono text-xs">
                        {p.sku}
                      </td>
                      <td className="px-4 py-2">
                        <EditableCell
                          value={p.name}
                          onSave={(v) => handleProductRename(p.sku, "name", v)}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <EditableCell
                          value={p.brand}
                          onSave={(v) => handleProductRename(p.sku, "brand", v)}
                        />
                      </td>
                      <td className="px-4 py-2 text-center">
                        <StatusBadge isNew={p.isNew} />
                      </td>
                    </tr>
                  ))
                )}
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
          Volver
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

/**
 * Inline editable cell — click to edit, blur/enter to save.
 */
function EditableCell({
  value,
  onSave,
}: {
  value: string;
  onSave: (newValue: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const commit = () => {
    setEditing(false);
    if (draft.trim() && draft !== value) {
      onSave(draft.trim());
    } else {
      setDraft(value);
    }
  };

  if (editing) {
    return (
      <input
        autoFocus
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        className="bg-background border-border text-foreground -mx-1.5 w-full rounded-md border px-1.5 py-0.5 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
      />
    );
  }

  return (
    <button
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      className="text-foreground group inline-flex w-full items-center gap-1.5 text-left font-medium"
      title="Haz clic para editar"
    >
      <span className="min-w-0 truncate">{value}</span>
      <span className="material-symbols-outlined text-muted-foreground shrink-0 text-xs opacity-0 transition-opacity group-hover:opacity-100">
        edit
      </span>
    </button>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
  isActive,
  onClick,
}: {
  label: string;
  value: number;
  icon: string;
  color: "emerald" | "sky";
  isActive?: boolean;
  onClick?: () => void;
}) {
  const colorClasses =
    color === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400"
      : "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-900/20 dark:text-sky-400";

  const activeClasses = isActive
    ? color === "emerald"
      ? "ring-2 ring-emerald-500/60 scale-[1.02] shadow-sm"
      : "ring-2 ring-sky-500/60 scale-[1.02] shadow-sm"
    : "";

  const hoverClasses = onClick
    ? "cursor-pointer hover:shadow-sm hover:scale-[1.01] active:scale-[0.98] transition-all"
    : "";

  const Tag = onClick ? "button" : "div";

  return (
    <Tag
      onClick={onClick}
      className={`rounded-lg border p-3 text-left ${colorClasses} ${activeClasses} ${hoverClasses}`}
    >
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-xl">{icon}</span>
        <span className="text-2xl font-bold">{value}</span>
      </div>
      <p className="mt-1 text-xs font-medium opacity-80">{label}</p>
    </Tag>
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
