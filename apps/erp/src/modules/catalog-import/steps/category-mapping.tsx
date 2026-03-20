"use client";

/**
 * Cendaro — Catalog Import: Step 4 — Category Mapping
 *
 * Resolve unmatched category strings to existing database categories
 * OR create new categories inline.
 * Shows fuzzy matches from pg_trgm as suggestions.
 *
 * PRD: FEATURE_PRD_CATALOG_IMPORT.md §11
 */
import { useState } from "react";

import type { CategoryMapping } from "../hooks/use-catalog-import";

// ── Component ────────────────────────────────────

interface CategoryMappingProps {
  unresolvedCategories: CategoryMapping[];
  existingCategories: { id: string; name: string }[];
  onUpdateMapping: (mapping: {
    rawCategory: string;
    resolvedCategoryId: string | null;
    resolvedCategoryName: string | null;
    newCategoryName?: string;
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
    (c) =>
      c.resolvedCategoryId ?? c.newCategoryName ?? c.matchType === "skipped",
  ).length;
  const totalCount = unresolvedCategories.length;
  const allResolved = resolvedCount === totalCount;

  // Track which categories are in "create" mode
  const [creatingMap, setCreatingMap] = useState<Record<string, string>>({});

  const startCreating = (rawCategory: string, suggestedName: string) => {
    setCreatingMap((prev) => ({ ...prev, [rawCategory]: suggestedName }));
  };

  const cancelCreating = (rawCategory: string) => {
    setCreatingMap((prev) => {
      const next = { ...prev };
      delete next[rawCategory];
      return next;
    });
  };

  const confirmCreating = (rawCategory: string) => {
    const name = creatingMap[rawCategory]?.trim();
    if (!name) return;

    onUpdateMapping({
      rawCategory,
      resolvedCategoryId: null,
      resolvedCategoryName: name,
      newCategoryName: name,
      matchType: "user_selected",
    });

    cancelCreating(rawCategory);
  };

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
              Asigna cada categoría a una existente o crea una nueva
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
            cat.resolvedCategoryId !== null ||
            cat.newCategoryName !== undefined ||
            cat.matchType === "skipped";

          const rawCategory = cat.rawCategory;

          return (
            <div
              key={rawCategory}
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
                    &quot;{rawCategory}&quot;
                  </span>
                  {cat.newCategoryName && (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                      NUEVA
                    </span>
                  )}
                </div>
                <button
                  onClick={() =>
                    onUpdateMapping({
                      rawCategory,
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

              {/* Smart suggestions with reasons */}
              {cat.suggestions.length > 0 && (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {cat.suggestions.map((sug, idx) => {
                      const isRecommended = idx === 0 && sug.score >= 0.7;
                      return (
                        <button
                          key={sug.id}
                          onClick={() =>
                            onUpdateMapping({
                              rawCategory,
                              resolvedCategoryId: sug.id,
                              resolvedCategoryName: sug.name,
                              matchType: "user_selected",
                            })
                          }
                          className={`inline-flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left text-xs transition-all ${
                            cat.resolvedCategoryId === sug.id
                              ? "border-primary bg-primary/10 text-primary ring-primary ring-1"
                              : isRecommended
                                ? "border-emerald-400 bg-emerald-50 hover:bg-emerald-100 dark:border-emerald-600 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/30"
                                : "border-border hover:border-primary/50 hover:bg-muted/50"
                          }`}
                        >
                          <span className="flex items-center gap-1.5 font-medium">
                            {sug.name}
                            <span className="text-muted-foreground text-[10px]">
                              ({Math.round(sug.score * 100)}%)
                            </span>
                            {isRecommended && (
                              <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 dark:bg-emerald-800/40 dark:text-emerald-300">
                                RECOMENDADO
                              </span>
                            )}
                          </span>
                          {sug.reason && (
                            <span className="text-muted-foreground text-[10px] leading-tight">
                              {sug.reason}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Create new category inline */}
              {creatingMap[rawCategory] !== undefined ? (
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={creatingMap[rawCategory]}
                      onChange={(e) =>
                        setCreatingMap((prev) => ({
                          ...prev,
                          [rawCategory]: e.target.value,
                        }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") confirmCreating(rawCategory);
                        if (e.key === "Escape") cancelCreating(rawCategory);
                      }}
                      placeholder="Nombre de la nueva categoría"
                      className="border-primary bg-background text-foreground ring-primary/30 w-full rounded-lg border px-3 py-2 text-sm ring-2 focus:outline-none"
                      autoFocus
                    />
                  </div>
                  <button
                    onClick={() => confirmCreating(rawCategory)}
                    disabled={!creatingMap[rawCategory].trim()}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition-all hover:bg-emerald-700 active:scale-95 disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-sm">
                      check
                    </span>
                    Crear
                  </button>
                  <button
                    onClick={() => cancelCreating(rawCategory)}
                    className="text-muted-foreground hover:text-foreground rounded-lg border px-3 py-2 text-xs transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  {/* Manual select dropdown */}
                  <select
                    value={cat.resolvedCategoryId ?? ""}
                    onChange={(e) => {
                      const selected = existingCategories.find(
                        (c) => c.id === e.target.value,
                      );
                      onUpdateMapping({
                        rawCategory,
                        resolvedCategoryId: selected?.id ?? null,
                        resolvedCategoryName: selected?.name ?? null,
                        matchType: "user_selected",
                      });
                    }}
                    className="border-border bg-background text-foreground focus:ring-primary/30 flex-1 rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
                  >
                    <option value="">— Seleccionar categoría —</option>
                    {existingCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>

                  {/* Create new category button */}
                  <button
                    onClick={() =>
                      startCreating(
                        rawCategory,
                        cat.suggestedNewName ?? rawCategory,
                      )
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg border border-blue-400 bg-blue-50 px-3 py-2 text-xs font-semibold whitespace-nowrap text-blue-700 transition-all hover:bg-blue-100 active:scale-95 dark:border-blue-600 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/30"
                  >
                    <span className="material-symbols-outlined text-sm">
                      add
                    </span>
                    Crear categoría
                  </button>
                </div>
              )}
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
