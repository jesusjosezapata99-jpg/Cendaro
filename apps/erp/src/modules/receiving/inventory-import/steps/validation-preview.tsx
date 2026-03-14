"use client";

/**
 * Step 4 — Validation Preview
 *
 * Table with status color-coding, counters, and filter tabs.
 * PRD: FEATURE_PRD_INVENTORY_IMPORT.md §15, §20 (ValidationReady)
 */
import { useMemo, useState } from "react";

import type { ImportMode, ValidatedRow } from "@cendaro/api";

import type { ValidationStats } from "../lib/inventory-validators";

interface ValidationPreviewProps {
  validatedRows: ValidatedRow[];
  stats: ValidationStats;
  mode: ImportMode;
  onProceed: () => void;
  onBack: () => void;
}

type FilterTab = "all" | "valid" | "warning" | "error";

const STATUS_COLORS = {
  valid:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  warning:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  error: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
} as const;

const STATUS_ROW_COLORS = {
  valid: "",
  warning: "bg-amber-50/50 dark:bg-amber-900/10",
  error: "bg-red-50/50 dark:bg-red-900/10",
} as const;

export function ValidationPreview({
  validatedRows,
  stats,
  mode,
  onProceed,
  onBack,
}: ValidationPreviewProps) {
  const [filter, setFilter] = useState<FilterTab>("all");

  const filteredRows = useMemo(() => {
    if (filter === "all") return validatedRows;
    return validatedRows.filter((r) => r.status === filter);
  }, [validatedRows, filter]);

  const hasValidRows = stats.valid > 0 || stats.warnings > 0;
  const allErrors = stats.valid === 0 && stats.warnings === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-foreground text-xl font-bold">
            Vista Previa de Validación
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {mode === "replace" ? "Modo Reemplazar" : "Modo Ajustar"} — Revise
            los resultados antes de importar
          </p>
        </div>
      </div>

      {/* Stats counters */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: "Válidos",
            count: stats.valid,
            icon: "check_circle",
            color: "text-emerald-600 dark:text-emerald-400",
          },
          {
            label: "Advertencias",
            count: stats.warnings,
            icon: "warning",
            color: "text-amber-600 dark:text-amber-400",
          },
          {
            label: "Errores",
            count: stats.errors,
            icon: "error",
            color: "text-red-600 dark:text-red-400",
          },
          {
            label: "Total",
            count: stats.total,
            icon: "inventory_2",
            color: "text-blue-600 dark:text-blue-400",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="border-border bg-card rounded-xl border p-3"
          >
            <div className="flex items-center gap-1.5">
              <span className={`material-symbols-outlined text-lg ${s.color}`}>
                {s.icon}
              </span>
              <span className="text-muted-foreground text-xs font-medium">
                {s.label}
              </span>
            </div>
            <p className="text-foreground mt-1 text-xl font-black">{s.count}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="border-border bg-muted/50 flex gap-1 rounded-lg border p-1">
        {(["all", "valid", "warning", "error"] as const).map((tab) => {
          const labels = {
            all: "Todos",
            valid: "Válidos",
            warning: "Advertencias",
            error: "Errores",
          };
          const isActive = filter === tab;
          return (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                isActive
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {labels[tab]}
            </button>
          );
        })}
      </div>

      {/* All errors warning */}
      {allErrors && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400">
          <span className="material-symbols-outlined text-lg">error</span>
          Todas las filas tienen errores. Corrija los datos y vuelva a intentar.
        </div>
      )}

      {/* Table */}
      <div className="border-border bg-card overflow-hidden rounded-xl border">
        <div className="max-h-[400px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 sticky top-0">
              <tr className="border-border border-b text-left">
                <th className="text-muted-foreground px-3 py-2.5 font-semibold">
                  Fila
                </th>
                <th className="text-muted-foreground px-3 py-2.5 font-semibold">
                  SKU
                </th>
                <th className="text-muted-foreground px-3 py-2.5 font-semibold">
                  Producto
                </th>
                <th className="text-muted-foreground px-3 py-2.5 text-right font-semibold">
                  Actual
                </th>
                {mode === "replace" ? (
                  <th className="text-muted-foreground px-3 py-2.5 text-right font-semibold">
                    Nuevo
                  </th>
                ) : (
                  <>
                    <th className="text-muted-foreground px-3 py-2.5 text-right font-semibold">
                      Delta
                    </th>
                    <th className="text-muted-foreground px-3 py-2.5 text-right font-semibold">
                      Nuevo
                    </th>
                  </>
                )}
                <th className="text-muted-foreground px-3 py-2.5 text-center font-semibold">
                  Estado
                </th>
                <th className="text-muted-foreground max-w-[200px] px-3 py-2.5 font-semibold">
                  Mensaje
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, i) => (
                <tr
                  key={i}
                  className={`border-border border-b ${STATUS_ROW_COLORS[row.status]}`}
                >
                  <td className="text-muted-foreground px-3 py-2 font-mono text-xs">
                    {row.rowNumber}
                  </td>
                  <td className="text-foreground px-3 py-2 font-mono text-xs font-medium">
                    {row.sku}
                  </td>
                  <td className="px-3 py-2">{row.productName ?? "—"}</td>
                  <td className="px-3 py-2 text-right font-mono">
                    {row.productId ? row.currentQuantity : "—"}
                  </td>
                  {mode === "replace" ? (
                    <td className="text-foreground px-3 py-2 text-right font-mono font-bold">
                      {row.status !== "error" ? row.quantity : "—"}
                    </td>
                  ) : (
                    <>
                      <td
                        className={`px-3 py-2 text-right font-mono font-bold ${
                          row.quantity > 0
                            ? "text-emerald-600"
                            : row.quantity < 0
                              ? "text-red-600"
                              : ""
                        }`}
                      >
                        {row.status !== "error"
                          ? `${row.quantity > 0 ? "+" : ""}${row.quantity}`
                          : "—"}
                      </td>
                      <td className="text-foreground px-3 py-2 text-right font-mono font-bold">
                        {row.status !== "error"
                          ? row.currentQuantity + row.quantity
                          : "—"}
                      </td>
                    </>
                  )}
                  <td className="px-3 py-2 text-center">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[row.status]}`}
                    >
                      {row.status === "valid"
                        ? "✅"
                        : row.status === "warning"
                          ? "⚠️"
                          : "❌"}
                    </span>
                  </td>
                  <td className="text-muted-foreground max-w-[200px] truncate px-3 py-2 text-xs">
                    {row.message ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          Volver
        </button>
        <button
          onClick={onProceed}
          disabled={!hasValidRows}
          className="bg-primary hover:bg-primary/90 inline-flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-lg">
            arrow_forward
          </span>
          Continuar al Resumen
        </button>
      </div>
    </div>
  );
}
