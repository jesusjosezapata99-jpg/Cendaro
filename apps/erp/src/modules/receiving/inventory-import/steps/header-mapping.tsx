"use client";

/**
 * Step 3 — Header Mapping (Zero-Template + Semantic SKU Ready)
 *
 * Auto-detected + AI-inferred + manual override column mapping.
 */
import type { ImportMode } from "@cendaro/api";
import { Icons } from "@cendaro/ui/icons";
import { StatusPill } from "@cendaro/ui/status-pill";

import type { InventoryAiSummary } from "../hooks/use-parse-inventory-file";
import type { ImportField } from "../lib/inventory-header-aliases";
import { canConfirmInventoryHeaderMap } from "../lib/inventory-header-aliases";

interface HeaderMappingProps {
  headers: string[];
  headerMap: Record<string, number>;
  unmapped: string[];
  sheetName: string;
  totalRows: number;
  mode: ImportMode;
  aiSummary?: InventoryAiSummary | null;
  isMultiSchemaBatch?: boolean;
  isResolvingSemantic?: boolean;
  onUpdateMap: (map: Record<string, number>) => void;
  onConfirm: () => void;
}

const FIELD_OPTIONS: { value: ImportField | ""; label: string }[] = [
  { value: "", label: "— Ignorar —" },
  { value: "sku", label: "SKU / Referencia" },
  { value: "barcode", label: "Código de barras / EAN" },
  { value: "producto", label: "Producto / Nombre" },
  { value: "marca", label: "Marca" },
  { value: "bultos", label: "Bultos" },
  { value: "quantity", label: "Cantidad / Unidades directas" },
  { value: "cajasPerBulk", label: "Cajas/Bulto" },
  { value: "unidPerCaja", label: "Unid/Caja" },
  { value: "presentacion", label: "Presentación" },
  { value: "stockTotal", label: "Stock Total" },
];

export function HeaderMapping({
  headers,
  headerMap,
  unmapped,
  sheetName,
  totalRows,
  mode,
  aiSummary,
  isMultiSchemaBatch = false,
  isResolvingSemantic = false,
  onUpdateMap,
  onConfirm,
}: HeaderMappingProps) {
  const reverseMap = new Map<number, string>();
  for (const [field, index] of Object.entries(headerMap)) {
    reverseMap.set(index, field);
  }

  const check = canConfirmInventoryHeaderMap(headerMap, mode);
  const canConfirm = isMultiSchemaBatch || check.ok;
  const missingSkuInReplaceAdjust =
    mode !== "initialize" && !("sku" in headerMap) && check.ok;

  const handleFieldChange = (colIndex: number, newField: string) => {
    const updated = { ...headerMap };

    for (const key of Object.keys(updated)) {
      if (updated[key] === colIndex) {
        delete updated[key];
      }
    }

    if (newField) {
      delete updated[newField];
      updated[newField] = colIndex;
    }

    onUpdateMap(updated);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="text-center">
        <h2 className="text-foreground text-xl font-medium">
          Mapeo de Columnas
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Fuente: <span className="font-medium">{sheetName}</span> —{" "}
          {Math.max(0, totalRows - 1).toLocaleString()} filas detectadas
        </p>
      </div>

      {/* Zero-Template Telemetry Banner */}
      {aiSummary && (
        <div className="border-border bg-card flex flex-wrap items-center justify-between gap-3 border px-4 py-3 text-xs">
          <div className="flex items-center gap-2">
            <Icons.SmartToy className="text-status-info-fg size-4 shrink-0" />
            <span className="text-foreground font-medium">
              Estructura analizada:
            </span>
            <span className="text-muted-foreground">
              {aiSummary.fileCount} archivo(s)
              {aiSummary.sheetCount > 0
                ? ` · ${aiSummary.sheetCount} hoja(s)`
                : ""}
              {aiSummary.pdfFilesExtracted > 0
                ? ` · ${aiSummary.pdfFilesExtracted} PDF`
                : ""}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {aiSummary.templateProfileHits > 0 && (
              <StatusPill tone="success">
                {aiSummary.templateProfileHits} huella(s) recordada(s)
              </StatusPill>
            )}
            {aiSummary.aiInferredSheets > 0 && (
              <StatusPill tone="info">
                {aiSummary.aiInferredSheets} inferida(s) con IA
              </StatusPill>
            )}
            {aiSummary.pdfFilesExtracted > 0 && (
              <StatusPill tone="info">Extracción PDF multimodal</StatusPill>
            )}
          </div>
        </div>
      )}

      {/* Missing required columns warning */}
      {!isMultiSchemaBatch && !check.ok && (
        <div className="border-destructive/30 bg-destructive/10 text-destructive flex items-start gap-2 border px-4 py-3 text-sm">
          <Icons.Error className="mt-0.5 size-4.5 shrink-0" />
          <div>
            <p className="font-medium">Columnas mínimas requeridas:</p>
            <p>{check.missingSummary.join(" y ")}</p>
          </div>
        </div>
      )}

      {/* Semantic SKU resolution info when SKU column is absent */}
      {!isMultiSchemaBatch && missingSkuInReplaceAdjust && (
        <div className="border-status-info-fg/30 bg-status-info-bg text-status-info-fg flex items-start gap-2 border px-4 py-3 text-xs">
          <Icons.Bolt className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">
              Resolución Semántica RAG de SKU activada:
            </p>
            <p>
              El archivo no incluye columna SKU; al confirmar se buscarán los
              productos equivalentes en tu catálogo por nombre y código de
              barras.
            </p>
          </div>
        </div>
      )}

      {isMultiSchemaBatch ? (
        <div className="border-border bg-card space-y-2 border p-5 text-xs">
          <p className="text-foreground font-medium">
            Lote multi-fuente unificado automáticamente
          </p>
          <p className="text-muted-foreground">
            Las columnas de todos los archivos/pestañas se normalizaron a un
            esquema común. Continúa para validar stock y coincidencias contra el
            almacén.
          </p>
        </div>
      ) : (
        <>
          {unmapped.length > 0 && (
            <div className="border-status-warning-fg/30 bg-status-warning-bg text-status-warning-fg flex items-start gap-2 border px-4 py-3 text-xs">
              <Icons.Info className="mt-0.5 size-4 shrink-0" />
              <div>
                <p className="font-medium">
                  Columnas adicionales ignoradas ({unmapped.length}):
                </p>
                <p>{unmapped.join(", ")}</p>
              </div>
            </div>
          )}

          <div className="border-border bg-card overflow-hidden border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-border bg-muted/50 border-b text-left">
                  <th className="text-muted-foreground px-4 py-3 font-medium">
                    #
                  </th>
                  <th className="text-muted-foreground px-4 py-3 font-medium">
                    Encabezado Detectado
                  </th>
                  <th className="text-muted-foreground px-4 py-3 font-medium">
                    Campo Asignado
                  </th>
                  <th className="text-muted-foreground px-4 py-3 text-center font-medium">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody>
                {headers.map((header, i) => {
                  const mappedField = reverseMap.get(i) ?? "";
                  const isPrimary =
                    mappedField === "sku" ||
                    mappedField === "bultos" ||
                    mappedField === "quantity" ||
                    mappedField === "producto";

                  return (
                    <tr
                      key={i}
                      className="border-border hover:bg-muted/30 border-b transition-colors"
                    >
                      <td className="text-muted-foreground px-4 py-3 font-mono text-xs">
                        {i + 1}
                      </td>
                      <td className="text-foreground px-4 py-3 font-medium">
                        {header || `(Columna ${i + 1})`}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={mappedField}
                          onChange={(e) => handleFieldChange(i, e.target.value)}
                          className="border-border bg-card focus:border-primary w-full border px-3 py-1.5 text-xs outline-none"
                        >
                          {FIELD_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {mappedField ? (
                          <StatusPill tone={isPrimary ? "success" : "info"}>
                            {isPrimary ? "Principal" : "Opcional"}
                          </StatusPill>
                        ) : (
                          <span className="text-muted-foreground text-xs">
                            Ignorado
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Confirm button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onConfirm}
          disabled={!canConfirm || isResolvingSemantic}
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center gap-2 px-4 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isResolvingSemantic ? (
            <>
              <div className="border-primary-foreground size-3.5 animate-spin border-2 border-t-transparent" />
              Resolviendo SKUs con IA...
            </>
          ) : (
            <>
              <Icons.CheckCircle className="size-4.5" />
              Confirmar Mapeo
            </>
          )}
        </button>
      </div>
    </div>
  );
}
