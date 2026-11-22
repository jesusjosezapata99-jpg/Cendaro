"use client";

/**
 * Cendaro — Catalog Import: Step 2 — Header Mapping (Zero-Template Ready)
 *
 * Auto-detected + AI-inferred + manual override column mapping.
 * Supports files without an explicit SKU column (auto-generating editable SKUs).
 */
import { Icons } from "@cendaro/ui/icons";
import { StatusPill } from "@cendaro/ui/status-pill";

import type { CatalogAiSummary } from "../hooks/use-parse-catalog-file";
import type { CatalogImportField } from "../lib/catalog-header-aliases";
import {
  OPTIONAL_CATALOG_FIELDS,
  REQUIRED_CATALOG_FIELDS,
} from "../lib/catalog-header-aliases";

const FIELD_LABELS: Record<CatalogImportField, string> = {
  sku: "SKU / Referencia",
  name: "Nombre",
  category: "Categoría",
  brand: "Marca",
  cost: "Costo",
  quantity: "Cantidad",
  barcode: "Código de barras",
  weight: "Peso",
  volume: "Volumen",
  description: "Descripción",
};

const FIELD_OPTIONS: { value: CatalogImportField | ""; label: string }[] = [
  { value: "", label: "— Ignorar —" },
  ...(
    [
      ...REQUIRED_CATALOG_FIELDS,
      ...OPTIONAL_CATALOG_FIELDS,
    ] as CatalogImportField[]
  ).map((f) => ({ value: f, label: FIELD_LABELS[f] })),
];

interface HeaderMappingProps {
  headers: string[];
  headerMap: Record<string, number>;
  unmapped: string[];
  sheetName: string;
  totalRows: number;
  aiSummary?: CatalogAiSummary;
  isMultiSchemaBatch?: boolean;
  isMatchingSemantic?: boolean;
  onUpdateMap: (map: Record<string, number>) => void;
  onConfirm: () => void;
}

export function HeaderMapping({
  headers,
  headerMap,
  unmapped,
  sheetName,
  totalRows,
  aiSummary,
  isMultiSchemaBatch = false,
  isMatchingSemantic = false,
  onUpdateMap,
  onConfirm,
}: HeaderMappingProps) {
  const reverseMap = new Map<number, string>();
  for (const [field, index] of Object.entries(headerMap)) {
    reverseMap.set(index, field);
  }

  const missingName = !("name" in headerMap);
  const missingSku = !("sku" in headerMap);
  const canConfirm = isMultiSchemaBatch || !missingName;

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
              Detección estructural completada:
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

      {/* Missing Name blocking error */}
      {!isMultiSchemaBatch && missingName && (
        <div className="border-destructive/30 bg-destructive/10 text-destructive flex items-start gap-2 border px-4 py-3 text-xs">
          <Icons.Error className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">Columna requerida no asignada:</p>
            <p>Selecciona cuál columna corresponde a Nombre del producto.</p>
          </div>
        </div>
      )}

      {/* Missing SKU non-blocking notice */}
      {!isMultiSchemaBatch && !missingName && missingSku && (
        <div className="border-status-warning-fg/30 bg-status-warning-bg text-status-warning-fg flex items-start gap-2 border px-4 py-3 text-xs">
          <Icons.Warning className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">
              Archivo sin columna de SKU explícita (permitido):
            </p>
            <p>
              Cendaro generará códigos SKU deterministas sugeridos (editables en
              el siguiente paso) y buscará coincidencias semánticas en tu
              catálogo.
            </p>
          </div>
        </div>
      )}

      {/* Multi-schema / PDF pre-compiled notice */}
      {isMultiSchemaBatch ? (
        <div className="border-border bg-card space-y-2 border p-5 text-xs">
          <p className="text-foreground font-medium">
            Lote multi-fuente compilado automáticamente
          </p>
          <p className="text-muted-foreground">
            Cada archivo o pestaña fue normalizado individualmente según su
            propia estructura de columnas. Continúa a Validación para revisar
            SKUs, costos y posibles duplicados semánticos fila por fila.
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
            <table className="w-full text-xs">
              <thead>
                <tr className="border-border bg-muted/40 h-11.25 border-b text-left">
                  <th className="text-muted-foreground px-4 py-2.5 font-medium">
                    #
                  </th>
                  <th className="text-muted-foreground px-4 py-2.5 font-medium">
                    Encabezado Detectado
                  </th>
                  <th className="text-muted-foreground px-4 py-2.5 font-medium">
                    Campo Asignado
                  </th>
                  <th className="text-muted-foreground px-4 py-2.5 text-center font-medium">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {headers.map((header, i) => {
                  const mappedField = reverseMap.get(i) ?? "";
                  const isName = mappedField === "name";
                  const isSku = mappedField === "sku";

                  return (
                    <tr
                      key={i}
                      className="hover:bg-muted/30 h-11.25 transition-colors"
                    >
                      <td className="text-muted-foreground px-4 py-2.5 font-mono text-xs">
                        {i + 1}
                      </td>
                      <td className="text-foreground px-4 py-2.5 font-medium">
                        {header || `(Columna ${i + 1})`}
                      </td>
                      <td className="px-4 py-2.5">
                        <select
                          value={mappedField}
                          onChange={(e) => handleFieldChange(i, e.target.value)}
                          className="border-border bg-background focus:border-foreground/50 w-full border px-2.5 py-1 text-xs outline-none"
                        >
                          {FIELD_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {mappedField ? (
                          <StatusPill
                            tone={isName || isSku ? "success" : "info"}
                          >
                            {isName
                              ? "Requerido"
                              : isSku
                                ? "Clave SKU"
                                : "Opcional"}
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

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onConfirm}
          disabled={!canConfirm || isMatchingSemantic}
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center gap-2 px-4 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isMatchingSemantic ? (
            <>
              <div className="border-primary-foreground size-3.5 animate-spin border-2 border-t-transparent" />
              Cruzando con catálogo RAG...
            </>
          ) : (
            <>
              <Icons.CheckCircle className="size-4" />
              Confirmar Mapeo
            </>
          )}
        </button>
      </div>
    </div>
  );
}
