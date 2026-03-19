"use client";

/**
 * Cendaro — Catalog Import: Step 5 — Dry-Run Summary
 *
 * Shows what the import will do before committing.
 *
 * PRD: FEATURE_PRD_CATALOG_IMPORT.md §11
 */

interface DryRunSummaryProps {
  insertCount: number;
  updateCount: number;
  skipCount: number;
  errorCount: number;
  onCommit: () => void;
  onBack: () => void;
  isCommitting: boolean;
}

export function DryRunSummary({
  insertCount,
  updateCount,
  skipCount,
  errorCount,
  onCommit,
  onBack,
  isCommitting,
}: DryRunSummaryProps) {
  const totalProcessable = insertCount + updateCount;
  const hasErrors = errorCount > 0;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Summary header */}
      <div className="text-center">
        <div className="bg-primary/10 text-primary mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl">
          <span className="material-symbols-outlined text-3xl">preview</span>
        </div>
        <h2 className="text-foreground text-xl font-black">
          Resumen de importación
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Revisa los cambios antes de confirmar
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
            <span className="material-symbols-outlined">add_circle</span>
            <span className="text-2xl font-black">{insertCount}</span>
          </div>
          <p className="mt-1 text-xs font-medium text-emerald-600 dark:text-emerald-500">
            Productos nuevos
          </p>
        </div>

        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
          <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
            <span className="material-symbols-outlined">update</span>
            <span className="text-2xl font-black">{updateCount}</span>
          </div>
          <p className="mt-1 text-xs font-medium text-blue-600 dark:text-blue-500">
            Productos actualizados
          </p>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <span className="material-symbols-outlined">skip_next</span>
            <span className="text-2xl font-black">{skipCount}</span>
          </div>
          <p className="mt-1 text-xs font-medium text-amber-600 dark:text-amber-500">
            Omitidos (sin cambios)
          </p>
        </div>

        <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
            <span className="material-symbols-outlined">error</span>
            <span className="text-2xl font-black">{errorCount}</span>
          </div>
          <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-500">
            Errores (no se procesan)
          </p>
        </div>
      </div>

      {/* Error blocking */}
      {hasErrors && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400">
          <span className="material-symbols-outlined text-lg">block</span>
          {errorCount} fila(s) con errores serán excluidas de la importación
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={onBack}
          disabled={isCommitting}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          Volver
        </button>

        <button
          onClick={onCommit}
          disabled={totalProcessable === 0 || isCommitting}
          className="bg-primary hover:bg-primary/90 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white transition-all hover:shadow-lg active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isCommitting ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Importando...
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-lg">
                check_circle
              </span>
              Confirmar importación ({totalProcessable} productos)
            </>
          )}
        </button>
      </div>
    </div>
  );
}
