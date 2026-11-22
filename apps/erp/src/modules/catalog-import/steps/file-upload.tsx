"use client";

/**
 * Cendaro — Catalog Import: Step 1 — Multi-File Zero-Template Upload
 *
 * Accepts 1..N files simultaneously (`.xlsx` multi-sheet, `.xls`, `.csv`, `.pdf`)
 * with automatic header fingerprinting, Gemini Free-Tier schema inference, and
 * optional official Excel template download as a secondary fast-path.
 */
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import { Icons } from "@cendaro/ui/icons";
import { StatusPill } from "@cendaro/ui/status-pill";

import { downloadProductTemplate } from "../lib/catalog-template-builder";
import { ACCEPTED_EXTENSIONS } from "../lib/catalog-validators";

interface FileUploadProps {
  onFilesSelect: (files: File[], supplierId?: string | null) => void;
  isParsing: boolean;
  error: string | null;
  brands?: { id: string; name: string }[];
  categories?: { id: string; name: string }[];
  suppliers?: { id: string; name: string }[];
}

export function FileUpload({
  onFilesSelect,
  isParsing,
  error,
  brands = [],
  categories = [],
  suppliers = [],
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const dropped = Array.from(e.dataTransfer.files);
      if (dropped.length > 0) {
        onFilesSelect(dropped, selectedSupplierId || null);
      }
    },
    [onFilesSelect, selectedSupplierId],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const chosen = e.target.files ? Array.from(e.target.files) : [];
      if (chosen.length > 0) {
        onFilesSelect(chosen, selectedSupplierId || null);
      }
      e.target.value = "";
    },
    [onFilesSelect, selectedSupplierId],
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
      {/* Zero-Template AI + Optional Supplier Profile Selector */}
      <div className="border-border bg-card space-y-4 border p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-muted text-foreground border-border flex size-10 shrink-0 items-center justify-center border">
              <Icons.SmartToy className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-foreground text-sm font-medium">
                  Ingesta Inteligente Sin Plantilla Rígida
                </p>
                <StatusPill tone="info">Multi-Archivo + IA</StatusPill>
              </div>
              <p className="text-muted-foreground text-xs">
                Sube listas de precios de proveedores en cualquier orden de
                columnas, múltiples pestañas o PDFs (ES / EN / ZH)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDownloadTemplate}
            disabled={isDownloading}
            className="border-border bg-background text-foreground hover:bg-muted flex h-9 shrink-0 items-center gap-2 border px-3.5 text-xs font-medium transition-colors disabled:opacity-60"
          >
            {isDownloading ? (
              <>
                <div className="border-foreground size-3.5 animate-spin border-2 border-t-transparent" />
                Generando…
              </>
            ) : (
              <>
                <Icons.Download className="size-3.5" />
                Plantilla estándar (opcional)
              </>
            )}
          </button>
        </div>

        {suppliers.length > 0 && (
          <div className="border-border flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
            <label
              htmlFor="catalog-import-supplier-select"
              className="text-muted-foreground text-xs"
            >
              Proveedor asociado (opcional — recuerda su formato para próximas
              cargas en 0 ms):
            </label>
            <select
              id="catalog-import-supplier-select"
              value={selectedSupplierId}
              onChange={(e) => setSelectedSupplierId(e.target.value)}
              disabled={isParsing}
              className="border-border bg-background text-foreground focus:border-foreground/50 h-8 border px-2.5 text-xs outline-none sm:w-64"
            >
              <option value="">— Detectar automáticamente —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Multi-file Drop zone */}
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
        } ${isParsing ? "pointer-events-none opacity-70" : ""}`}
      >
        <input
          ref={inputRef}
          id="catalog-file-upload-input"
          name="catalog-files"
          type="file"
          multiple
          accept={ACCEPTED_EXTENSIONS.join(",")}
          onChange={handleChange}
          aria-label="Subir archivos del catálogo"
          className="hidden"
          disabled={isParsing}
        />

        <div className="flex flex-col items-center gap-4">
          {isParsing ? (
            <>
              <div className="border-primary size-10 animate-spin border-2 border-t-transparent" />
              <div>
                <p className="text-foreground text-base font-medium">
                  Analizando archivos y mapeando columnas...
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  Verificando huellas guardadas e inferencia estructural segura
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="bg-muted text-muted-foreground border-border flex size-12 items-center justify-center border">
                <Icons.UploadFile className="size-6" />
              </div>
              <div>
                <p className="text-foreground text-base font-medium">
                  Arrastra uno o varios archivos aquí
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  o haz clic para seleccionar — .xlsx (multi-pestaña), .xls,
                  .csv o .pdf (hasta 12 archivos)
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="border-destructive/30 bg-destructive/10 text-destructive flex items-center gap-2 border px-4 py-3 text-xs">
          <Icons.Error className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Capabilities summary */}
      <div className="border-border bg-card border p-4">
        <h3 className="text-foreground mb-2 text-sm font-medium">
          ¿Cómo funciona la ingesta flexible?
        </h3>
        <ul className="text-muted-foreground space-y-1.5 text-xs">
          <li className="flex items-center gap-2">
            <Icons.CheckCircle className="text-status-success-fg size-3.5 shrink-0" />
            <span>
              Solo necesitas que exista{" "}
              <span className="text-foreground font-medium">
                Nombre / Descripción
              </span>
              ; si el archivo no trae SKU, se sugiere un código editable.
            </span>
          </li>
          <li className="flex items-center gap-2">
            <Icons.Bolt className="text-status-info-fg size-3.5 shrink-0" />
            <span>
              Cruza cada producto contra tu catálogo actual por similitud
              semántica RAG (ES / EN / ZH) para evitar duplicados.
            </span>
          </li>
          <li className="flex items-center gap-2">
            <Icons.History className="text-status-warning-fg size-3.5 shrink-0" />
            <span>
              Al confirmar la importación, Cendaro memoriza la huella de
              columnas de tu proveedor para futuras cargas instantáneas.
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
