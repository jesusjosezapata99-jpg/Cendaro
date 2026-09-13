"use client";

/**
 * Cendaro — Catalog Import: Step 3 — Validation Preview
 *
 * Shows validated rows with status filtering and error details.
 *
 * PRD: FEATURE_PRD_CATALOG_IMPORT.md §11
 */
import { useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

import type { IconName } from "@cendaro/ui/icons";
import { Icon, Icons } from "@cendaro/ui/icons";

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

  const parentRef = useRef<HTMLDivElement>(null);

  const filteredRows = useMemo(() => {
    if (filter === "all") return validatedRows;
    return validatedRows.filter((r) => r.status === filter);
  }, [validatedRows, filter]);

  const rowVirtualizer = useVirtualizer({
    count: filteredRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 10,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  const firstRow = virtualRows[0];
  const lastRow = virtualRows[virtualRows.length - 1];

  const paddingTop = firstRow ? firstRow.start : 0;
  const paddingBottom = lastRow ? totalSize - lastRow.end : 0;

  const statCards: {
    key: StatusFilter;
    label: string;
    count: number;
    color: string;
    icon: IconName;
  }[] = [
    {
      key: "all",
      label: "Total",
      count: validatedRows.length,
      color: "text-foreground bg-muted/50",
      icon: "List",
    },
    {
      key: "valid",
      label: "Válidas",
      count: validCount,
      color:
        "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20",
      icon: "CheckCircle",
    },
    {
      key: "warning",
      label: "Advertencias",
      count: warningCount,
      color:
        "text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20",
      icon: "Warning",
    },
    {
      key: "error",
      label: "Errores",
      count: errorCount,
      color: "text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-900/20",
      icon: "Error",
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
              <Icon name={card.icon} className="size-4.5" />
              <span className="text-2xl font-black">{card.count}</span>
            </div>
            <p className="mt-1 text-xs font-medium opacity-70">{card.label}</p>
          </button>
        ))}
      </div>

      {/* Data table */}
      <div className="overflow-hidden rounded-xl border">
        <div ref={parentRef} className="max-h-100 overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2 text-left font-medium">#</th>
                <th className="px-3 py-2 text-left font-medium">Estado</th>
                <th className="px-3 py-2 text-left font-medium">SKU</th>
                <th className="px-3 py-2 text-left font-medium">Nombre</th>
                <th className="px-3 py-2 text-left font-medium">Categoría</th>
                <th className="px-3 py-2 text-left font-medium">Marca</th>
                <th className="px-3 py-2 text-left font-medium">Costo</th>
                <th className="px-3 py-2 text-left font-medium">Mensajes</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {paddingTop > 0 && (
                <tr>
                  <td colSpan={8} style={{ height: `${paddingTop}px` }} />
                </tr>
              )}
              {virtualRows.map((virtualRow) => {
                const row = filteredRows[virtualRow.index];
                if (!row) return null;
                return (
                  <tr
                    key={virtualRow.key}
                    ref={rowVirtualizer.measureElement}
                    data-index={virtualRow.index}
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
                      <Icon
                        name={
                          row.status === "valid"
                            ? "CheckCircle"
                            : row.status === "warning"
                              ? "Warning"
                              : "Error"
                        }
                        className={`size-4 ${
                          row.status === "valid"
                            ? "text-emerald-500"
                            : row.status === "warning"
                              ? "text-amber-500"
                              : "text-red-500"
                        }`}
                      />
                    </td>
                    <td className="text-foreground px-3 py-2 font-mono text-xs">
                      {row.sku || "—"}
                    </td>
                    <td className="text-foreground max-w-50 truncate px-3 py-2">
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
                );
              })}
              {paddingBottom > 0 && (
                <tr>
                  <td colSpan={8} style={{ height: `${paddingBottom}px` }} />
                </tr>
              )}
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
          <Icons.ArrowBack className="size-4.5" />
          Volver
        </button>

        <button
          onClick={onProceed}
          disabled={validCount === 0}
          className="bg-primary hover:bg-primary/90 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-medium text-white transition-all hover:shadow-lg active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Icons.ArrowForward className="size-4.5" />
          Continuar con {validCount + warningCount} filas
        </button>
      </div>
    </div>
  );
}
