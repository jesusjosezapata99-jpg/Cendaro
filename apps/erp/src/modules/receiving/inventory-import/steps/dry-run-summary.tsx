"use client";

/**
 * Step 6 — Dry-Run Summary
 *
 * Aggregate summary before commit with confirmation dialog.
 * Supports Replace/Adjust (validatedRows) and Initialize (initializeRows).
 * PRD: FEATURE_PRD_INVENTORY_IMPORT.md §15, §20 (DryRunReady → ConfirmImport)
 */
import { useMemo, useState } from "react";

import type { ImportMode, ValidatedRow } from "@cendaro/api";

import type { InitializeValidatedRow } from "../lib/inventory-validators";

interface DryRunSummaryProps {
  validatedRows: ValidatedRow[];
  /** Initialize mode validated rows (takes precedence when provided) */
  initializeRows?: InitializeValidatedRow[];
  mode: ImportMode;
  warehouseName: string;
  forceLocked: boolean;
  onSetForceLocked: (value: boolean) => void;
  onConfirm: () => void;
  onBack: () => void;
  isProcessing: boolean;
  /** Whether the current user can force-unlock (owner/admin) */
  canForceLock: boolean;
}

const MODE_LABELS: Record<ImportMode, string> = {
  replace: "Reemplazar",
  adjust: "Ajustar",
  initialize: "Inicializar",
};

export function DryRunSummary({
  validatedRows,
  initializeRows,
  mode,
  warehouseName,
  forceLocked,
  onSetForceLocked,
  onConfirm,
  onBack,
  isProcessing,
  canForceLock,
}: DryRunSummaryProps) {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const isInitialize = mode === "initialize" && initializeRows;

  const summary = useMemo(() => {
    if (isInitialize) {
      // Initialize mode: count valid + warning rows, sum totalUnits
      const committable = initializeRows.filter(
        (r) => r.status === "valid" || r.status === "warning",
      );
      const errors = initializeRows.filter((r) => r.status === "error");

      let totalUnits = 0;
      const brandSet = new Set<string>();
      for (const row of committable) {
        totalUnits += row.totalUnits;
        brandSet.add(row.brand);
      }

      return {
        toCommit: committable.length,
        locked: 0,
        errors: errors.length,
        totalPositiveDelta: totalUnits,
        totalNegativeDelta: 0,
        netDelta: totalUnits,
        brandsCount: brandSet.size,
      };
    }

    // Replace / Adjust mode
    const committable = validatedRows.filter(
      (r) =>
        r.status === "valid" ||
        (r.status === "warning" && forceLocked && r.isLocked),
    );
    const locked = validatedRows.filter(
      (r) => r.status === "warning" && r.isLocked,
    );
    const errors = validatedRows.filter((r) => r.status === "error");

    let totalPositiveDelta = 0;
    let totalNegativeDelta = 0;

    for (const row of committable) {
      const delta =
        mode === "replace" ? row.quantity - row.currentQuantity : row.quantity;
      if (delta >= 0) totalPositiveDelta += delta;
      else totalNegativeDelta += delta;
    }

    return {
      toCommit: committable.length,
      locked: locked.length,
      errors: errors.length,
      totalPositiveDelta,
      totalNegativeDelta,
      netDelta: totalPositiveDelta + totalNegativeDelta,
      brandsCount: 0,
    };
  }, [validatedRows, initializeRows, mode, forceLocked, isInitialize]);

  const handleConfirmClick = () => {
    if (isProcessing) return; // Double-click guard (AC-22)
    setShowConfirmDialog(true);
  };

  const handleFinalConfirm = () => {
    setShowConfirmDialog(false);
    onConfirm();
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="text-center">
        <h2 className="text-foreground text-xl font-bold">
          Resumen de Importación
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Almacén:{" "}
          <span className="text-foreground font-semibold">{warehouseName}</span>{" "}
          — Modo:{" "}
          <span className="text-foreground font-semibold">
            {MODE_LABELS[mode]}
          </span>
        </p>
      </div>

      {/* Summary cards */}
      {isInitialize ? (
        // Initialize mode cards
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="border-border bg-card rounded-xl border p-4 text-center">
            <span className="material-symbols-outlined text-2xl text-emerald-600">
              inventory_2
            </span>
            <p className="text-foreground mt-1 text-2xl font-black">
              {summary.toCommit}
            </p>
            <p className="text-muted-foreground text-xs">Productos a crear</p>
          </div>
          <div className="border-border bg-card rounded-xl border p-4 text-center">
            <span className="material-symbols-outlined text-2xl text-blue-600">
              category
            </span>
            <p className="text-foreground mt-1 text-2xl font-black">
              {summary.brandsCount}
            </p>
            <p className="text-muted-foreground text-xs">Marcas a crear</p>
          </div>
          <div className="border-border bg-card rounded-xl border p-4 text-center">
            <span className="material-symbols-outlined text-2xl text-sky-600">
              package_2
            </span>
            <p className="text-foreground mt-1 text-2xl font-black">
              {summary.totalPositiveDelta}
            </p>
            <p className="text-muted-foreground text-xs">Unidades totales</p>
          </div>
        </div>
      ) : (
        // Replace / Adjust mode cards
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="border-border bg-card rounded-xl border p-4 text-center">
            <span className="material-symbols-outlined text-2xl text-emerald-600">
              check_circle
            </span>
            <p className="text-foreground mt-1 text-2xl font-black">
              {summary.toCommit}
            </p>
            <p className="text-muted-foreground text-xs">
              Productos a actualizar
            </p>
          </div>
          <div className="border-border bg-card rounded-xl border p-4 text-center">
            <span className="material-symbols-outlined text-2xl text-blue-600">
              trending_up
            </span>
            <p className="text-foreground mt-1 text-2xl font-black">
              {summary.totalPositiveDelta > 0
                ? `+${summary.totalPositiveDelta}`
                : "0"}
            </p>
            <p className="text-muted-foreground text-xs">Delta positivo</p>
          </div>
          <div className="border-border bg-card rounded-xl border p-4 text-center">
            <span className="material-symbols-outlined text-2xl text-red-600">
              trending_down
            </span>
            <p className="text-foreground mt-1 text-2xl font-black">
              {summary.totalNegativeDelta}
            </p>
            <p className="text-muted-foreground text-xs">Delta negativo</p>
          </div>
        </div>
      )}

      {/* Net change */}
      <div className="border-border bg-card rounded-xl border p-4">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm font-medium">
            {isInitialize ? "Stock inicial total" : "Cambio neto total"}
          </span>
          <span
            className={`text-xl font-black ${
              summary.netDelta > 0
                ? "text-emerald-600"
                : summary.netDelta < 0
                  ? "text-red-600"
                  : "text-foreground"
            }`}
          >
            {summary.netDelta > 0 ? "+" : ""}
            {summary.netDelta}
          </span>
        </div>
      </div>

      {/* Locked products option (owner/admin only) — not shown in Initialize */}
      {!isInitialize && summary.locked > 0 && canForceLock && (
        <div className="border-border bg-card rounded-xl border p-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={forceLocked}
              onChange={(e) => onSetForceLocked(e.target.checked)}
              className="border-border mt-0.5 size-4 rounded"
            />
            <div>
              <p className="text-foreground text-sm font-medium">
                Incluir productos bloqueados ({summary.locked})
              </p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Actualizar productos que están marcados como bloqueados en este
                almacén. Solo disponible para administradores.
              </p>
            </div>
          </label>
        </div>
      )}

      {/* Error count note */}
      {summary.errors > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-400">
          <span className="material-symbols-outlined text-lg">info</span>
          {summary.errors} fila{summary.errors !== 1 ? "s" : ""} con errores
          será{summary.errors !== 1 ? "n" : ""} omitida
          {summary.errors !== 1 ? "s" : ""}.
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-between">
        <button
          onClick={onBack}
          disabled={isProcessing}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm font-medium transition-colors disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          Volver
        </button>
        <button
          onClick={handleConfirmClick}
          disabled={isProcessing || summary.toCommit === 0}
          className="bg-primary hover:bg-primary/90 inline-flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isProcessing ? (
            <>
              <div className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              {isInitialize ? "Inicializando..." : "Importando..."}
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-lg">upload</span>
              {isInitialize
                ? `Inicializar ${summary.toCommit} productos`
                : `Importar ${summary.toCommit} productos`}
            </>
          )}
        </button>
      </div>

      {/* Confirmation dialog */}
      {showConfirmDialog && (
        <div className="bg-background/80 fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm">
          <div className="border-border bg-card mx-4 w-full max-w-md rounded-xl border p-6 shadow-xl">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined rounded-lg bg-amber-100 p-2 text-2xl text-amber-600 dark:bg-amber-900/30">
                warning
              </span>
              <div>
                <h3 className="text-foreground text-lg font-bold">
                  {isInitialize
                    ? "Confirmar Inicialización"
                    : "Confirmar Importación"}
                </h3>
                <p className="text-muted-foreground mt-1 text-sm">
                  {isInitialize ? (
                    <>
                      Se crearán {summary.brandsCount} marca
                      {summary.brandsCount !== 1 ? "s" : ""}, {summary.toCommit}{" "}
                      producto
                      {summary.toCommit !== 1 ? "s" : ""} y{" "}
                      {summary.totalPositiveDelta} unidades de stock en{" "}
                      <span className="font-semibold">{warehouseName}</span>.
                    </>
                  ) : (
                    <>
                      Se actualizarán {summary.toCommit} productos en{" "}
                      <span className="font-semibold">{warehouseName}</span>.
                      Esta acción no se puede deshacer fácilmente.
                    </>
                  )}
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowConfirmDialog(false)}
                className="text-muted-foreground hover:text-foreground px-4 py-2 text-sm font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleFinalConfirm}
                className="bg-primary hover:bg-primary/90 rounded-lg px-6 py-2 text-sm font-semibold text-white transition-colors"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
