"use client";

/**
 * Step 6 — Result Summary
 *
 * Final result display with success/partial/failed states.
 * PRD: FEATURE_PRD_INVENTORY_IMPORT.md §15, §20 (ImportCompleted/ImportPartial)
 */
import type { ImportResult } from "@cendaro/api";
import type { IconName } from "@cendaro/ui/icons";
import { Icon, Icons } from "@cendaro/ui/icons";

import { downloadAsXlsx } from "~/lib/xlsx/download";

interface ResultSummaryProps {
  result: ImportResult;
  warehouseId: string;
  warehouseName: string;
  filename: string;
  onNewImport: () => void;
}

export function ResultSummary({
  result,
  warehouseId,
  warehouseName,
  filename,
  onNewImport,
}: ResultSummaryProps) {
  const isFullSuccess = result.failed === 0 && result.skipped === 0;
  const isPartial =
    result.committed > 0 && (result.failed > 0 || result.skipped > 0);
  const _isFailed = result.committed === 0;

  const handleDownloadErrors = () => {
    if (result.errors.length === 0) return;

    const rows = result.errors.map((e) => ({
      Fila: e.rowNumber,
      SKU: e.sku,
      Código: e.code,
      Mensaje: e.message,
    }));

    const date = new Date().toISOString().slice(0, 10);
    downloadAsXlsx(rows, `errores-importacion-${warehouseName}-${date}.xlsx`);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Status banner */}
      <div
        className={`flex items-start gap-3 rounded-xl p-6 ${
          isFullSuccess
            ? "bg-emerald-50 dark:bg-emerald-900/20"
            : isPartial
              ? "bg-amber-50 dark:bg-amber-900/20"
              : "bg-red-50 dark:bg-red-900/20"
        }`}
      >
        <Icon
          name={isFullSuccess ? "CheckCircle" : isPartial ? "Warning" : "Error"}
          className={`size-7.5 ${
            isFullSuccess
              ? "text-emerald-600"
              : isPartial
                ? "text-amber-600"
                : "text-red-600"
          }`}
        />
        <div>
          <h2
            className={`text-xl font-medium ${
              isFullSuccess
                ? "text-emerald-800 dark:text-emerald-200"
                : isPartial
                  ? "text-amber-800 dark:text-amber-200"
                  : "text-red-800 dark:text-red-200"
            }`}
          >
            {isFullSuccess
              ? "Importación Completada"
              : isPartial
                ? "Importación Parcial"
                : "Importación Fallida"}
          </h2>
          <p
            className={`mt-1 text-sm ${
              isFullSuccess
                ? "text-emerald-700 dark:text-emerald-300"
                : isPartial
                  ? "text-amber-700 dark:text-amber-300"
                  : "text-red-700 dark:text-red-300"
            }`}
          >
            {isFullSuccess
              ? `Se actualizaron ${result.committed} productos exitosamente.`
              : isPartial
                ? `${result.committed} éxitos, ${result.failed} fallos, ${result.skipped} omitidos.`
                : "No se pudo completar la importación."}
          </p>
        </div>
      </div>

      {/* Result stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        {(
          [
            {
              label: "Importados",
              value: result.committed,
              icon: "CheckCircle",
              color: "text-emerald-600",
            },
            {
              label: "Omitidos",
              value: result.skipped,
              icon: "SkipNext",
              color: "text-amber-600",
            },
            {
              label: "Fallidos",
              value: result.failed,
              icon: "Error",
              color: "text-red-600",
            },
            {
              label: "Delta Total",
              value: `${result.totalDelta > 0 ? "+" : ""}${result.totalDelta}`,
              icon: "Analytics",
              color: "text-blue-600",
            },
          ] as {
            label: string;
            value: string | number;
            icon: IconName;
            color: string;
          }[]
        ).map((s) => (
          <div
            key={s.label}
            className="border-border bg-card rounded-xl border p-4 text-center"
          >
            <Icon name={s.icon} className={`size-5 ${s.color}`} />
            <p className="text-foreground mt-1 text-xl font-black">{s.value}</p>
            <p className="text-muted-foreground text-xs">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Import details */}
      <div className="border-border bg-card space-y-2 rounded-xl border p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Archivo</span>
          <span className="text-foreground font-medium">{filename}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Almacén</span>
          <span className="text-foreground font-medium">{warehouseName}</span>
        </div>
        {result.auditLogId && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">ID Auditoría</span>
            <span className="text-foreground font-mono text-xs">
              {result.auditLogId.slice(0, 8)}...
            </span>
          </div>
        )}
      </div>

      {/* Download errors button */}
      {result.errors.length > 0 && (
        <button
          onClick={handleDownloadErrors}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
        >
          <Icons.Download className="size-4.5" />
          Descargar errores ({result.errors.length} filas)
        </button>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
        <a
          href={`/inventory/warehouse/${warehouseId}`}
          className="text-primary hover:text-primary/80 inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
        >
          <Icons.ArrowBack className="size-4.5" />
          Volver al almacén
        </a>
        <button
          onClick={onNewImport}
          className="bg-primary hover:bg-primary/90 inline-flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-colors"
        >
          <Icons.UploadFile className="size-4.5" />
          Nueva Importación
        </button>
      </div>
    </div>
  );
}
