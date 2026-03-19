"use client";

/**
 * Cendaro — Catalog Import: Step 2 — Header Mapping
 *
 * Let users review + edit the auto-detected column mappings.
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
  const allFields: CatalogImportField[] = [
    ...REQUIRED_CATALOG_FIELDS,
    ...OPTIONAL_CATALOG_FIELDS,
  ];

  const missingRequired = REQUIRED_CATALOG_FIELDS.filter(
    (f) => !(f in headerMap),
  );

  const handleFieldChange = (
    field: CatalogImportField,
    colIndex: number | null,
  ) => {
    const updated = { ...headerMap };
    if (colIndex === null) {
      delete updated[field];
    } else {
      updated[field] = colIndex;
    }
    onUpdateMap(updated);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Sheet info */}
      <div className="bg-muted/30 flex items-center justify-between rounded-xl px-4 py-3">
        <div className="text-sm">
          <span className="text-muted-foreground">Hoja: </span>
          <span className="text-foreground font-semibold">{sheetName}</span>
        </div>
        <div className="text-sm">
          <span className="text-muted-foreground">Filas de datos: </span>
          <span className="text-foreground font-semibold">{totalRows - 1}</span>
        </div>
      </div>

      {/* Mapping table */}
      <div className="divide-border divide-y rounded-xl border">
        <div className="bg-muted/50 grid grid-cols-3 gap-4 rounded-t-xl px-4 py-3 text-xs font-semibold tracking-wider uppercase">
          <span>Campo</span>
          <span>Columna detectada</span>
          <span>Ejemplo</span>
        </div>

        {allFields.map((field) => {
          const isRequired = REQUIRED_CATALOG_FIELDS.includes(field);
          const colIndex = headerMap[field] ?? null;

          return (
            <div
              key={field}
              className="hover:bg-muted/20 grid grid-cols-3 items-center gap-4 px-4 py-3 transition-colors"
            >
              {/* Field label */}
              <div className="flex items-center gap-2">
                <span className="text-foreground text-sm font-medium">
                  {FIELD_LABELS[field]}
                </span>
                {isRequired && (
                  <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600 dark:bg-red-900/30 dark:text-red-400">
                    REQUERIDO
                  </span>
                )}
              </div>

              {/* Column dropdown */}
              <select
                value={colIndex ?? ""}
                onChange={(e) => {
                  const val = e.target.value;
                  handleFieldChange(
                    field,
                    val === "" ? null : parseInt(val, 10),
                  );
                }}
                className={`border-border bg-background text-foreground focus:ring-primary/30 w-full rounded-lg border px-3 py-2 text-sm transition-colors focus:ring-2 focus:outline-none ${
                  isRequired && colIndex === null
                    ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-900/10"
                    : ""
                }`}
              >
                <option value="">— Sin asignar —</option>
                {headers.map((header, idx) => (
                  <option key={idx} value={idx}>
                    {header}
                  </option>
                ))}
              </select>

              {/* Preview value */}
              <span className="text-muted-foreground truncate text-sm">
                {colIndex !== null ? `Col ${colIndex + 1}` : "—"}
              </span>
            </div>
          );
        })}
      </div>

      {/* Unmapped columns */}
      {unmapped.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-900/20">
          <p className="mb-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
            Columnas no reconocidas ({unmapped.length})
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-500">
            {unmapped.join(", ")}
          </p>
        </div>
      )}

      {/* Required fields warning */}
      {missingRequired.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400">
          <span className="material-symbols-outlined text-lg">error</span>
          Faltan columnas obligatorias:{" "}
          {missingRequired.map((f) => FIELD_LABELS[f]).join(", ")}
        </div>
      )}

      {/* Confirm button */}
      <div className="flex justify-end">
        <button
          onClick={onConfirm}
          disabled={missingRequired.length > 0}
          className="bg-primary hover:bg-primary/90 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white transition-all hover:shadow-lg active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-lg">
            check_circle
          </span>
          Validar datos
        </button>
      </div>
    </div>
  );
}
