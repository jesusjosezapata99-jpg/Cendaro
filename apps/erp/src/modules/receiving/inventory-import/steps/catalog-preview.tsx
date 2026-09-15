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

import type { IconName } from "@cendaro/ui/icons";
import { Icon, Icons } from "@cendaro/ui/icons";
import { StatusPill } from "@cendaro/ui/status-pill";

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
  "all" | "newBrands" | "existingBrands" | "newProducts" | "existingProducts";

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
        <h2 className="text-foreground text-xl font-medium">
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
          icon="AddCircle"
          color="emerald"
          isActive={catalogFilter === "newBrands"}
          onClick={() => handleFilterClick("newBrands")}
        />
        <StatCard
          label="Marcas existentes"
          value={existingBrands.length}
          icon="CheckCircle"
          color="sky"
          isActive={catalogFilter === "existingBrands"}
          onClick={() => handleFilterClick("existingBrands")}
        />
        <StatCard
          label="Productos nuevos"
          value={newProducts.length}
          icon="Inventory2"
          color="emerald"
          isActive={catalogFilter === "newProducts"}
          onClick={() => handleFilterClick("newProducts")}
        />
        <StatCard
          label="Productos existentes"
          value={existingProducts.length}
          icon="Inventory"
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
          className={`px-4 py-2 text-xs font-medium transition-colors ${
            tab === "brands"
              ? "text-foreground border-primary -mb-px border-b-2"
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
          className={`px-4 py-2 text-xs font-medium transition-colors ${
            tab === "products"
              ? "text-foreground border-primary -mb-px border-b-2"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Productos ({displayedProducts.length})
        </button>
      </div>

      {/* Table */}
      <div className="bg-card border-border overflow-hidden border">
        <div className="max-h-100 overflow-auto">
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
          <Icons.ArrowBack className="size-4.5" />
          Volver
        </button>
        <button
          onClick={onProceed}
          className="bg-primary hover:bg-primary/90 inline-flex h-9 items-center gap-2 px-4 text-xs font-medium text-white transition-colors"
        >
          <Icons.CheckCircle className="size-4.5" />
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
        className="bg-background border-border text-foreground focus:border-primary -mx-1.5 w-full border px-1.5 py-0.5 text-xs outline-none"
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
      <Icons.Edit className="text-muted-foreground size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
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
  icon: IconName;
  color: "emerald" | "sky";
  isActive?: boolean;
  onClick?: () => void;
}) {
  const colorClasses =
    color === "emerald"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
      : "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400";

  const activeClasses = isActive
    ? color === "emerald"
      ? "ring-1 ring-emerald-500"
      : "ring-1 ring-sky-500"
    : "";

  const hoverClasses = onClick
    ? "cursor-pointer hover:border-primary/40 transition-colors"
    : "";

  const Tag = onClick ? "button" : "div";

  return (
    <Tag
      onClick={onClick}
      className={`border p-3 text-left ${colorClasses} ${activeClasses} ${hoverClasses}`}
    >
      <div className="flex items-center gap-2">
        <Icon name={icon} className="size-5" />
        <span className="font-mono text-2xl font-medium tabular-nums">
          {value}
        </span>
      </div>
      <p className="mt-1 text-xs font-medium opacity-80">{label}</p>
    </Tag>
  );
}

function StatusBadge({ isNew }: { isNew: boolean }) {
  return (
    <StatusPill tone={isNew ? "success" : "neutral"}>
      {isNew ? "Nueva" : "Existente"}
    </StatusPill>
  );
}
