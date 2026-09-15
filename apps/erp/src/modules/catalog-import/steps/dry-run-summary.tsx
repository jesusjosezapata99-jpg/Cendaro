"use client";

import { Icons } from "@cendaro/ui/icons";

import { formatPlural } from "~/lib/plural";

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
        <div className="bg-muted text-muted-foreground border-border mx-auto mb-4 flex size-12 items-center justify-center border">
          <Icons.Preview className="size-6" />
        </div>
        <h2 className="text-foreground text-xl font-medium tracking-tight">
          Resumen de importación
        </h2>
        <p className="text-muted-foreground mt-1 text-xs">
          Revisa los cambios antes de confirmar
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="border-border bg-card border p-4">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <Icons.AddCircle className="size-5" />
            <span className="font-mono text-2xl font-medium tabular-nums">
              {insertCount}
            </span>
          </div>
          <p className="text-muted-foreground mt-1 text-xs font-medium">
            Productos nuevos
          </p>
        </div>

        <div className="border-border bg-card border p-4">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
            <Icons.Update className="size-5" />
            <span className="font-mono text-2xl font-medium tabular-nums">
              {updateCount}
            </span>
          </div>
          <p className="text-muted-foreground mt-1 text-xs font-medium">
            Productos actualizados
          </p>
        </div>

        <div className="border-border bg-card border p-4">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <Icons.SkipNext className="size-5" />
            <span className="font-mono text-2xl font-medium tabular-nums">
              {skipCount}
            </span>
          </div>
          <p className="text-muted-foreground mt-1 text-xs font-medium">
            Omitidos (sin cambios)
          </p>
        </div>

        <div className="border-border bg-card border p-4">
          <div className="text-destructive flex items-center gap-2">
            <Icons.Error className="size-5" />
            <span className="font-mono text-2xl font-medium tabular-nums">
              {errorCount}
            </span>
          </div>
          <p className="text-muted-foreground mt-1 text-xs font-medium">
            Errores (no se procesan)
          </p>
        </div>
      </div>

      {/* Error blocking */}
      {hasErrors && (
        <div className="border-destructive/30 bg-destructive/10 text-destructive flex items-center gap-2 border px-4 py-3 text-xs">
          <Icons.Block className="size-4" />
          {formatPlural(errorCount, "fila", "filas")} con errores serán
          excluidas de la importación
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={onBack}
          disabled={isCommitting}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs transition-colors disabled:opacity-50"
        >
          <Icons.ArrowBack className="size-3.5" />
          Volver
        </button>

        <button
          onClick={onCommit}
          disabled={totalProcessable === 0 || isCommitting}
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center gap-2 px-4 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isCommitting ? (
            <>
              <div className="size-3.5 animate-spin border-2 border-white border-t-transparent" />
              Importando...
            </>
          ) : (
            <>
              <Icons.CheckCircle className="size-4" />
              Confirmar importación ({totalProcessable} productos)
            </>
          )}
        </button>
      </div>
    </div>
  );
}
