"use client";

/**
 * Step 2 — Multi-File Zero-Template Inventory Upload
 *
 * Accepts 1..N files simultaneously (`.xlsx` multi-sheet, `.xls`, `.csv`, `.pdf`)
 * with automatic header fingerprinting, Gemini Free-Tier schema inference, and
 * optional official template download.
 */
import { useCallback, useRef } from "react";

import type { ImportMode } from "@cendaro/api";
import { Icons } from "@cendaro/ui/icons";
import { StatusPill } from "@cendaro/ui/status-pill";

import {
  ACCEPTED_EXTENSIONS,
  ACCEPTED_MIME_TYPES,
} from "../lib/inventory-validators";

interface FileUploadProps {
  mode: ImportMode;
  onFilesSelect: (files: File[]) => void;
  isParsing: boolean;
  error: string | null;
  onDownloadTemplate: () => void;
}

const MODE_LABELS: Record<ImportMode, string> = {
  replace: "Reemplazar",
  adjust: "Ajustar",
  initialize: "Inicializar",
};

export function FileUpload({
  mode,
  onFilesSelect,
  isParsing,
  error,
  onDownloadTemplate,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const dropped = Array.from(e.dataTransfer.files);
      if (dropped.length > 0) {
        onFilesSelect(dropped);
      }
    },
    [onFilesSelect],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const chosen = e.target.files ? Array.from(e.target.files) : [];
      if (chosen.length > 0) {
        onFilesSelect(chosen);
      }
      e.target.value = "";
    },
    [onFilesSelect],
  );

  const acceptStr = [...ACCEPTED_MIME_TYPES, ...ACCEPTED_EXTENSIONS].join(",");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center gap-2">
          <h2 className="text-foreground text-xl font-medium">
            Cargar Archivos de Inventario
          </h2>
          <StatusPill tone="info">Multi-Archivo + IA</StatusPill>
        </div>
        <p className="text-muted-foreground mt-1 text-sm">
          Modo:{" "}
          <span className="text-foreground font-medium">
            {MODE_LABELS[mode]}
          </span>{" "}
          — acepta plantillas propias, conteos físicos o PDFs
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => inputRef.current?.click()}
        className={`border-border bg-card hover:border-primary/40 group flex cursor-pointer flex-col items-center justify-center border border-dashed p-12 text-center transition-colors ${
          isParsing ? "pointer-events-none opacity-60" : ""
        }`}
      >
        {isParsing ? (
          <>
            <div className="border-primary size-10 animate-spin border-2 border-t-transparent" />
            <p className="text-foreground mt-4 text-sm font-medium">
              Analizando archivos y detectando estructura...
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              Aplicando huellas de formato e inferencia estructural segura
            </p>
          </>
        ) : (
          <>
            <div className="bg-muted text-muted-foreground border-border group-hover:text-primary flex size-12 items-center justify-center border transition-colors">
              <Icons.UploadFile className="size-6" />
            </div>
            <p className="text-foreground mt-4 font-medium">
              Arrastra uno o varios archivos aquí o haz clic para seleccionar
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              Formatos aceptados: .xlsx (multi-pestaña), .xls, .csv, .pdf —
              hasta 12 archivos / 10,000 filas
            </p>
          </>
        )}

        <input
          ref={inputRef}
          id="inventory-file-upload-input"
          name="inventory-files"
          type="file"
          multiple
          accept={acceptStr}
          onChange={handleChange}
          aria-label="Subir archivos de inventario"
          className="hidden"
          disabled={isParsing}
        />
      </div>

      {/* Error message */}
      {error && (
        <div className="border-destructive/30 bg-destructive/10 text-destructive flex items-center gap-2 border px-4 py-3 text-sm">
          <Icons.Error className="size-4.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Zero-Template capabilities + optional template download */}
      <div className="border-border bg-card flex flex-wrap items-center justify-between gap-3 border p-4 text-xs">
        <div className="text-muted-foreground space-y-0.5">
          <p className="text-foreground font-medium">
            ¿Tu conteo físico no tiene el SKU interno de Cendaro?
          </p>
          <p>
            Puedes subir hojas con Nombre de producto o Código de barras +
            Cantidad o Bultos; el motor RAG resolverá el SKU automáticamente.
          </p>
        </div>
        <button
          type="button"
          onClick={onDownloadTemplate}
          className="border-border bg-background text-foreground hover:bg-muted inline-flex h-8 shrink-0 items-center gap-1.5 border px-3 text-xs font-medium transition-colors"
        >
          <Icons.Download className="size-3.5" />
          Descargar plantilla (opcional)
        </button>
      </div>
    </div>
  );
}
