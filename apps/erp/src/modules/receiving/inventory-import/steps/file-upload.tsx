"use client";

/**
 * Step 2 — File Upload
 *
 * Drag-and-drop upload zone with file validation.
 * PRD: FEATURE_PRD_INVENTORY_IMPORT.md §15, §20 (FileSelected → Parsing)
 */
import { useCallback, useRef } from "react";

import type { ImportMode } from "@cendaro/api";

import {
  ACCEPTED_EXTENSIONS,
  ACCEPTED_MIME_TYPES,
} from "../lib/inventory-validators";

interface FileUploadProps {
  mode: ImportMode;
  onFileSelect: (file: File) => void;
  isParsing: boolean;
  error: string | null;
  onDownloadTemplate: () => void;
}

export function FileUpload({
  mode,
  onFileSelect,
  isParsing,
  error,
  onDownloadTemplate,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const file = e.dataTransfer.files[0];
      if (file) onFileSelect(file);
    },
    [onFileSelect],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onFileSelect(file);
    },
    [onFileSelect],
  );

  const acceptStr = [...ACCEPTED_MIME_TYPES, ...ACCEPTED_EXTENSIONS].join(",");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="text-center">
        <h2 className="text-foreground text-xl font-bold">
          Cargar Archivo de Inventario
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Modo:{" "}
          <span className="text-foreground font-semibold">
            {mode === "replace" ? "Reemplazar" : "Ajustar"}
          </span>
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => inputRef.current?.click()}
        className={`border-border bg-card hover:border-primary/40 group flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 text-center transition-colors ${
          isParsing ? "pointer-events-none opacity-60" : ""
        }`}
      >
        {isParsing ? (
          <>
            <div className="border-primary size-10 animate-spin rounded-full border-4 border-t-transparent" />
            <p className="text-muted-foreground mt-4 text-sm font-medium">
              Analizando archivo...
            </p>
          </>
        ) : (
          <>
            <span className="material-symbols-outlined text-muted-foreground group-hover:text-primary text-5xl transition-colors">
              upload_file
            </span>
            <p className="text-foreground mt-4 font-medium">
              Arrastra un archivo aquí o haz clic para seleccionar
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              Formatos aceptados: .xlsx, .xls, .csv — Máximo 10 MB, 10,000 filas
            </p>
          </>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={acceptStr}
          onChange={handleChange}
          className="hidden"
          disabled={isParsing}
        />
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400">
          <span className="material-symbols-outlined text-lg">error</span>
          {error}
        </div>
      )}

      {/* Template download */}
      <div className="text-center">
        <button
          onClick={onDownloadTemplate}
          className="text-primary hover:text-primary/80 inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
        >
          <span className="material-symbols-outlined text-lg">download</span>
          Descargar plantilla de ejemplo
        </button>
      </div>
    </div>
  );
}
