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
import { Icons } from "@cendaro/ui/icons";

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
      let totalBultos = 0;
      const brandMap = new Map<string, number>();
      for (const row of committable) {
        totalUnits += row.totalUnits;
        totalBultos += row.bultos;
        brandMap.set(row.brand, (brandMap.get(row.brand) ?? 0) + 1);
      }

      return {
        toCommit: committable.length,
        locked: 0,
        errors: errors.length,
        totalPositiveDelta: totalUnits,
        totalNegativeDelta: 0,
        netDelta: totalUnits,
        brandsCount: brandMap.size,
        totalBultos,
        brandNames: Array.from(brandMap.entries()).map(([name, count]) => ({
          name,
          productCount: count,
        })),
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
      totalBultos: 0,
      brandNames: [] as { name: string; productCount: number }[],
    };
  }, [validatedRows, initializeRows, mode, forceLocked, isInitialize]);

  // Detailed error rows for the blocking panel
  const errorRows = useMemo(() => {
    if (isInitialize) {
      return initializeRows
        .filter((r) => r.status === "error")
        .map((r) => ({
          rowNumber: r.rowNumber,
          context: `${r.brand || "—"} / ${r.productName || "—"}`,
          message: r.message ?? "Error de validación",
        }));
    }
    return validatedRows
      .filter((r) => r.status === "error")
      .map((r) => ({
        rowNumber: r.rowNumber,
        context: `SKU: ${r.sku || "—"}`,
        message: r.message ?? "Error de validación",
      }));
  }, [validatedRows, initializeRows, isInitialize]);

  const hasErrors = errorRows.length > 0;
  const VISIBLE_ERRORS = 3;

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
        <h2 className="text-foreground text-xl font-medium">
          Resumen de Importación
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Almacén:{" "}
          <span className="text-foreground font-medium">{warehouseName}</span> —
          Modo:{" "}
          <span className="text-foreground font-medium">
            {MODE_LABELS[mode]}
          </span>
        </p>
      </div>

      {/* Summary cards */}
      {isInitialize ? (
        // Initialize mode cards
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="border-border bg-card border p-4 text-center">
            <Icons.Inventory2 className="size-6 text-emerald-600" />
            <p className="text-foreground mt-1 font-mono text-2xl font-medium tabular-nums">
              {summary.toCommit}
            </p>
            <p className="text-muted-foreground text-xs">Productos a crear</p>
          </div>
          <div className="border-border bg-card border p-4 text-center">
            <Icons.Category className="size-6 text-blue-600" />
            <p className="text-foreground mt-1 font-mono text-2xl font-medium tabular-nums">
              {summary.brandsCount}
            </p>
            <p className="text-muted-foreground text-xs">Marcas a crear</p>
          </div>
          <div className="border-border bg-card border p-4 text-center">
            <Icons.Package2 className="size-6 text-amber-600" />
            <p className="text-foreground mt-1 font-mono text-2xl font-medium tabular-nums">
              {summary.totalBultos}
            </p>
            <p className="text-muted-foreground text-xs">Bultos totales</p>
          </div>
          <div className="border-border bg-card border p-4 text-center">
            <Icons.DeployedCode className="size-6 text-sky-600" />
            <p className="text-foreground mt-1 font-mono text-2xl font-medium tabular-nums">
              {summary.totalPositiveDelta}
            </p>
            <p className="text-muted-foreground text-xs">Unidades totales</p>
          </div>
        </div>
      ) : (
        // Replace / Adjust mode cards
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="border-border bg-card border p-4 text-center">
            <Icons.CheckCircle className="size-6 text-emerald-600" />
            <p className="text-foreground mt-1 font-mono text-2xl font-medium tabular-nums">
              {summary.toCommit}
            </p>
            <p className="text-muted-foreground text-xs">
              Productos a actualizar
            </p>
          </div>
          <div className="border-border bg-card border p-4 text-center">
            <Icons.TrendingUp className="size-6 text-blue-600" />
            <p className="text-foreground mt-1 font-mono text-2xl font-medium tabular-nums">
              {summary.totalPositiveDelta > 0
                ? `+${summary.totalPositiveDelta}`
                : "0"}
            </p>
            <p className="text-muted-foreground text-xs">Delta positivo</p>
          </div>
          <div className="border-border bg-card border p-4 text-center">
            <Icons.TrendingDown className="size-6 text-red-600" />
            <p className="text-foreground mt-1 font-mono text-2xl font-medium tabular-nums">
              {summary.totalNegativeDelta}
            </p>
            <p className="text-muted-foreground text-xs">Delta negativo</p>
          </div>
        </div>
      )}

      {/* Net change */}
      <div className="border-border bg-card border p-4">
        {isInitialize ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm font-medium">
                Bultos totales
              </span>
              <span className="font-mono text-xl font-medium text-amber-500 tabular-nums">
                +{summary.totalBultos}
              </span>
            </div>
            <div className="border-border border-t" />
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm font-medium">
                Unidades totales
              </span>
              <span className="font-mono text-xl font-medium text-emerald-600 tabular-nums">
                +{summary.netDelta}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm font-medium">
              Cambio neto total
            </span>
            <span
              className={`font-mono text-xl font-medium tabular-nums ${
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
        )}
      </div>

      {/* New brands expandable dropdown — Initialize mode only */}
      {isInitialize && summary.brandNames.length > 0 && (
        <BrandsDropdown brands={summary.brandNames} />
      )}

      {/* Locked products option (owner/admin only) — not shown in Initialize */}
      {!isInitialize && summary.locked > 0 && canForceLock && (
        <div className="border-border bg-card border p-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              id="include-locked-products-checkbox"
              name="include-locked-products"
              type="checkbox"
              checked={forceLocked}
              onChange={(e) => onSetForceLocked(e.target.checked)}
              className="border-border mt-0.5 size-4 rounded-none"
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

      {/* Error blocking panel */}
      {hasErrors && (
        <ErrorBlockingPanel
          errorRows={errorRows}
          visibleCount={VISIBLE_ERRORS}
          isInitialize={!!isInitialize}
        />
      )}

      {/* Actions */}
      <div className="flex justify-between">
        <button
          onClick={onBack}
          disabled={isProcessing}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm font-medium transition-colors disabled:opacity-50"
        >
          <Icons.ArrowBack className="size-4.5" />
          Volver
        </button>
        <button
          onClick={handleConfirmClick}
          disabled={isProcessing || summary.toCommit === 0 || hasErrors}
          title={
            hasErrors
              ? "Debe corregir todos los errores antes de continuar"
              : undefined
          }
          className="bg-primary hover:bg-primary/90 inline-flex h-9 items-center gap-2 px-4 text-xs font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isProcessing ? (
            <>
              <div className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              {isInitialize ? "Inicializando..." : "Importando..."}
            </>
          ) : hasErrors ? (
            <>
              <Icons.Block className="size-4.5" />
              Corregir errores para continuar
            </>
          ) : (
            <>
              <Icons.Upload className="size-4.5" />
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
          <div className="border-border bg-card mx-4 w-full max-w-md border p-6">
            <div className="flex items-start gap-3">
              <Icons.Warning className="bg-warning/10 text-warning size-6 p-1" />
              <div>
                <h3 className="text-foreground text-lg font-medium">
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
                      <span className="font-medium">{warehouseName}</span>.
                    </>
                  ) : (
                    <>
                      Se actualizarán {summary.toCommit} productos en{" "}
                      <span className="font-medium">{warehouseName}</span>. Esta
                      acción no se puede deshacer fácilmente.
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
                className="bg-primary hover:bg-primary/90 h-9 px-4 text-xs font-medium text-white transition-colors"
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

// ── Error Blocking Panel ─────────────────────────

function ErrorBlockingPanel({
  errorRows,
  visibleCount,
  isInitialize,
}: {
  errorRows: { rowNumber: number; context: string; message: string }[];
  visibleCount: number;
  isInitialize: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const visible = errorRows.slice(0, visibleCount);
  const hidden = errorRows.slice(visibleCount);
  const hasMore = hidden.length > 0;

  return (
    <div className="border-destructive/30 bg-destructive/10 space-y-3 border p-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Icons.Error className="text-destructive size-5" />
        <div>
          <p className="text-destructive text-sm font-medium">
            {errorRows.length} error{errorRows.length !== 1 ? "es" : ""}{" "}
            encontrado{errorRows.length !== 1 ? "s" : ""}
          </p>
          <p className="text-destructive/80 text-xs">
            {isInitialize
              ? "Corrija los errores en su archivo Excel y vuelva a subir."
              : "Corrija los errores en su archivo Excel y vuelva a importar."}
          </p>
        </div>
      </div>

      {/* Visible errors */}
      <div className="space-y-2">
        {visible.map((err, idx) => (
          <ErrorRow key={idx} error={err} />
        ))}
      </div>

      {/* Expandable additional errors */}
      {hasMore && (
        <div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-destructive hover:bg-destructive/20 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors"
          >
            <Icons.ExpandMore
              className={`size-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
            />
            {expanded
              ? "Ocultar"
              : `Ver ${hidden.length} error${hidden.length !== 1 ? "es" : ""} más`}
          </button>

          {expanded && (
            <div className="mt-2 space-y-2">
              {hidden.map((err, idx) => (
                <ErrorRow key={idx + visibleCount} error={err} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ErrorRow({
  error,
}: {
  error: { rowNumber: number; context: string; message: string };
}) {
  return (
    <div className="border-destructive/20 bg-background/60 border px-3 py-2.5">
      <div className="flex items-start gap-3">
        {/* Row badge */}
        <span className="bg-destructive/15 text-destructive mt-0.5 shrink-0 px-1.5 py-0.5 font-mono text-xs font-medium">
          Fila {error.rowNumber}
        </span>

        {/* Details — text wraps for readability */}
        <div className="min-w-0 flex-1">
          <p className="text-destructive text-xs font-medium">
            {error.context}
          </p>
          <p className="text-destructive/80 mt-0.5 text-xs leading-relaxed text-wrap">
            {error.message}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Brands Dropdown ──────────────────────────────

function BrandsDropdown({
  brands,
}: {
  brands: { name: string; productCount: number }[];
}) {
  const [expanded, setExpanded] = useState(false);

  const sorted = useMemo(
    () => [...brands].sort((a, b) => a.name.localeCompare(b.name)),
    [brands],
  );

  return (
    <div className="border-border bg-card border">
      <button
        onClick={() => setExpanded(!expanded)}
        className="hover:bg-muted/50 flex w-full items-center justify-between px-4 py-3 text-left transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icons.Category className="size-4.5 text-emerald-600" />
          <span className="text-foreground text-sm font-medium">
            Marcas nuevas a crear ({brands.length})
          </span>
        </div>
        <Icons.ExpandMore
          className={`text-muted-foreground size-4.5 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {expanded && (
        <div className="border-border divide-border divide-y border-t">
          {sorted.map((b) => (
            <div
              key={b.name}
              className="hover:bg-muted/30 flex items-center justify-between px-4 py-2.5 transition-colors"
            >
              <span className="text-foreground text-sm">{b.name}</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                {b.productCount} producto{b.productCount !== 1 ? "s" : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
