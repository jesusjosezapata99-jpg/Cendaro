"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { CreatableSelect } from "~/components/creatable-select";
import { RoleGuard } from "~/components/role-guard";
import { useVesRates } from "~/hooks/use-bcv-rate";
import { maybeSyncVesRates } from "~/lib/sync-bcv-rate";
import { useTRPC } from "~/trpc/client";

/* ── Reusable form primitives ─────────────────── */

function Field({
  label,
  required,
  children,
  hint,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="text-muted-foreground mb-1 block text-xs font-medium">
        {label} {required && <span className="text-destructive">*</span>}
      </span>
      {children}
      {hint && (
        <span className="text-muted-foreground mt-0.5 block text-[10px]">
          {hint}
        </span>
      )}
    </label>
  );
}

const inputBase =
  "w-full min-h-[44px] rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/20";

/* ── Initial form state ───────────────────────── */

const emptyFields = {
  sku: "",
  name: "",
  barcode: "",
  descriptionShort: "",
  descriptionLong: "",
  imageUrl: "",
  weight: "",
  volume: "",
};

const SELLING_UNIT_OPTIONS = [
  { value: "unit", label: "Unidad" },
  { value: "box", label: "Caja" },
  { value: "dozen", label: "Docena (12)" },
  { value: "half_dozen", label: "Media Docena (6)" },
  { value: "bulk", label: "Bulto" },
] as const;

const defaultStickyFields = {
  brandId: "",
  categoryId: "",
  supplierId: "",
  baseUom: "unit" as string,
  unitsPerBox: "",
  boxesPerBulk: "",
  sellingUnit: "unit" as string,
  status: "draft" as "draft" | "active" | "discontinued",
};

/* ── Component ────────────────────────────────── */

export default function CreateProductPage() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const router = useRouter();

  /* Refs */
  const skuRef = useRef<HTMLInputElement>(null);
  const submitModeRef = useRef<"save" | "save-and-continue">("save");

  /* State */
  const [fields, setFields] = useState(emptyFields);
  const [sticky, setSticky] = useState(defaultStickyFields);
  const [createdCount, setCreatedCount] = useState(0);
  const [priceUsd, setPriceUsd] = useState("");

  /* BCV Rate (read-only — immutable, from DolarAPI) */
  const ves = useVesRates();
  const effectiveRate = ves.oficial.rate;
  const priceBs =
    priceUsd && effectiveRate ? parseFloat(priceUsd) * effectiveRate : 0;

  /* Lookups */
  const { data: brands } = useQuery(trpc.catalog.listBrands.queryOptions());
  const { data: categories } = useQuery(
    trpc.catalog.listCategories.queryOptions(),
  );
  const { data: suppliers } = useQuery(
    trpc.catalog.listSuppliers.queryOptions(),
  );

  /* Auto-sync VES rates to ExchangeRate table */
  const { data: dbRates } = useQuery(trpc.pricing.latestRates.queryOptions());
  const syncRate = useMutation(trpc.pricing.setRate.mutationOptions());
  const syncRateRef = useRef(syncRate);
  syncRateRef.current = syncRate;
  useEffect(() => {
    void maybeSyncVesRates({
      latestRates: dbRates,
      setRate: (input) => syncRateRef.current.mutateAsync(input),
    });
  }, [dbRates]);

  /* Inline-create mutations */
  const createBrand = useMutation(
    trpc.catalog.createBrand.mutationOptions({
      onSuccess: () => void qc.invalidateQueries({ queryKey: [["catalog"]] }),
    }),
  );
  const createCategory = useMutation(
    trpc.catalog.createCategory.mutationOptions({
      onSuccess: () => void qc.invalidateQueries({ queryKey: [["catalog"]] }),
    }),
  );
  const createSupplier = useMutation(
    trpc.catalog.createSupplier.mutationOptions({
      onSuccess: () => void qc.invalidateQueries({ queryKey: [["catalog"]] }),
    }),
  );
  const setPrice = useMutation(trpc.catalog.setPrice.mutationOptions());

  /* Mutation */
  const create = useMutation(
    trpc.catalog.createProduct.mutationOptions({
      onSuccess: async (product) => {
        void qc.invalidateQueries({ queryKey: [["catalog"]] });

        // ── Set price if provided ──
        if (product?.id && priceUsd && parseFloat(priceUsd) > 0) {
          try {
            await setPrice.mutateAsync({
              productId: product.id,
              priceType: "store",
              amountUsd: parseFloat(priceUsd),
              amountBs: priceBs > 0 ? priceBs : undefined,
              rateUsed: effectiveRate > 0 ? effectiveRate : undefined,
            });
          } catch {
            toast.error("Producto creado pero el precio no se pudo guardar");
          }
        }

        if (submitModeRef.current === "save-and-continue") {
          // ── Continuous workflow ──
          setCreatedCount((c) => c + 1);
          toast.success(`✓ ${fields.name || "Producto"} creado correctamente`);

          // Smart reset: clear data fields, keep sticky
          setFields(emptyFields);
          setPriceUsd("");

          // Auto-focus SKU field
          requestAnimationFrame(() => {
            skuRef.current?.focus();
            window.scrollTo({ top: 0, behavior: "smooth" });
          });
        } else {
          // ── Standard save → navigate to detail ──
          toast.success("Producto creado correctamente");
          if (product?.id) {
            router.push(`/catalog/${product.id}`);
          } else {
            router.push("/catalog");
          }
        }
      },
    }),
  );

  /* Helpers */
  const setField = (key: string, value: string) =>
    setFields((prev) => ({ ...prev, [key]: value }));

  const setStickyField = (key: string, value: string) =>
    setSticky((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    create.mutate({
      sku: fields.sku,
      name: fields.name,
      barcode: fields.barcode || undefined,
      descriptionShort: fields.descriptionShort || undefined,
      descriptionLong: fields.descriptionLong || undefined,
      brandId: sticky.brandId || undefined,
      categoryId: sticky.categoryId || undefined,
      supplierId: sticky.supplierId || undefined,
      imageUrl: fields.imageUrl || undefined,
      weight: fields.weight ? parseFloat(fields.weight) : undefined,
      volume: fields.volume ? parseFloat(fields.volume) : undefined,
      baseUom: sticky.baseUom as "unit" | "box" | "bulk" | "pack",
      unitsPerBox: sticky.unitsPerBox
        ? parseInt(sticky.unitsPerBox, 10)
        : undefined,
      boxesPerBulk: sticky.boxesPerBulk
        ? parseInt(sticky.boxesPerBulk, 10)
        : undefined,
      sellingUnit: sticky.sellingUnit as
        | "unit"
        | "box"
        | "dozen"
        | "half_dozen"
        | "bulk",
      status: sticky.status,
    });
  };

  return (
    <RoleGuard
      allow={["owner", "admin", "supervisor"]}
      fallback={
        <div className="flex flex-col items-center justify-center gap-3 py-20">
          <span className="material-symbols-outlined text-muted-foreground text-5xl">
            lock
          </span>
          <p className="text-muted-foreground text-sm">
            No tienes permisos para crear productos.
          </p>
          <Link
            href="/catalog"
            className="text-primary hover:text-primary/80 text-sm font-medium transition-colors"
          >
            Volver al Catálogo
          </Link>
        </div>
      }
    >
      <div className="space-y-6 p-4 lg:p-8">
        {/* Breadcrumb */}
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Link
            href="/catalog"
            className="hover:text-foreground transition-colors"
          >
            Catálogo
          </Link>
          <span className="material-symbols-outlined text-base">
            chevron_right
          </span>
          <span className="text-foreground font-medium">Nuevo Producto</span>
        </div>

        {/* Header */}
        <div className="flex flex-col gap-1">
          <h1 className="text-foreground text-2xl font-black tracking-tight">
            Crear Nuevo Producto
          </h1>
          <p className="text-muted-foreground text-sm">
            Completa los campos para registrar un producto en el catálogo.
          </p>
        </div>

        {/* Session counter */}
        {createdCount > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-50 px-4 py-2.5 dark:bg-emerald-900/20">
            <span className="material-symbols-outlined text-lg text-emerald-600 dark:text-emerald-400">
              check_circle
            </span>
            <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
              {createdCount} producto{createdCount !== 1 ? "s" : ""} creado
              {createdCount !== 1 ? "s" : ""} en esta sesión
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* ── Info Básica ─────────────────────────── */}
          <section className="border-border bg-card rounded-xl border p-6 shadow-sm">
            <h2 className="text-muted-foreground mb-4 text-sm font-bold tracking-widest uppercase">
              Información Básica
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  label="Referencia"
                  required
                  hint="Código único de referencia rápida"
                >
                  <input
                    ref={skuRef}
                    value={fields.sku}
                    onChange={(e) => setField("sku", e.target.value)}
                    placeholder="REF-001"
                    required
                    autoFocus
                    className={inputBase}
                  />
                </Field>
                <Field label="Código de Barras" hint="EAN/UPC">
                  <input
                    value={fields.barcode}
                    onChange={(e) => setField("barcode", e.target.value)}
                    placeholder="7501234567890"
                    className={inputBase}
                  />
                </Field>
              </div>

              <Field label="Nombre del Producto" required>
                <input
                  value={fields.name}
                  onChange={(e) => setField("name", e.target.value)}
                  placeholder="Cable USB-C Premium 1.5m"
                  required
                  className={inputBase}
                />
              </Field>

              <Field label="Descripción Corta">
                <input
                  value={fields.descriptionShort}
                  onChange={(e) => setField("descriptionShort", e.target.value)}
                  placeholder="Breve descripción del producto"
                  className={inputBase}
                />
              </Field>

              <Field label="Descripción Larga">
                <textarea
                  value={fields.descriptionLong}
                  onChange={(e) => setField("descriptionLong", e.target.value)}
                  rows={3}
                  placeholder="Descripción detallada..."
                  className={`${inputBase} resize-none`}
                />
              </Field>
            </div>
          </section>

          {/* ── Clasificación ───────────────────────── */}
          <section className="border-border bg-card rounded-xl border p-6 shadow-sm">
            <h2 className="text-muted-foreground mb-4 text-sm font-bold tracking-widest uppercase">
              Clasificación
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <CreatableSelect
                label="Marca"
                value={sticky.brandId}
                options={(brands ?? []).map((b) => ({
                  id: b.id,
                  name: b.name,
                }))}
                placeholder="Sin marca"
                onChange={(id) => setStickyField("brandId", id)}
                onCreate={async (name) => {
                  const slug = name
                    .toLowerCase()
                    .replace(/\s+/g, "-")
                    .replace(/[^a-z0-9-]/g, "");
                  const brand = await createBrand.mutateAsync({ name, slug });
                  toast.success(`Marca "${name}" creada`);
                  return brand?.id;
                }}
                createLabel="+ Crear nueva marca…"
              />
              <CreatableSelect
                label="Categoría"
                value={sticky.categoryId}
                options={(categories ?? []).map((c) => ({
                  id: c.id,
                  name: c.name,
                }))}
                placeholder="Sin categoría"
                onChange={(id) => setStickyField("categoryId", id)}
                onCreate={async (name) => {
                  const slug = name
                    .toLowerCase()
                    .replace(/\s+/g, "-")
                    .replace(/[^a-z0-9-]/g, "");
                  const cat = await createCategory.mutateAsync({ name, slug });
                  toast.success(`Categoría "${name}" creada`);
                  return cat?.id;
                }}
                createLabel="+ Crear nueva categoría…"
              />
              <CreatableSelect
                label="Proveedor"
                value={sticky.supplierId}
                options={(suppliers ?? []).map((s) => ({
                  id: s.id,
                  name: s.name,
                }))}
                placeholder="Sin proveedor"
                onChange={(id) => setStickyField("supplierId", id)}
                onCreate={async (name) => {
                  const sup = await createSupplier.mutateAsync({ name });
                  toast.success(`Proveedor "${name}" creado`);
                  return sup?.id;
                }}
                createLabel="+ Crear nuevo proveedor…"
              />
            </div>
          </section>

          {/* ── Logística ───────────────────────────── */}
          <section className="border-border bg-card rounded-xl border p-6 shadow-sm">
            <h2 className="text-muted-foreground mb-4 text-sm font-bold tracking-widest uppercase">
              Logística
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Peso (kg)">
                <input
                  type="number"
                  step="0.01"
                  value={fields.weight}
                  onChange={(e) => setField("weight", e.target.value)}
                  placeholder="0.15"
                  className={inputBase}
                />
              </Field>
              <Field label="Volumen (m³)">
                <input
                  type="number"
                  step="0.001"
                  value={fields.volume}
                  onChange={(e) => setField("volume", e.target.value)}
                  placeholder="0.002"
                  className={inputBase}
                />
              </Field>
              <Field label="URL de Imagen">
                <input
                  type="url"
                  value={fields.imageUrl}
                  onChange={(e) => setField("imageUrl", e.target.value)}
                  placeholder="https://..."
                  className={inputBase}
                />
              </Field>
            </div>
          </section>

          {/* ── Configuración de Empaque ──── */}
          <section className="border-border bg-card rounded-xl border p-6 shadow-sm">
            <h2 className="text-muted-foreground mb-4 text-sm font-bold tracking-widest uppercase">
              Empaque
            </h2>
            <p className="text-muted-foreground mb-5 text-xs">
              Define la jerarquía de empaque del producto.
            </p>

            {/* Packaging configuration */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Unidades por Caja">
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={sticky.unitsPerBox}
                  onChange={(e) =>
                    setStickyField("unitsPerBox", e.target.value)
                  }
                  placeholder="ej: 12"
                  className={inputBase}
                />
              </Field>
              <Field label="Cajas por Bulto">
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={sticky.boxesPerBulk}
                  onChange={(e) =>
                    setStickyField("boxesPerBulk", e.target.value)
                  }
                  placeholder="ej: 10"
                  className={inputBase}
                />
              </Field>
              <Field label="Se Vende Por" required>
                <select
                  value={sticky.sellingUnit}
                  onChange={(e) =>
                    setStickyField("sellingUnit", e.target.value)
                  }
                  className={inputBase}
                >
                  {SELLING_UNIT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            {/* Conversion summary */}
            {sticky.unitsPerBox && sticky.boxesPerBulk && (
              <div className="bg-muted/50 mt-5 rounded-lg p-3 text-xs">
                <span className="text-muted-foreground font-medium">
                  Conversión:
                </span>{" "}
                1 Bulto = {sticky.boxesPerBulk} Cajas × {sticky.unitsPerBox}{" "}
                Unidades ={" "}
                <strong className="text-foreground">
                  {parseInt(sticky.boxesPerBulk, 10) *
                    parseInt(sticky.unitsPerBox, 10)}{" "}
                  Unidades
                </strong>
              </div>
            )}
          </section>

          {/* ── Precio ────────────────────────────────── */}
          <section className="border-border bg-card rounded-xl border p-6 shadow-sm">
            <h2 className="text-muted-foreground mb-4 text-sm font-bold tracking-widest uppercase">
              Precio
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Precio USD" hint="Precio base de referencia">
                <div className="relative">
                  <span className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2 text-sm">
                    $
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={priceUsd}
                    onChange={(e) => setPriceUsd(e.target.value)}
                    placeholder="0.00"
                    className={`${inputBase} pl-7`}
                  />
                </div>
              </Field>
              <Field
                label="Tasa BCV"
                hint={
                  ves.oficial.isLoading
                    ? "Cargando tasa…"
                    : `Fuente: ${ves.oficial.source} (${ves.oficial.date})`
                }
              >
                <div
                  className={`${inputBase} bg-secondary/50 flex items-center justify-between`}
                >
                  <span className="font-mono text-sm font-bold">
                    {ves.oficial.isLoading
                      ? "Cargando…"
                      : effectiveRate > 0
                        ? `${effectiveRate.toFixed(2)} Bs/$`
                        : "Sin tasa"}
                  </span>
                  {effectiveRate > 0 && (
                    <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-blue-400">
                      {ves.oficial.source === "dolarapi-oficial"
                        ? "DolarAPI"
                        : ves.oficial.source === "database"
                          ? "Base de Datos"
                          : "BCV"}
                    </span>
                  )}
                </div>
              </Field>
              <Field label="Equivalente en Bs">
                <div
                  className={`${inputBase} bg-secondary/50 flex items-center justify-between`}
                >
                  <span className="text-base font-bold">
                    {priceBs > 0
                      ? `Bs ${priceBs.toLocaleString("es-VE", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}`
                      : "—"}
                  </span>
                  {effectiveRate > 0 && (
                    <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-blue-400">
                      BCV Oficial
                    </span>
                  )}
                </div>
              </Field>
            </div>
          </section>

          {/* ── Estado ──────────────────────────────── */}
          <section className="border-border bg-card rounded-xl border p-6 shadow-sm">
            <h2 className="text-muted-foreground mb-4 text-sm font-bold tracking-widest uppercase">
              Estado
            </h2>
            <div className="max-w-xs">
              <Field label="Estado del Producto">
                <select
                  value={sticky.status}
                  onChange={(e) =>
                    setStickyField(
                      "status",
                      e.target.value as "draft" | "active" | "discontinued",
                    )
                  }
                  className={inputBase}
                >
                  <option value="draft">Borrador</option>
                  <option value="active">Activo</option>
                  <option value="discontinued">Descontinuado</option>
                </select>
              </Field>
            </div>
          </section>

          {/* ── Error ───────────────────────────────── */}
          {create.error && (
            <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border p-3 text-sm">
              {create.error.message}
            </div>
          )}

          {/* ── Actions ─────────────────────────────── */}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
            <Link
              href="/catalog"
              className="border-border text-muted-foreground hover:bg-secondary flex min-h-[44px] items-center justify-center rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={create.isPending}
              onClick={() => {
                submitModeRef.current = "save-and-continue";
              }}
              className="bg-secondary text-foreground hover:bg-accent flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold transition-colors disabled:opacity-50"
            >
              {create.isPending &&
                submitModeRef.current === "save-and-continue" && (
                  <span className="material-symbols-outlined animate-spin text-sm">
                    progress_activity
                  </span>
                )}
              <span className="material-symbols-outlined text-lg">
                playlist_add
              </span>
              Crear y Agregar Otro
            </button>
            <button
              type="submit"
              disabled={create.isPending}
              onClick={() => {
                submitModeRef.current = "save";
              }}
              className="bg-primary text-primary-foreground hover:bg-primary/90 flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold transition-colors disabled:opacity-50"
            >
              {create.isPending && submitModeRef.current === "save" && (
                <span className="material-symbols-outlined animate-spin text-sm">
                  progress_activity
                </span>
              )}
              Crear Producto
            </button>
          </div>
        </form>
      </div>
    </RoleGuard>
  );
}
