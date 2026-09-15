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
        className={`flex items-start gap-3 border p-6 ${
          isFullSuccess
            ? "border-success/30 bg-success/10"
            : isPartial
              ? "border-warning/30 bg-warning/10"
              : "border-destructive/30 bg-destructive/10"
        }`}
      >
        <Icon
          name={isFullSuccess ? "CheckCircle" : isPartial ? "Warning" : "Error"}
          className={`size-7.5 ${
            isFullSuccess
              ? "text-success"
              : isPartial
                ? "text-warning"
                : "text-destructive"
          }`}
        />
        <div>
          <h2
            className={`text-xl font-medium ${
              isFullSuccess
                ? "text-success"
                : isPartial
                  ? "text-warning"
                  : "text-destructive"
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
                ? "text-success/90"
                : isPartial
                  ? "text-warning/90"
                  : "text-destructive/90"
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
            className="border-border bg-card border p-4 text-center"
          >
            <Icon name={s.icon} className={`size-5 ${s.color}`} />
            <p className="text-foreground mt-1 font-mono text-xl font-medium tabular-nums">
              {s.value}
            </p>
            <p className="text-muted-foreground text-xs">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Import details */}
      <div className="border-border bg-card space-y-2 border p-4 text-sm">
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
          className="border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20 flex w-full items-center justify-center gap-2 border px-4 py-3 text-xs font-medium transition-colors"
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
          className="bg-primary hover:bg-primary/90 inline-flex h-9 items-center gap-2 px-4 text-xs font-medium text-white transition-colors"
        >
          <Icons.UploadFile className="size-4.5" />
          Nueva Importación
        </button>
      </div>
    </div>
  );
}
