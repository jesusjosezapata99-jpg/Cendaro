"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { Button, Card, CardContent, CardHeader, CardTitle } from "@cendaro/ui";
import { Icons } from "@cendaro/ui/icons";

import type { StatusTone } from "~/components/status-badge";
import { EmptyState } from "~/components/empty-state";
import { RoleGuard } from "~/components/role-guard";
import { Skeleton } from "~/components/skeleton";
import { StatCard } from "~/components/stat-card";
import { StatusBadge } from "~/components/status-badge";
import { useTRPC } from "~/trpc/client";

const EditProductDialog = dynamic(
  () =>
    import("~/components/forms/edit-product").then((m) => ({
      default: m.EditProductDialog,
    })),
  { ssr: false },
);

/** Product status → semantic token chip (matches the catalog list). */
const STATUS_CONFIG: Record<string, { label: string; tone: StatusTone }> = {
  active: { label: "Activo", tone: "success" },
  draft: { label: "Borrador", tone: "warning" },
  discontinued: { label: "Descontinuado", tone: "destructive" },
  inactive: { label: "Inactivo", tone: "neutral" },
  inventory_locked: { label: "Bloqueado", tone: "destructive" },
};

/** Section header for detail panels — mirrors the dashboard card style. */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <CardTitle className="text-muted-foreground text-sm font-medium">
      {children}
    </CardTitle>
  );
}

/** Shared row style for key/value panels. */
const metaRowClasses =
  "border-border-subtle flex min-h-11 items-center justify-between gap-3 rounded-lg border p-3";

export default function ProductDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const trpc = useTRPC();
  const [showEdit, setShowEdit] = useState(false);

  const { data: product, isLoading } = useQuery(
    trpc.catalog.productById.queryOptions({ id }),
  );

  if (isLoading) {
    return (
      <div className="animate-in fade-in space-y-6 py-4 duration-200 lg:py-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
    );
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

  const badge = STATUS_CONFIG[product.status] ?? {
    label: product.status,
    tone: "neutral" as StatusTone,
  };

  const totalStock = product.stockLedger
    .reduce((sum: number, s: { quantity: number }) => sum + s.quantity, 0)
    .toLocaleString("es-VE");

  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 space-y-6 py-4 duration-200 lg:py-8">
      {/* Breadcrumb + actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <nav
          aria-label="Breadcrumb"
          className="text-muted-foreground flex items-center gap-2 text-sm"
        >
          <Link
            href="/catalog"
            className="hover:text-foreground transition-colors"
          >
            Catálogo
          </Link>
          <Icons.ChevronRight className="size-4" aria-hidden />
          <span className="text-foreground font-medium">{product.name}</span>
        </nav>
        <RoleGuard allow={["owner", "admin", "supervisor"]}>
          <Button variant="outline" onClick={() => setShowEdit(true)}>
            <Icons.Edit className="size-4.5" />
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
      <Card>
        <CardContent>
          <div className="flex flex-col gap-6 lg:flex-row">
            <div className="bg-muted flex size-32 shrink-0 items-center justify-center rounded-xl">
              <Icons.Image
                className="text-muted-foreground size-9"
                aria-hidden
              />
            </div>
            <div className="flex-1 space-y-3">
              <div className="flex flex-wrap items-start gap-3">
                <h1 className="text-foreground text-2xl font-medium tracking-tight">
                  {product.name}
                </h1>
                <StatusBadge tone={badge.tone} className="mt-1">
                  {badge.label}
                </StatusBadge>
              </div>
              <div className="text-muted-foreground flex flex-wrap gap-x-6 gap-y-1 text-sm">
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
                <p className="text-muted-foreground max-w-2xl text-sm">
                  {product.descriptionShort}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

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
          tone={badge.tone === "neutral" ? "default" : badge.tone}
        />
        <StatCard
          label="Creado"
          value={new Date(product.createdAt).toLocaleDateString("es-VE")}
          icon="CalendarToday"
        />
        <StatCard label="Stock Total" value={totalStock} icon="Inventory2" />
      </div>

      {/* Stock por Almacén */}
      {product.stockLedger.length > 0 && (
        <Card>
          <CardHeader>
            <SectionTitle>Stock por Almacén</SectionTitle>
          </CardHeader>
          <CardContent>
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
                        className="text-muted-foreground size-4.5"
                        aria-hidden
                      />
                      <span
                        className="text-foreground truncate font-mono text-sm tabular-nums"
                        title={s.warehouseId}
                      >
                        {s.warehouseId.slice(0, 8)}…
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-foreground font-mono text-sm font-medium tabular-nums">
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
          </CardContent>
        </Card>
      )}

      {/* Stock por Canal */}
      {product.channelAllocations.length > 0 && (
        <Card>
          <CardHeader>
            <SectionTitle>Stock por Canal</SectionTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {product.channelAllocations.map(
                (c: { id: string; channel: string; quantity: number }) => (
                  <div key={c.id} className={metaRowClasses}>
                    <div className="flex items-center gap-2">
                      <Icons.Storefront
                        className="text-muted-foreground size-4.5"
                        aria-hidden
                      />
                      <span className="text-foreground text-sm font-medium capitalize">
                        {c.channel}
                      </span>
                    </div>
                    <span className="text-foreground font-mono text-sm font-medium tabular-nums">
                      {c.quantity.toLocaleString("es-VE")}
                    </span>
                  </div>
                ),
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metadata */}
      <Card>
        <CardHeader>
          <SectionTitle>Información del Producto</SectionTitle>
        </CardHeader>
        <CardContent>
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
                <span className="text-muted-foreground shrink-0 text-sm">
                  {a.label}
                </span>
                <span
                  className={`text-foreground truncate text-sm font-medium ${
                    a.mono ? "font-mono tabular-nums" : ""
                  }`}
                >
                  {a.value}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
