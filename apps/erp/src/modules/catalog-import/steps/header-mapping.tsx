"use client";

/**
 * Cendaro — Catalog Import: Step 2 — Header Mapping
 *
 * Auto-detected + manual override column mapping.
 * Design: matches inventory-import header mapping table layout.
 *
 * PRD: FEATURE_PRD_CATALOG_IMPORT.md §11
 */
import { Icons } from "@cendaro/ui/icons";
import { StatusPill } from "@cendaro/ui/status-pill";

import type { CatalogImportField } from "../lib/catalog-header-aliases";
import {
  OPTIONAL_CATALOG_FIELDS,
  REQUIRED_CATALOG_FIELDS,
} from "../lib/catalog-header-aliases";

// ── Field labels (Spanish) ──────────────────────

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

// ── Component ────────────────────────────────────

interface HeaderMappingProps {
  headers: string[];
  headerMap: Record<string, number>;
  unmapped: string[];
  sheetName: string;
  totalRows: number;
  onUpdateMap: (map: Record<string, number>) => void;
  onConfirm: () => void;
}

export function HeaderMapping({
  headers,
  headerMap,
  unmapped,
  sheetName,
  totalRows,
  onUpdateMap,
  onConfirm,
}: HeaderMappingProps) {
  // Build reverse map: column index → field name
  const reverseMap = new Map<number, string>();
  for (const [field, index] of Object.entries(headerMap)) {
    reverseMap.set(index, field);
  }

  const missingRequired = REQUIRED_CATALOG_FIELDS.filter(
    (f) => !(f in headerMap),
  );
  const canConfirm = missingRequired.length === 0;

  const handleFieldChange = (colIndex: number, newField: string) => {
    const updated = { ...headerMap };

    // Remove any existing mapping for this column
    for (const key of Object.keys(updated)) {
      if (updated[key] === colIndex) {
        delete updated[key];
      }
    }

    // Set new mapping
    if (newField) {
      // Remove old mapping for this field (if mapped to another column)
      delete updated[newField];
      updated[newField] = colIndex;
    }

    onUpdateMap(updated);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Title + subtitle */}
      <div className="text-center">
        <h2 className="text-foreground text-xl font-medium">
          Mapeo de Columnas
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Hoja: <span className="font-medium">{sheetName}</span> —{" "}
          {(totalRows - 1).toLocaleString()} filas detectadas
        </p>
      </div>

      {/* Missing required columns warning */}
      {missingRequired.length > 0 && (
        <div className="border-destructive/30 bg-destructive/10 text-destructive flex items-start gap-2 border px-4 py-3 text-xs">
          <Icons.Error className="mt-0.5 size-4" />
          <div>
            <p className="font-medium">Columnas requeridas no encontradas:</p>
            <p>{missingRequired.map((f) => FIELD_LABELS[f]).join(", ")}</p>
          </div>
        </div>
      )}

      {/* Unmapped columns info */}
      {unmapped.length > 0 && (
        <div className="border-warning/30 bg-warning/10 text-warning flex items-start gap-2 border px-4 py-3 text-xs">
          <Icons.Info className="mt-0.5 size-4" />
          <div>
            <p className="font-medium">
              Columnas no reconocidas (serán ignoradas):
            </p>
            <p>{unmapped.join(", ")}</p>
          </div>
        </div>
      )}

      {/* Mapping table — matches inventory wizard layout */}
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
              const isRequired = REQUIRED_CATALOG_FIELDS.includes(
                mappedField as CatalogImportField,
              );

              return (
                <tr
                  key={i}
                  className="hover:bg-muted/30 h-11.25 transition-colors"
                >
                  <td className="text-muted-foreground px-4 py-2.5 font-mono text-xs">
                    {i + 1}
                  </td>
                  <td className="text-foreground px-4 py-2.5 font-medium">
                    {header}
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
                      <StatusPill tone={isRequired ? "success" : "info"}>
                        {isRequired ? "Requerido" : "Opcional"}
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

      {/* Confirm button */}
      <div className="flex justify-end">
        <button
          onClick={onConfirm}
          disabled={!canConfirm}
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center gap-2 px-4 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Icons.CheckCircle className="size-4" />
          Confirmar Mapeo
        </button>
      </div>
    </div>
  );
}
