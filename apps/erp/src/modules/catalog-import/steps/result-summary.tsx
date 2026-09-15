"use client";

/**
 * Cendaro — Catalog Import: Step 6 — Result Summary
 *
 * Shows the final outcome of the import.
 *
 * PRD: FEATURE_PRD_CATALOG_IMPORT.md §11
 */
import Link from "next/link";

import { Icons } from "@cendaro/ui/icons";

import type { ImportResult } from "../hooks/use-catalog-import";
// ── Component ────────────────────────────────────

import { formatPlural } from "~/lib/plural";

interface ResultSummaryProps {
  result: ImportResult;
  onNewImport: () => void;
}

export function ResultSummary({ result, onNewImport }: ResultSummaryProps) {
  const totalSuccess = result.inserted + result.updated;
  const hasFailures = result.failed > 0;

  return (
    <div className="space-y-6">
      {/* Status banner */}
      <div className="text-center">
        <div
          className={`mx-auto mb-3 flex size-12 items-center justify-center border ${
            hasFailures
              ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          }`}
        >
          {hasFailures ? (
            <Icons.Warning className="size-6" />
          ) : (
            <Icons.CheckCircle className="size-6" />
          )}
        </div>
        <h2 className="text-foreground text-xl font-medium tracking-tight">
          {hasFailures ? "Importación parcial" : "Importación exitosa"}
        </h2>
        <p className="text-muted-foreground mt-1 text-xs">
          {formatPlural(
            totalSuccess,
            "producto procesado",
            "productos procesados",
          )}{" "}
          correctamente
        </p>
      </div>

      {/* Result stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="border-border bg-card border p-4">
          <span className="font-mono text-2xl font-medium text-emerald-600 tabular-nums dark:text-emerald-400">
            {result.inserted}
          </span>
          <p className="text-muted-foreground mt-1 text-xs font-medium">
            Nuevos productos creados
          </p>
        </div>
        <div className="border-border bg-card border p-4">
          <span className="font-mono text-2xl font-medium text-blue-600 tabular-nums dark:text-blue-400">
            {result.updated}
          </span>
          <p className="text-muted-foreground mt-1 text-xs font-medium">
            Productos actualizados
          </p>
        </div>
        <div className="border-border bg-card border p-4">
          <span className="font-mono text-2xl font-medium text-amber-600 tabular-nums dark:text-amber-400">
            {result.skipped}
          </span>
          <p className="text-muted-foreground mt-1 text-xs font-medium">
            Omitidos
          </p>
        </div>
        {result.failed > 0 && (
          <div className="border-border bg-card border p-4">
            <span className="text-destructive font-mono text-2xl font-medium tabular-nums">
              {result.failed}
            </span>
            <p className="text-muted-foreground mt-1 text-xs font-medium">
              Fallos
            </p>
          </div>
        )}
      </div>

      {/* Error details */}
      {result.errors.length > 0 && (
        <div className="border-destructive/30 bg-destructive/10 space-y-2 border p-4">
          <h3 className="text-destructive text-xs font-medium">
            Errores ({result.errors.length})
          </h3>
          <div className="max-h-50 space-y-1 overflow-auto">
            {result.errors.map((err, idx) => (
              <div
                key={idx}
                className="text-destructive flex items-center gap-2 text-xs"
              >
                <span className="border-destructive/30 bg-destructive/10 border px-1.5 py-0.5 font-mono text-[10px]">
                  Fila {err.rowNumber}
                </span>
                <span className="font-medium">{err.sku}</span>
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
          className="border-border hover:bg-muted/50 inline-flex h-9 items-center gap-2 border px-4 text-xs font-medium transition-colors"
        >
          <Icons.Inventory2 className="size-3.5" />
          Ver catálogo
        </Link>
        <button
          onClick={onNewImport}
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center gap-2 px-4 text-xs font-medium transition-colors"
        >
          <Icons.UploadFile className="size-3.5" />
          Nueva importación
        </button>
      </div>
    </div>
  );
}
