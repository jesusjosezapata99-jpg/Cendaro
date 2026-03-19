"use client";

/**
 * Cendaro — Catalog Import: Step 3 — Validation Preview
 *
 * Shows validated rows with status filtering and error details.
 *
 * PRD: FEATURE_PRD_CATALOG_IMPORT.md §11
 */
import { useMemo, useState } from "react";

import type { ValidatedCatalogRow } from "../lib/catalog-validators";

// ── Types ────────────────────────────────────────

type StatusFilter = "all" | "valid" | "warning" | "error";

interface ValidationPreviewProps {
  validatedRows: ValidatedCatalogRow[];
  validCount: number;
  warningCount: number;
  errorCount: number;
  onProceed: () => void;
  onBack: () => void;
}

// ── Component ────────────────────────────────────

export function ValidationPreview({
  validatedRows,
  validCount,
  warningCount,
  errorCount,
  onProceed,
  onBack,
}: ValidationPreviewProps) {
  const [filter, setFilter] = useState<StatusFilter>("all");

  const filteredRows = useMemo(() => {
    if (filter === "all") return validatedRows;
    return validatedRows.filter((r) => r.status === filter);
  }, [validatedRows, filter]);

  const statCards: {
    key: StatusFilter;
    label: string;
    count: number;
    color: string;
    icon: string;
  }[] = [
    {
      key: "all",
      label: "Total",
      count: validatedRows.length,
      color: "text-foreground bg-muted/50",
      icon: "list",
    },
    {
      key: "valid",
      label: "Válidas",
      count: validCount,
      color:
        "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20",
      icon: "check_circle",
    },
    {
      key: "warning",
      label: "Advertencias",
      count: warningCount,
      color:
        "text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20",
      icon: "warning",
    },
    {
      key: "error",
      label: "Errores",
      count: errorCount,
      color: "text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-900/20",
      icon: "error",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-3">
        {statCards.map((card) => (
          <button
            key={card.key}
            onClick={() => setFilter(card.key)}
            className={`rounded-xl px-4 py-3 text-left transition-all ${card.color} ${
              filter === card.key
                ? "ring-primary scale-[1.02] shadow-sm ring-2"
                : "hover:scale-[1.01]"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">
                {card.icon}
              </span>
              <span className="text-2xl font-black">{card.count}</span>
            </div>
            <p className="mt-1 text-xs font-medium opacity-70">{card.label}</p>
          </button>
        ))}
      </div>

      {/* Data table */}
      <div className="overflow-hidden rounded-xl border">
        <div className="max-h-[400px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">#</th>
                <th className="px-3 py-2 text-left font-semibold">Estado</th>
                <th className="px-3 py-2 text-left font-semibold">SKU</th>
                <th className="px-3 py-2 text-left font-semibold">Nombre</th>
                <th className="px-3 py-2 text-left font-semibold">Categoría</th>
                <th className="px-3 py-2 text-left font-semibold">Marca</th>
                <th className="px-3 py-2 text-left font-semibold">Costo</th>
                <th className="px-3 py-2 text-left font-semibold">Mensajes</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {filteredRows.map((row, idx) => (
                <tr
                  key={idx}
                  className={`hover:bg-muted/20 transition-colors ${
                    row.status === "error"
                      ? "bg-red-50/50 dark:bg-red-900/5"
                      : row.status === "warning"
                        ? "bg-amber-50/50 dark:bg-amber-900/5"
                        : ""
                  }`}
                >
                  <td className="text-muted-foreground px-3 py-2 text-xs">
                    {row.rowNumber}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`material-symbols-outlined text-base ${
                        row.status === "valid"
                          ? "text-emerald-500"
                          : row.status === "warning"
                            ? "text-amber-500"
                            : "text-red-500"
                      }`}
                    >
                      {row.status === "valid"
                        ? "check_circle"
                        : row.status === "warning"
                          ? "warning"
                          : "error"}
                    </span>
                  </td>
                  <td className="text-foreground px-3 py-2 font-mono text-xs">
                    {row.sku || "—"}
                  </td>
                  <td className="text-foreground max-w-[200px] truncate px-3 py-2">
                    {row.name || "—"}
                  </td>
                  <td className="text-muted-foreground px-3 py-2 text-xs">
                    {row.categoryRaw ?? "—"}
                  </td>
                  <td className="text-muted-foreground px-3 py-2 text-xs">
                    {row.brandRaw ?? "—"}
                  </td>
                  <td className="text-muted-foreground px-3 py-2 text-xs">
                    {row.cost !== undefined ? `$${row.cost.toFixed(2)}` : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {row.errors.length > 0 && (
                      <div className="space-y-0.5">
                        {row.errors.map((err, eIdx) => (
                          <p
                            key={eIdx}
                            className={`text-xs ${
                              err.severity === "error"
                                ? "text-red-600 dark:text-red-400"
                                : err.severity === "warning"
                                  ? "text-amber-600 dark:text-amber-400"
                                  : "text-blue-600 dark:text-blue-400"
                            }`}
                          >
                            {err.message}
                          </p>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
          disabled={validCount === 0}
          className="bg-primary hover:bg-primary/90 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white transition-all hover:shadow-lg active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-lg">
            arrow_forward
          </span>
          Continuar con {validCount + warningCount} filas
        </button>
      </div>
    </div>
  );
}
