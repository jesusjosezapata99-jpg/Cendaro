"use client";

/**
 * Step 4 — Validation Preview
 *
 * Table with status color-coding, clickable stat counters, and filter tabs.
 * Supports Replace/Adjust mode (validatedRows) and Initialize mode (initializeRows).
 * PRD: FEATURE_PRD_INVENTORY_IMPORT.md §15, §20 (ValidationReady)
 */
import { useMemo, useState } from "react";

import type { ImportMode, ValidatedRow } from "@cendaro/api";

import type {
  InitializeValidatedRow,
  ValidationStats,
} from "../lib/inventory-validators";

interface ValidationPreviewProps {
  validatedRows: ValidatedRow[];
  stats: ValidationStats;
  mode: ImportMode;
  /** Initialize mode rows (takes precedence over validatedRows when provided) */
  initializeRows?: InitializeValidatedRow[];
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

const MODE_LABELS: Record<ImportMode, string> = {
  replace: "Modo Reemplazar",
  adjust: "Modo Ajustar",
  initialize: "Modo Inicializar",
};

// ── Stat card styling per type ───────────────────

const STAT_CONFIGS = [
  {
    label: "Válidos",
    filterKey: "valid" as FilterTab,
    icon: "check_circle",
    iconColor: "text-emerald-500 dark:text-emerald-400",
    ringColor: "ring-emerald-500/50",
    borderColor: "border-emerald-500/30",
    bgActive: "bg-emerald-500/10 dark:bg-emerald-500/15",
  },
  {
    label: "Advertencias",
    filterKey: "warning" as FilterTab,
    icon: "warning",
    iconColor: "text-amber-500 dark:text-amber-400",
    ringColor: "ring-amber-500/50",
    borderColor: "border-amber-500/30",
    bgActive: "bg-amber-500/10 dark:bg-amber-500/15",
  },
  {
    label: "Errores",
    filterKey: "error" as FilterTab,
    icon: "error",
    iconColor: "text-red-500 dark:text-red-400",
    ringColor: "ring-red-500/50",
    borderColor: "border-red-500/30",
    bgActive: "bg-red-500/10 dark:bg-red-500/15",
  },
  {
    label: "Total",
    filterKey: "all" as FilterTab,
    icon: "inventory_2",
    iconColor: "text-blue-500 dark:text-blue-400",
    ringColor: "ring-blue-500/50",
    borderColor: "border-blue-500/30",
    bgActive: "bg-blue-500/10 dark:bg-blue-500/15",
  },
];

// ── Filter tab dot colors ────────────────────────

const TAB_DOT_COLORS: Record<FilterTab, string> = {
  all: "bg-blue-500",
  valid: "bg-emerald-500",
  warning: "bg-amber-500",
  error: "bg-red-500",
};

const TAB_LABELS: Record<FilterTab, string> = {
  all: "Todos",
  valid: "Válidos",
  warning: "Advertencias",
  error: "Errores",
};

// ── Message column styling per status ────────────

const MESSAGE_STYLES = {
  valid: {
    icon: "check_circle",
    textColor: "text-emerald-600 dark:text-emerald-400",
    bgColor: "",
  },
  warning: {
    icon: "warning",
    textColor: "text-amber-600 dark:text-amber-400",
    bgColor: "",
  },
  error: {
    icon: "error",
    textColor: "text-red-600 dark:text-red-400",
    bgColor: "",
  },
} as const;

export function ValidationPreview({
  validatedRows,
  stats,
  mode,
  initializeRows,
  onProceed,
  onBack,
}: ValidationPreviewProps) {
  const [filter, setFilter] = useState<FilterTab>("all");

  const isInitialize = mode === "initialize" && initializeRows;

  // Unified row list for filtering
  const allRows = useMemo(() => {
    if (isInitialize) return initializeRows;
    return validatedRows;
  }, [isInitialize, initializeRows, validatedRows]);

  const filteredRows = useMemo(() => {
    if (filter === "all") return allRows;
    return allRows.filter((r) => r.status === filter);
  }, [allRows, filter]);

  const hasValidRows = stats.valid > 0 || stats.warnings > 0;
  const allErrors = stats.valid === 0 && stats.warnings === 0;

  // Stat counts mapped to card order
  const statCounts = [stats.valid, stats.warnings, stats.errors, stats.total];

  // Tab counts for badges
  const tabCounts: Record<FilterTab, number> = {
    all: stats.total,
    valid: stats.valid,
    warning: stats.warnings,
    error: stats.errors,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-foreground text-xl font-bold">
            Vista Previa de Validación
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {MODE_LABELS[mode]} — Revise los resultados antes de importar
          </p>
        </div>
      </div>

      {/* ── Interactive stat cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STAT_CONFIGS.map((cfg, idx) => {
          const count = statCounts[idx] ?? 0;
          const isActive = filter === cfg.filterKey;

          return (
            <button
              key={cfg.label}
              onClick={() => setFilter(cfg.filterKey)}
              className={`border-border bg-card group rounded-xl border p-3 text-left transition-all duration-200 ${
                isActive
                  ? `ring-2 ${cfg.ringColor} ${cfg.borderColor} ${cfg.bgActive} scale-[1.02] shadow-sm`
                  : "hover:border-muted-foreground/30 hover:shadow-sm active:scale-[0.98]"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className={`material-symbols-outlined text-lg transition-transform duration-200 group-hover:scale-110 ${cfg.iconColor}`}
                >
                  {cfg.icon}
                </span>
                <span className="text-muted-foreground text-xs font-medium">
                  {cfg.label}
                </span>
              </div>
              <p className="text-foreground mt-1 text-xl font-black">{count}</p>
            </button>
          );
        })}
      </div>

      {/* ── Filter tabs with count + color dot ── */}
      <div className="border-border bg-muted/50 flex gap-1 rounded-lg border p-1">
        {(["all", "valid", "warning", "error"] as const).map((tab) => {
          const isActive = filter === tab;
          const count = tabCounts[tab];

          return (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition-all duration-150 ${
                isActive
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-card/50 hover:text-foreground"
              }`}
            >
              <span
                className={`inline-block size-2 rounded-full ${TAB_DOT_COLORS[tab]} ${
                  isActive ? "opacity-100" : "opacity-50"
                } transition-opacity`}
              />
              <span>{TAB_LABELS[tab]}</span>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] leading-none font-bold ${
                  isActive
                    ? "bg-muted text-foreground"
                    : "bg-muted/80 text-muted-foreground"
                }`}
              >
                {count}
              </span>
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

      {/* ── Table ── */}
      <div className="border-border bg-card overflow-hidden rounded-xl border">
        <div className="max-h-[400px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 sticky top-0 z-10">
              <tr className="border-border border-b text-left">
                <th className="text-muted-foreground px-3 py-2.5 font-semibold">
                  Fila
                </th>
                <th className="text-muted-foreground px-3 py-2.5 font-semibold">
                  SKU
                </th>
                {isInitialize ? (
                  <>
                    <th className="text-muted-foreground px-3 py-2.5 font-semibold">
                      Marca
                    </th>
                    <th className="text-muted-foreground px-3 py-2.5 font-semibold">
                      Producto
                    </th>
                    <th className="text-muted-foreground px-3 py-2.5 text-right font-semibold">
                      Bultos
                    </th>
                    <th className="text-muted-foreground px-3 py-2.5 font-semibold">
                      Presentación
                    </th>
                    <th className="text-muted-foreground px-3 py-2.5 text-right font-semibold">
                      Total Uds
                    </th>
                  </>
                ) : (
                  <>
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
                  </>
                )}
                <th className="text-muted-foreground px-3 py-2.5 text-center font-semibold">
                  Estado
                </th>
                <th className="text-muted-foreground min-w-[220px] px-3 py-2.5 font-semibold">
                  Mensaje
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, i) => (
                <tr
                  key={i}
                  className={`border-border hover:bg-muted/30 border-b transition-colors ${STATUS_ROW_COLORS[row.status]}`}
                >
                  <td className="text-muted-foreground px-3 py-2.5 font-mono text-xs">
                    {row.rowNumber}
                  </td>
                  <td className="text-foreground px-3 py-2.5 font-mono text-xs font-medium">
                    {row.sku}
                  </td>
                  {isInitialize ? (
                    <>
                      <td className="px-3 py-2.5 text-sm">
                        {(row as InitializeValidatedRow).brand}
                      </td>
                      <td className="px-3 py-2.5 text-sm">
                        {(row as InitializeValidatedRow).productName}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono">
                        {(row as InitializeValidatedRow).bultos}
                      </td>
                      <td className="px-3 py-2.5 text-sm">
                        {(row as InitializeValidatedRow).presentacion}
                      </td>
                      <td className="text-foreground px-3 py-2.5 text-right font-mono font-bold">
                        {row.status !== "error"
                          ? (row as InitializeValidatedRow).totalUnits
                          : "—"}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-2.5">
                        {(row as ValidatedRow).productName ?? "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono">
                        {(row as ValidatedRow).productId
                          ? (row as ValidatedRow).currentQuantity
                          : "—"}
                      </td>
                      {mode === "replace" ? (
                        <td className="text-foreground px-3 py-2.5 text-right font-mono font-bold">
                          {row.status !== "error"
                            ? (row as ValidatedRow).quantity
                            : "—"}
                        </td>
                      ) : (
                        <>
                          <td
                            className={`px-3 py-2.5 text-right font-mono font-bold ${
                              (row as ValidatedRow).quantity > 0
                                ? "text-emerald-600"
                                : (row as ValidatedRow).quantity < 0
                                  ? "text-red-600"
                                  : ""
                            }`}
                          >
                            {row.status !== "error"
                              ? `${(row as ValidatedRow).quantity > 0 ? "+" : ""}${(row as ValidatedRow).quantity}`
                              : "—"}
                          </td>
                          <td className="text-foreground px-3 py-2.5 text-right font-mono font-bold">
                            {row.status !== "error"
                              ? (row as ValidatedRow).currentQuantity +
                                (row as ValidatedRow).quantity
                              : "—"}
                          </td>
                        </>
                      )}
                    </>
                  )}
                  <td className="px-3 py-2.5 text-center">
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
                  {/* ── Message cell — full text, no truncation ── */}
                  <td className="min-w-[220px] px-3 py-2.5">
                    {row.message ? (
                      <div
                        className={`flex items-start gap-1.5 ${MESSAGE_STYLES[row.status].textColor}`}
                      >
                        <span className="material-symbols-outlined mt-0.5 shrink-0 text-sm">
                          {MESSAGE_STYLES[row.status].icon}
                        </span>
                        <span className="text-xs leading-relaxed wrap-break-word whitespace-normal">
                          {row.message}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
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
