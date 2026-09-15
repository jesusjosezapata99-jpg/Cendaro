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

import { Icons } from "@cendaro/ui/icons";
import { StatusPill } from "@cendaro/ui/status-pill";

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
      <div className="border-border bg-card border p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-foreground text-sm font-medium">
              Resolver categorías no reconocidas
            </h3>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Asigna cada categoría a una existente o crea una nueva
            </p>
          </div>
          <div className="text-right">
            <span className="text-foreground font-mono text-base font-medium">
              {resolvedCount}/{totalCount}
            </span>
            <p className="text-muted-foreground text-xs">resueltas</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="bg-muted border-border mt-3 h-1.5 w-full overflow-hidden border">
          <div
            className="bg-primary h-full transition-all duration-300"
            style={{
              width: `${totalCount > 0 ? (resolvedCount / totalCount) * 100 : 0}%`,
            }}
          />
        </div>
      </div>

      {/* Category list */}
      <div className="divide-border border-border bg-card divide-y border">
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
                  {isResolved ? (
                    <Icons.CheckCircle className="size-4 text-emerald-500" />
                  ) : (
                    <Icons.Help className="size-4 text-amber-500" />
                  )}
                  <span className="text-foreground text-sm font-medium">
                    &quot;{rawCategory}&quot;
                  </span>
                  {cat.newCategoryName && (
                    <StatusPill tone="info">NUEVA</StatusPill>
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
                          className={`inline-flex flex-col items-start gap-0.5 border p-2.5 text-left text-xs transition-colors ${
                            cat.resolvedCategoryId === sug.id
                              ? "border-primary bg-primary/10 text-primary"
                              : isRecommended
                                ? "text-foreground border-emerald-500/40 bg-emerald-500/10"
                                : "border-border hover:border-foreground/30 hover:bg-muted/40"
                          }`}
                        >
                          <span className="flex items-center gap-1.5 font-medium">
                            {sug.name}
                            <span className="text-muted-foreground text-[10px]">
                              ({Math.round(sug.score * 100)}%)
                            </span>
                            {isRecommended && (
                              <StatusPill tone="success">
                                RECOMENDADO
                              </StatusPill>
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
                      id={`new-category-input-${encodeURIComponent(rawCategory)}`}
                      name={`new-category-${encodeURIComponent(rawCategory)}`}
                      type="text"
                      value={creatingMap[rawCategory]}
                      aria-label="Nombre de la nueva categoría"
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
                      className="border-primary bg-background text-foreground w-full border px-3 py-1.5 text-xs focus:outline-none"
                      autoFocus
                    />
                  </div>
                  <button
                    onClick={() => confirmCreating(rawCategory)}
                    disabled={!creatingMap[rawCategory].trim()}
                    className="inline-flex items-center gap-1 bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <Icons.Check className="size-3.5" />
                    Crear
                  </button>
                  <button
                    onClick={() => cancelCreating(rawCategory)}
                    className="text-muted-foreground hover:text-foreground border-border border px-3 py-1.5 text-xs transition-colors"
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
                    className="border-border bg-background text-foreground flex-1 border px-3 py-1.5 text-xs focus:outline-none"
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
                    className="border-border bg-muted/40 text-foreground hover:bg-muted/70 inline-flex items-center gap-1.5 border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors"
                  >
                    <Icons.Add className="size-3.5" />
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
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs transition-colors"
        >
          <Icons.ArrowBack className="size-3.5" />
          Volver
        </button>

        <button
          onClick={onComplete}
          disabled={!allResolved || isLoading}
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center gap-2 px-4 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <div className="size-3.5 animate-spin border-2 border-white border-t-transparent" />
              Guardando aliases...
            </>
          ) : (
            <>
              <Icons.ArrowForward className="size-3.5" />
              Continuar al resumen
            </>
          )}
        </button>
      </div>
    </div>
  );
}
