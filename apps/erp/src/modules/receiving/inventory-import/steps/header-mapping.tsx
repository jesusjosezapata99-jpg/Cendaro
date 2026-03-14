"use client";

/**
 * Step 3 — Header Mapping
 *
 * Auto-detected + manual override column mapping.
 * PRD: FEATURE_PRD_INVENTORY_IMPORT.md §15, §20 (HeaderAnalysis)
 */
import type { ImportField } from "../lib/inventory-header-aliases";
import { REQUIRED_IMPORT_FIELDS } from "../lib/inventory-header-aliases";

interface HeaderMappingProps {
  headers: string[];
  headerMap: Record<string, number>;
  unmapped: string[];
  sheetName: string;
  totalRows: number;
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
  onUpdateMap,
  onConfirm,
}: HeaderMappingProps) {
  // Build reverse map: column index → field name
  const reverseMap = new Map<number, string>();
  for (const [field, index] of Object.entries(headerMap)) {
    reverseMap.set(index, field);
  }

  const missingRequired = REQUIRED_IMPORT_FIELDS.filter(
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
      <div className="text-center">
        <h2 className="text-foreground text-xl font-bold">Mapeo de Columnas</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Hoja: <span className="font-medium">{sheetName}</span> —{" "}
          {totalRows.toLocaleString()} filas detectadas
        </p>
      </div>

      {/* Missing required columns warning */}
      {missingRequired.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400">
          <span className="material-symbols-outlined mt-0.5 text-lg">
            error
          </span>
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
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-400">
          <span className="material-symbols-outlined mt-0.5 text-lg">info</span>
          <div>
            <p className="font-medium">
              Columnas no reconocidas (serán ignoradas):
            </p>
            <p>{unmapped.join(", ")}</p>
          </div>
        </div>
      )}

      {/* Mapping table */}
      <div className="border-border bg-card overflow-hidden rounded-xl border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-border bg-muted/50 border-b text-left">
              <th className="text-muted-foreground px-4 py-3 font-semibold">
                #
              </th>
              <th className="text-muted-foreground px-4 py-3 font-semibold">
                Encabezado Detectado
              </th>
              <th className="text-muted-foreground px-4 py-3 font-semibold">
                Campo Asignado
              </th>
              <th className="text-muted-foreground px-4 py-3 text-center font-semibold">
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
                      className="border-border bg-card focus:border-primary w-full rounded-lg border px-3 py-1.5 text-sm outline-none"
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
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                          isRequired
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                        }`}
                      >
                        <span className="material-symbols-outlined text-xs">
                          check
                        </span>
                        {isRequired ? "Requerido" : "Opcional"}
                      </span>
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
          className="bg-primary hover:bg-primary/90 inline-flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-lg">
            check_circle
          </span>
          Confirmar Mapeo
        </button>
      </div>
    </div>
  );
}
