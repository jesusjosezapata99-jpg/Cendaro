"use client";

/**
 * Cendaro — Catalog Import: Step 6 — Result Summary
 *
 * Shows the final outcome of the import.
 *
 * PRD: FEATURE_PRD_CATALOG_IMPORT.md §11
 */
import Link from "next/link";

import type { ImportResult } from "../hooks/use-catalog-import";

// ── Component ────────────────────────────────────

interface ResultSummaryProps {
  result: ImportResult;
  onNewImport: () => void;
}

export function ResultSummary({ result, onNewImport }: ResultSummaryProps) {
  const totalSuccess = result.inserted + result.updated;
  const hasFailures = result.failed > 0;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Result icon */}
      <div className="text-center">
        <div
          className={`mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl ${
            hasFailures
              ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
              : "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
          }`}
        >
          <span className="material-symbols-outlined text-4xl">
            {hasFailures ? "warning" : "check_circle"}
          </span>
        </div>
        <h2 className="text-foreground text-xl font-black">
          {hasFailures ? "Importación parcial" : "Importación exitosa"}
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          {totalSuccess} producto(s) procesados correctamente
        </p>
      </div>

      {/* Result stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20">
          <span className="text-2xl font-black text-emerald-700 dark:text-emerald-400">
            {result.inserted}
          </span>
          <p className="text-xs font-medium text-emerald-600 dark:text-emerald-500">
            Nuevos productos creados
          </p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
          <span className="text-2xl font-black text-blue-700 dark:text-blue-400">
            {result.updated}
          </span>
          <p className="text-xs font-medium text-blue-600 dark:text-blue-500">
            Productos actualizados
          </p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
          <span className="text-2xl font-black text-amber-700 dark:text-amber-400">
            {result.skipped}
          </span>
          <p className="text-xs font-medium text-amber-600 dark:text-amber-500">
            Omitidos
          </p>
        </div>
        {result.failed > 0 && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
            <span className="text-2xl font-black text-red-700 dark:text-red-400">
              {result.failed}
            </span>
            <p className="text-xs font-medium text-red-600 dark:text-red-500">
              Fallos
            </p>
          </div>
        )}
      </div>

      {/* Error details */}
      {result.errors.length > 0 && (
        <div className="space-y-2 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-900/20">
          <h3 className="text-sm font-semibold text-red-700 dark:text-red-400">
            Errores ({result.errors.length})
          </h3>
          <div className="max-h-[200px] space-y-1 overflow-auto">
            {result.errors.map((err, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400"
              >
                <span className="rounded bg-red-200 px-1.5 py-0.5 font-mono dark:bg-red-800">
                  Fila {err.rowNumber}
                </span>
                <span className="font-semibold">{err.sku}</span>
                <span className="truncate">{err.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-center gap-4 pt-2">
        <Link
          href="/catalog"
          className="border-border hover:bg-muted/50 inline-flex items-center gap-2 rounded-xl border px-6 py-3 text-sm font-semibold transition-all"
        >
          <span className="material-symbols-outlined text-lg">inventory_2</span>
          Ver catálogo
        </Link>
        <button
          onClick={onNewImport}
          className="bg-primary hover:bg-primary/90 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white transition-all hover:shadow-lg active:scale-[0.98]"
        >
          <span className="material-symbols-outlined text-lg">upload_file</span>
          Nueva importación
        </button>
      </div>
    </div>
  );
}
