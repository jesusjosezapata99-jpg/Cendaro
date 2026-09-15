"use client";

/**
 * Step 3 — Header Mapping
 *
 * Auto-detected + manual override column mapping.
 * PRD: FEATURE_PRD_INVENTORY_IMPORT.md §15, §20, §23
 */
import type { ImportMode } from "@cendaro/api";
import { Icons } from "@cendaro/ui/icons";
import { StatusPill } from "@cendaro/ui/status-pill";

import type { ImportField } from "../lib/inventory-header-aliases";
import { getRequiredFieldsForMode } from "../lib/inventory-header-aliases";

interface HeaderMappingProps {
  headers: string[];
  headerMap: Record<string, number>;
  unmapped: string[];
  sheetName: string;
  totalRows: number;
  mode: ImportMode;
  onUpdateMap: (map: Record<string, number>) => void;
  onConfirm: () => void;
}

const FIELD_OPTIONS: { value: ImportField | ""; label: string }[] = [
  { value: "", label: "— Ignorar —" },
  { value: "sku", label: "SKU / Referencia" },
  { value: "bultos", label: "Bultos" },
  { value: "cajasPerBulk", label: "Cajas/Bulto" },
  { value: "presentacion", label: "Presentación" },
  { value: "marca", label: "Marca" },
  { value: "producto", label: "Producto" },
  { value: "unidPerCaja", label: "Unid/Caja" },
  { value: "stockTotal", label: "Stock Total" },
];

export function HeaderMapping({
  headers,
  headerMap,
  unmapped,
  sheetName,
  totalRows,
  mode,
  onUpdateMap,
  onConfirm,
}: HeaderMappingProps) {
  // Build reverse map: column index → field name
  const reverseMap = new Map<number, string>();
  for (const [field, index] of Object.entries(headerMap)) {
    reverseMap.set(index, field);
  }

  const requiredFields = getRequiredFieldsForMode(mode);
  const missingRequired = requiredFields.filter((f) => !(f in headerMap));
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
      <div className="text-center">
        <h2 className="text-foreground text-xl font-medium">
          Mapeo de Columnas
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Hoja: <span className="font-medium">{sheetName}</span> —{" "}
          {totalRows.toLocaleString()} filas detectadas
        </p>
      </div>

      {/* Missing required columns warning */}
      {missingRequired.length > 0 && (
        <div className="border-destructive/30 bg-destructive/10 text-destructive flex items-start gap-2 border px-4 py-3 text-sm">
          <Icons.Error className="mt-0.5 size-4.5" />
          <div>
            <p className="font-medium">Columnas requeridas no encontradas:</p>
            <p>
              {missingRequired
                .map((f) => {
                  const labels: Record<string, string> = {
                    sku: "SKU / Referencia",
                    bultos: "Bultos",
                    cajasPerBulk: "Cajas/Bulto",
                    presentacion: "Presentación",
                  };
                  return labels[f] ?? f;
                })
                .join(", ")}
            </p>
          </div>
        </div>
      )}

      {/* Unmapped columns info */}
      {unmapped.length > 0 && (
        <div className="border-warning/30 bg-warning/10 text-warning flex items-start gap-2 border px-4 py-3 text-sm">
          <Icons.Info className="mt-0.5 size-4.5" />
          <div>
            <p className="font-medium">
              Columnas no reconocidas (serán ignoradas):
            </p>
            <p>{unmapped.join(", ")}</p>
          </div>
        </div>
      )}

      {/* Mapping table */}
      <div className="border-border bg-card overflow-hidden border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-border bg-muted/50 border-b text-left">
              <th className="text-muted-foreground px-4 py-3 font-medium">#</th>
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
              const isRequired =
                mappedField === "sku" || mappedField === "quantity";

              return (
                <tr
                  key={i}
                  className="border-border hover:bg-muted/30 border-b transition-colors"
                >
                  <td className="text-muted-foreground px-4 py-3 font-mono text-xs">
                    {i + 1}
                  </td>
                  <td className="text-foreground px-4 py-3 font-medium">
                    {header}
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
          className="bg-primary hover:bg-primary/90 inline-flex h-9 items-center gap-2 px-4 text-xs font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Icons.CheckCircle className="size-4.5" />
          Confirmar Mapeo
        </button>
      </div>
    </div>
  );
}
