"use client";

/**
 * Cendaro — Catalog Import: Step 2 — Header Mapping
 *
 * Auto-detected + manual override column mapping.
 * Design: matches inventory-import header mapping table layout.
 *
 * PRD: FEATURE_PRD_CATALOG_IMPORT.md §11
 */
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
        <h2 className="text-foreground text-xl font-bold">Mapeo de Columnas</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Hoja: <span className="font-medium">{sheetName}</span> —{" "}
          {(totalRows - 1).toLocaleString()} filas detectadas
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
            <p>{missingRequired.map((f) => FIELD_LABELS[f]).join(", ")}</p>
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

      {/* Mapping table — matches inventory wizard layout */}
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
              const isRequired = REQUIRED_CATALOG_FIELDS.includes(
                mappedField as CatalogImportField,
              );

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
          className="bg-primary hover:bg-primary/90 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white transition-all hover:shadow-lg active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
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
