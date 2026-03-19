"use client";

/**
 * Cendaro — Catalog Import: Step 1 — File Upload
 *
 * Drag & drop file upload with format validation.
 *
 * PRD: FEATURE_PRD_CATALOG_IMPORT.md §11
 */
import { useCallback, useRef, useState } from "react";

import { ACCEPTED_EXTENSIONS } from "../lib/catalog-validators";

// ── Component ────────────────────────────────────

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  isParsing: boolean;
  error: string | null;
}

export function FileUpload({
  onFileSelect,
  isParsing,
  error,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) onFileSelect(file);
    },
    [onFileSelect],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onFileSelect(file);
    },
    [onFileSelect],
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-12 text-center transition-all ${
          isDragging
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-border hover:border-primary/50 hover:bg-muted/30"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS.join(",")}
          onChange={handleChange}
          className="hidden"
        />

        <div className="flex flex-col items-center gap-4">
          {isParsing ? (
            <>
              <div className="border-primary h-12 w-12 animate-spin rounded-full border-4 border-t-transparent" />
              <p className="text-foreground text-lg font-semibold">
                Procesando archivo...
              </p>
            </>
          ) : (
            <>
              <div className="bg-primary/10 text-primary flex h-16 w-16 items-center justify-center rounded-2xl">
                <span className="material-symbols-outlined text-3xl">
                  upload_file
                </span>
              </div>
              <div>
                <p className="text-foreground text-lg font-semibold">
                  Arrastra tu archivo aquí
                </p>
                <p className="text-muted-foreground mt-1 text-sm">
                  o haz clic para seleccionar — .xlsx, .xls, .csv (máx. 10 MB)
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400">
          <span className="material-symbols-outlined text-lg">error</span>
          {error}
        </div>
      )}

      {/* Format info */}
      <div className="bg-muted/30 rounded-xl p-4">
        <h3 className="text-foreground mb-2 text-sm font-semibold">
          Formato esperado
        </h3>
        <ul className="text-muted-foreground space-y-1 text-xs">
          <li className="flex items-center gap-2">
            <span className="material-symbols-outlined text-sm text-emerald-500">
              check_circle
            </span>
            Columnas obligatorias: <strong>SKU/Referencia</strong> y{" "}
            <strong>Nombre</strong>
          </li>
          <li className="flex items-center gap-2">
            <span className="material-symbols-outlined text-sm text-blue-500">
              info
            </span>
            Opcionales: Categoría, Marca, Costo, Cantidad, Código de barras
          </li>
          <li className="flex items-center gap-2">
            <span className="material-symbols-outlined text-sm text-amber-500">
              lightbulb
            </span>
            Se aceptan encabezados en español, inglés o chino
          </li>
        </ul>
      </div>
    </div>
  );
}
