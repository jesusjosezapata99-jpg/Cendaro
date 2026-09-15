"use client";

/**
 * Cendaro — Catalog Import: Step 1 — File Upload
 *
 * Drag & drop file upload with format validation + professional template download.
 *
 * PRD: FEATURE_PRD_CATALOG_IMPORT.md §11
 */
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import { Icons } from "@cendaro/ui/icons";

import { downloadProductTemplate } from "../lib/catalog-template-builder";
import { ACCEPTED_EXTENSIONS } from "../lib/catalog-validators";

// ── Component ────────────────────────────────────

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  isParsing: boolean;
  error: string | null;
  /** Existing brands for template reference sheet */
  brands?: { id: string; name: string }[];
  /** Existing categories for template reference sheet */
  categories?: { id: string; name: string }[];
  /** Existing suppliers for template reference sheet */
  suppliers?: { id: string; name: string }[];
}

export function FileUpload({
  onFileSelect,
  isParsing,
  error,
  brands = [],
  categories = [],
  suppliers = [],
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

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

  const handleDownloadTemplate = useCallback(() => {
    setIsDownloading(true);
    try {
      downloadProductTemplate(brands, categories, suppliers);
      toast.success("Plantilla descargada correctamente");
    } catch {
      toast.error("Error al generar la plantilla");
    } finally {
      setIsDownloading(false);
    }
  }, [brands, categories, suppliers]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Template download — prominent CTA */}
      <div className="border-border bg-card flex items-center justify-between gap-4 border p-5">
        <div className="flex items-center gap-3">
          <div className="bg-muted text-foreground border-border flex size-10 shrink-0 items-center justify-center border">
            <Icons.Description className="size-5" />
          </div>
          <div>
            <p className="text-foreground text-sm font-medium">
              ¿Primera vez importando?
            </p>
            <p className="text-muted-foreground text-xs">
              Descarga la plantilla oficial con instrucciones, reglas y valores
              válidos
            </p>
          </div>
        </div>
        <button
          onClick={handleDownloadTemplate}
          disabled={isDownloading}
          className="bg-primary text-primary-foreground hover:bg-primary/90 flex h-9 shrink-0 items-center gap-2 px-4 text-xs font-medium transition-colors disabled:opacity-60"
        >
          {isDownloading ? (
            <>
              <div className="size-3.5 animate-spin border-2 border-white border-t-transparent" />
              Generando…
            </>
          ) : (
            <>
              <Icons.Download className="size-3.5" />
              Descargar Plantilla
            </>
          )}
        </button>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative cursor-pointer border border-dashed p-12 text-center transition-colors ${
          isDragging
            ? "border-primary bg-primary/5"
            : "border-border bg-card hover:border-foreground/40"
        }`}
      >
        <input
          ref={inputRef}
          id="catalog-file-upload-input"
          name="catalog-file"
          type="file"
          accept={ACCEPTED_EXTENSIONS.join(",")}
          onChange={handleChange}
          aria-label="Subir archivo del catálogo"
          className="hidden"
        />

        <div className="flex flex-col items-center gap-4">
          {isParsing ? (
            <>
              <div className="border-primary size-10 animate-spin border-2 border-t-transparent" />
              <p className="text-foreground text-base font-medium">
                Procesando archivo...
              </p>
            </>
          ) : (
            <>
              <div className="bg-muted text-muted-foreground border-border flex size-12 items-center justify-center border">
                <Icons.UploadFile className="size-6" />
              </div>
              <div>
                <p className="text-foreground text-base font-medium">
                  Arrastra tu archivo aquí
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  o haz clic para seleccionar — .xlsx, .xls, .csv (máx. 10 MB)
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="border-destructive/30 bg-destructive/10 text-destructive flex items-center gap-2 border px-4 py-3 text-xs">
          <Icons.Error className="size-4" />
          {error}
        </div>
      )}

      {/* Format info */}
      <div className="border-border bg-card border p-4">
        <h3 className="text-foreground mb-2 text-sm font-medium">
          Formato esperado
        </h3>
        <ul className="text-muted-foreground space-y-1 text-xs">
          <li className="flex items-center gap-2">
            <Icons.CheckCircle className="size-3.5 text-emerald-500" />
            Columnas obligatorias: <strong>SKU/Referencia</strong> y{" "}
            <strong>Nombre</strong>
          </li>
          <li className="flex items-center gap-2">
            <Icons.Info className="size-3.5 text-blue-500" />
            Opcionales: Categoría, Marca, Costo, Cantidad, Código de barras
          </li>
          <li className="flex items-center gap-2">
            <Icons.Lightbulb className="size-3.5 text-amber-500" />
            Se aceptan encabezados en español, inglés o chino
          </li>
        </ul>
      </div>
    </div>
  );
}
