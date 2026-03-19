"use client";

/**
 * Cendaro — Catalog Import: Step 4 — Category Mapping
 *
 * Resolve unmatched category strings to existing database categories.
 * Shows fuzzy matches from pg_trgm as suggestions.
 *
 * PRD: FEATURE_PRD_CATALOG_IMPORT.md §11
 */
import type { CategoryMapping } from "../hooks/use-catalog-import";

// ── Component ────────────────────────────────────

interface CategoryMappingProps {
  unresolvedCategories: CategoryMapping[];
  existingCategories: { id: string; name: string }[];
  onUpdateMapping: (mapping: {
    rawCategory: string;
    resolvedCategoryId: string | null;
    resolvedCategoryName: string | null;
    matchType: "user_selected" | "skipped";
  }) => void;
  onComplete: () => void;
  onBack: () => void;
  isLoading: boolean;
}

export function CategoryMappingStep({
  unresolvedCategories,
  existingCategories,
  onUpdateMapping,
  onComplete,
  onBack,
  isLoading,
}: CategoryMappingProps) {
  const resolvedCount = unresolvedCategories.filter(
    (c) => c.resolvedCategoryId ?? c.matchType === "skipped",
  ).length;
  const totalCount = unresolvedCategories.length;
  const allResolved = resolvedCount === totalCount;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-muted/30 rounded-xl px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-foreground text-sm font-semibold">
              Resolver categorías no reconocidas
            </h3>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Asigna cada categoría del archivo a una categoría existente o
              sáltala
            </p>
          </div>
          <div className="text-right">
            <span className="text-foreground text-lg font-black">
              {resolvedCount}/{totalCount}
            </span>
            <p className="text-muted-foreground text-xs">resueltas</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="bg-border mt-3 h-1.5 w-full overflow-hidden rounded-full">
          <div
            className="bg-primary h-full rounded-full transition-all duration-300"
            style={{
              width: `${totalCount > 0 ? (resolvedCount / totalCount) * 100 : 0}%`,
            }}
          />
        </div>
      </div>

      {/* Category list */}
      <div className="divide-border divide-y rounded-xl border">
        {unresolvedCategories.map((cat) => {
          const isResolved =
            cat.resolvedCategoryId !== null || cat.matchType === "skipped";

          return (
            <div
              key={cat.rawCategory}
              className={`space-y-3 px-4 py-4 transition-colors ${
                isResolved ? "bg-emerald-50/30 dark:bg-emerald-900/5" : ""
              }`}
            >
              {/* Raw category label */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`material-symbols-outlined text-base ${
                      isResolved ? "text-emerald-500" : "text-amber-500"
                    }`}
                  >
                    {isResolved ? "check_circle" : "help"}
                  </span>
                  <span className="text-foreground text-sm font-semibold">
                    &quot;{cat.rawCategory}&quot;
                  </span>
                </div>
                <button
                  onClick={() =>
                    onUpdateMapping({
                      rawCategory: cat.rawCategory,
                      resolvedCategoryId: null,
                      resolvedCategoryName: null,
                      matchType: "skipped",
                    })
                  }
                  className="text-muted-foreground hover:text-foreground text-xs transition-colors"
                >
                  Saltar
                </button>
              </div>

              {/* Fuzzy suggestions */}
              {cat.suggestions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {cat.suggestions.map((sug) => (
                    <button
                      key={sug.id}
                      onClick={() =>
                        onUpdateMapping({
                          rawCategory: cat.rawCategory,
                          resolvedCategoryId: sug.id,
                          resolvedCategoryName: sug.name,
                          matchType: "user_selected",
                        })
                      }
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                        cat.resolvedCategoryId === sug.id
                          ? "border-primary bg-primary/10 text-primary ring-primary ring-1"
                          : "border-border hover:border-primary/50 hover:bg-muted/50"
                      }`}
                    >
                      {sug.name}
                      <span className="text-muted-foreground text-[10px]">
                        ({Math.round(sug.score * 100)}%)
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Manual select */}
              <select
                value={cat.resolvedCategoryId ?? ""}
                onChange={(e) => {
                  const selected = existingCategories.find(
                    (c) => c.id === e.target.value,
                  );
                  onUpdateMapping({
                    rawCategory: cat.rawCategory,
                    resolvedCategoryId: selected?.id ?? null,
                    resolvedCategoryName: selected?.name ?? null,
                    matchType: "user_selected",
                  });
                }}
                className="border-border bg-background text-foreground focus:ring-primary/30 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
              >
                <option value="">— Seleccionar categoría —</option>
                {existingCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
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
          onClick={onComplete}
          disabled={!allResolved || isLoading}
          className="bg-primary hover:bg-primary/90 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white transition-all hover:shadow-lg active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Guardando aliases...
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-lg">
                arrow_forward
              </span>
              Continuar al resumen
            </>
          )}
        </button>
      </div>
    </div>
  );
}
