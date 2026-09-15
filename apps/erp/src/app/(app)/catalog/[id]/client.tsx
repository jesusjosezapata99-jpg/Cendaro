"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@cendaro/ui";
import { Icons } from "@cendaro/ui/icons";
import { StatusPill } from "@cendaro/ui/status-pill";

import { EmptyState } from "~/components/empty-state";
import { RoleGuard } from "~/components/role-guard";
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

/** Shared row style for key/value panels. */
const metaRowClasses =
  "border-border flex min-h-11 items-center justify-between gap-3 border p-3";

export default function ProductDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const trpc = useTRPC();
  const [showEdit, setShowEdit] = useState(false);

  const { data: product, isLoading } = useQuery(
    trpc.catalog.productById.queryOptions({ id }),
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
          <Button
            variant="outline"
            onClick={() => setShowEdit(true)}
            className="h-9 px-3 text-xs"
          >
            <Icons.Edit className="mr-1.5 size-3.5" />
            Editar
          </Button>
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

      {/* Header card */}
      <div className="border-border bg-card border p-6">
        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="bg-muted border-border flex size-28 shrink-0 items-center justify-center border">
            <Icons.Image className="text-muted-foreground size-8" aria-hidden />
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
              }) => (
                <div key={s.id} className={metaRowClasses}>
                  <div className="flex min-w-0 items-center gap-2">
                    <Icons.Warehouse
                      className="text-muted-foreground size-4"
                      aria-hidden
                    />
                    <span
                      className="text-foreground truncate font-mono text-xs tabular-nums"
                      title={s.warehouseId}
                    >
                      {s.warehouseId.slice(0, 8)}…
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
              ),
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

      {/* Metadata */}
      <div className="border-border bg-card border p-6">
        <h2 className="text-muted-foreground mb-4 text-xs font-medium tracking-wider uppercase">
          Información del Producto
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
            { label: "Estado", value: badge.label, mono: false },
            {
              label: "Creado",
              value: new Date(product.createdAt).toLocaleDateString("es-VE"),
              mono: false,
            },
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
