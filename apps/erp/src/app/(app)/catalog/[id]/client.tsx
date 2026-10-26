"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@cendaro/ui";
import { Icons } from "@cendaro/ui/icons";
import { StatusPill } from "@cendaro/ui/status-pill";

import { Field, Input, Select } from "~/components/dialog";
import { EmptyState } from "~/components/empty-state";
import { RoleGuard } from "~/components/role-guard";
import {
  SheetBody,
  SheetFooter,
  SheetFormActions,
  SheetModal,
} from "~/components/sheet-modal";
import { DetailSkeleton } from "~/components/skeleton";
import { StatCard } from "~/components/stat-card";
import { getStatus } from "~/lib/status";
import { useTRPC } from "~/trpc/client";

const EditProductDialog = dynamic(
  () =>
    import("~/components/forms/edit-product").then((m) => ({
      default: m.EditProductDialog,
    })),
  { ssr: false },
);

const PRICE_TYPE_LABELS: Record<string, string> = {
  store: "Tienda (POS)",
  wholesale: "Mayorista",
  vendor: "Vendedor Nacional",
  promo: "Promocional",
  special: "Especial",
};

/** Shared row style for key/value panels. */
const metaRowClasses =
  "border-border flex min-h-11 items-center justify-between gap-3 border p-3";

export default function ProductDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [showEdit, setShowEdit] = useState(false);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [priceForm, setPriceForm] = useState<{
    priceType: "store" | "wholesale" | "vendor" | "promo" | "special";
    amountUsd: string;
  }>({
    priceType: "store",
    amountUsd: "",
  });

  const { data: product, isLoading } = useQuery(
    trpc.catalog.productById.queryOptions({ id }),
  );
  const { data: brands } = useQuery(trpc.catalog.listBrands.queryOptions());
  const { data: categories } = useQuery(
    trpc.catalog.listCategories.queryOptions(),
  );
  const { data: suppliers } = useQuery(
    trpc.catalog.listSuppliers.queryOptions(),
  );
  const { data: warehouses } = useQuery(
    trpc.inventory.listWarehouses.queryOptions(),
  );

  const setPriceMutation = useMutation(
    trpc.catalog.setPrice.mutationOptions({
      onSuccess: () => {
        toast.success("Precio actualizado exitosamente");
        setShowPriceModal(false);
        setPriceForm({ priceType: "store", amountUsd: "" });
        void qc.invalidateQueries({ queryKey: [["catalog"]] });
        void qc.invalidateQueries({ queryKey: [["pricing"]] });
      },
      onError: (err) => {
        toast.error(err.message);
      },
    }),
  );

  if (isLoading) {
    return <DetailSkeleton />;
  }

  if (!product) {
    return (
      <div className="py-4 lg:py-8">
        <EmptyState
          icon="SearchOff"
          title="Producto no encontrado"
          description="El producto que buscas no existe o fue eliminado del catálogo."
          action={
            <Button variant="outline" asChild>
              <Link href="/catalog">Volver al catálogo</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const badge = getStatus("product", product.status);
  const brandName =
    brands?.find((b) => b.id === product.brandId)?.name ??
    (product.brandId ? product.brandId.slice(0, 8) : "—");
  const categoryName =
    categories?.find((c) => c.id === product.categoryId)?.name ??
    (product.categoryId ? product.categoryId.slice(0, 8) : "—");
  const supplierName =
    suppliers?.find((s) => s.id === product.supplierId)?.name ??
    (product.supplierId ? product.supplierId.slice(0, 8) : "—");

  const totalStock = product.stockLedger
    .reduce((sum: number, s: { quantity: number }) => sum + s.quantity, 0)
    .toLocaleString("es-VE");

  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 space-y-6 py-4 duration-200 lg:py-8">
      {/* Breadcrumb + actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <nav
          aria-label="Breadcrumb"
          className="text-muted-foreground flex items-center gap-2 text-xs"
        >
          <Link
            href="/catalog"
            className="hover:text-foreground flex items-center gap-1 transition-colors"
          >
            <Icons.ArrowBack className="size-3.5" />
            Catálogo
          </Link>
          <Icons.ChevronRight className="size-3.5" aria-hidden />
          <span className="text-foreground font-medium">{product.name}</span>
        </nav>
        <RoleGuard allow={["owner", "admin", "supervisor"]}>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setShowPriceModal(true)}
              className="h-9 px-3 text-xs"
            >
              <Icons.Payments className="mr-1.5 size-3.5" />
              Configurar Precio
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowEdit(true)}
              className="h-9 px-3 text-xs"
            >
              <Icons.Edit className="mr-1.5 size-3.5" />
              Editar
            </Button>
          </div>
        </RoleGuard>
      </div>

      {showEdit && (
        <EditProductDialog
          open={showEdit}
          onClose={() => setShowEdit(false)}
          product={{
            id: product.id,
            name: product.name,
            barcode: product.barcode,
            descriptionShort: product.descriptionShort,
            status: product.status,
          }}
        />
      )}

      <SheetModal
        open={showPriceModal}
        onClose={() => setShowPriceModal(false)}
        title="Configurar Precio por Canal"
        description={`Establece el precio en USD para ${product.name}`}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const parsed = Number.parseFloat(priceForm.amountUsd);
            if (!Number.isFinite(parsed) || parsed < 0) return;
            setPriceMutation.mutate({
              productId: product.id,
              priceType: priceForm.priceType,
              amountUsd: parsed,
            });
          }}
          className="flex h-full flex-col"
        >
          <SheetBody>
            <Field label="Canal / Tipo de Precio" required>
              <Select
                value={priceForm.priceType}
                onChange={(e) =>
                  setPriceForm((prev) => ({
                    ...prev,
                    priceType: e.target.value as typeof prev.priceType,
                  }))
                }
              >
                <option value="store">Tienda (POS)</option>
                <option value="wholesale">Mayorista</option>
                <option value="vendor">Vendedor Nacional</option>
                <option value="promo">Promocional</option>
                <option value="special">Especial</option>
              </Select>
            </Field>
            <Field label="Monto (USD)" required>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={priceForm.amountUsd}
                onChange={(e) =>
                  setPriceForm((prev) => ({
                    ...prev,
                    amountUsd: e.target.value,
                  }))
                }
                placeholder="0.00"
                className="font-mono tabular-nums"
                required
              />
            </Field>
          </SheetBody>
          <SheetFooter>
            <SheetFormActions
              onCancel={() => setShowPriceModal(false)}
              submitting={setPriceMutation.isPending}
              submitLabel="Guardar Precio"
            />
          </SheetFooter>
        </form>
      </SheetModal>

      {/* Header card */}
      <div className="border-border bg-card border p-6">
        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="bg-muted border-border flex size-28 shrink-0 items-center justify-center overflow-hidden border">
            {product.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.imageUrl}
                alt={product.name}
                className="size-full object-cover"
              />
            ) : (
              <Icons.Image
                className="text-muted-foreground size-8"
                aria-hidden
              />
            )}
          </div>
          <div className="flex-1 space-y-3">
            <div className="flex flex-wrap items-start gap-3">
              <h1 className="text-foreground font-mono text-xl font-medium tracking-tight">
                {product.name}
              </h1>
              <StatusPill tone={badge.tone}>{badge.label}</StatusPill>
            </div>
            <div className="text-muted-foreground flex flex-wrap gap-x-6 gap-y-1 text-xs">
              <span>
                SKU:{" "}
                <strong className="text-foreground font-mono font-medium tabular-nums">
                  {product.sku}
                </strong>
              </span>
              {product.barcode && (
                <span>
                  Código:{" "}
                  <strong className="text-foreground font-mono font-medium tabular-nums">
                    {product.barcode}
                  </strong>
                </span>
              )}
              <span>
                Marca:{" "}
                <strong className="text-foreground font-medium">
                  {brandName}
                </strong>
              </span>
              <span>
                Categoría:{" "}
                <strong className="text-foreground font-medium">
                  {categoryName}
                </strong>
              </span>
            </div>
            {product.descriptionShort && (
              <p className="text-muted-foreground max-w-2xl text-xs leading-relaxed">
                {product.descriptionShort}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="SKU"
          value={<span className="font-mono text-base">{product.sku}</span>}
          icon="QrCode"
        />
        <StatCard
          label="Estado"
          value={badge.label}
          icon="Verified"
          tone={
            badge.tone === "success" ||
            badge.tone === "warning" ||
            badge.tone === "destructive"
              ? badge.tone
              : "default"
          }
        />
        <StatCard
          label="Creado"
          value={new Date(product.createdAt).toLocaleDateString("es-VE")}
          icon="CalendarToday"
        />
        <StatCard
          label="Stock Total"
          value={<span className="font-mono tabular-nums">{totalStock}</span>}
          icon="Inventory2"
        />
      </div>

      {/* Precios por Canal */}
      <div className="border-border bg-card border p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
            Precios por Canal
          </h2>
          <RoleGuard allow={["owner", "admin", "supervisor"]}>
            <button
              type="button"
              onClick={() => setShowPriceModal(true)}
              className="text-primary text-xs font-medium hover:underline"
            >
              + Actualizar Precio
            </button>
          </RoleGuard>
        </div>
        {product.prices.length === 0 ? (
          <p className="text-muted-foreground text-xs">
            No se han configurado precios para este producto.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {product.prices.map(
              (p: {
                id: string;
                priceType: string;
                amountUsd: number;
                amountBs: number | null;
              }) => (
                <div key={p.id} className={metaRowClasses}>
                  <span className="text-foreground text-xs font-medium">
                    {PRICE_TYPE_LABELS[p.priceType] ?? p.priceType}
                  </span>
                  <div className="text-right font-mono text-xs tabular-nums">
                    <span className="text-foreground font-medium">
                      ${p.amountUsd.toFixed(2)} USD
                    </span>
                    {p.amountBs != null && (
                      <span className="text-muted-foreground ml-2">
                        (Bs {p.amountBs.toFixed(2)})
                      </span>
                    )}
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </div>

      {/* Stock por Almacén */}
      {product.stockLedger.length > 0 && (
        <div className="border-border bg-card border p-6">
          <h2 className="text-muted-foreground mb-4 text-xs font-medium tracking-wider uppercase">
            Stock por Almacén
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {product.stockLedger.map(
              (s: {
                id: string;
                warehouseId: string;
                quantity: number;
                isLocked: boolean;
              }) => {
                const whName =
                  warehouses?.find((w) => w.id === s.warehouseId)?.name ??
                  `${s.warehouseId.slice(0, 8)}…`;
                return (
                  <div key={s.id} className={metaRowClasses}>
                    <div className="flex min-w-0 items-center gap-2">
                      <Icons.Warehouse
                        className="text-muted-foreground size-4"
                        aria-hidden
                      />
                      <span
                        className="text-foreground truncate text-xs font-medium"
                        title={whName}
                      >
                        {whName}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-foreground font-mono text-xs font-medium tabular-nums">
                        {s.quantity.toLocaleString("es-VE")}
                      </span>
                      {s.isLocked && (
                        <Icons.Lock
                          className="text-destructive size-3.5"
                          aria-label="Stock bloqueado"
                        />
                      )}
                    </div>
                  </div>
                );
              },
            )}
          </div>
        </div>
      )}

      {/* Stock por Canal */}
      {product.channelAllocations.length > 0 && (
        <div className="border-border bg-card border p-6">
          <h2 className="text-muted-foreground mb-4 text-xs font-medium tracking-wider uppercase">
            Stock por Canal
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {product.channelAllocations.map(
              (c: { id: string; channel: string; quantity: number }) => (
                <div key={c.id} className={metaRowClasses}>
                  <div className="flex items-center gap-2">
                    <Icons.Storefront
                      className="text-muted-foreground size-4"
                      aria-hidden
                    />
                    <span className="text-foreground text-xs font-medium capitalize">
                      {c.channel}
                    </span>
                  </div>
                  <span className="text-foreground font-mono text-xs font-medium tabular-nums">
                    {c.quantity.toLocaleString("es-VE")}
                  </span>
                </div>
              ),
            )}
          </div>
        </div>
      )}

      {/* Metadata & Packaging */}
      <div className="border-border bg-card border p-6">
        <h2 className="text-muted-foreground mb-4 text-xs font-medium tracking-wider uppercase">
          Información del Producto y Empaque
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { label: "Nombre", value: product.name, mono: false },
            { label: "SKU", value: product.sku, mono: true },
            {
              label: "Código de Barras",
              value: product.barcode ?? "—",
              mono: true,
            },
            { label: "Marca", value: brandName, mono: false },
            { label: "Categoría", value: categoryName, mono: false },
            { label: "Proveedor", value: supplierName, mono: false },
            { label: "Unidad Base", value: product.baseUom, mono: false },
            {
              label: "Unidad de Venta",
              value: product.sellingUnit,
              mono: false,
            },
            {
              label: "Unidades / Caja",
              value:
                product.unitsPerBox != null ? String(product.unitsPerBox) : "—",
              mono: true,
            },
            {
              label: "Cajas / Bulto",
              value:
                product.boxesPerBulk != null
                  ? String(product.boxesPerBulk)
                  : "—",
              mono: true,
            },
            { label: "Estado", value: badge.label, mono: false },
            {
              label: "Actualizado",
              value: product.updatedAt
                ? new Date(product.updatedAt).toLocaleDateString("es-VE")
                : "—",
              mono: false,
            },
          ].map((a) => (
            <div key={a.label} className={metaRowClasses}>
              <span className="text-muted-foreground shrink-0 text-xs">
                {a.label}
              </span>
              <span
                className={`text-foreground truncate text-xs font-medium ${
                  a.mono ? "font-mono tabular-nums" : ""
                }`}
              >
                {a.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
