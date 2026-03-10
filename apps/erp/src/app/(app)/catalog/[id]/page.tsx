"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { RoleGuard } from "~/components/role-guard";
import { useTRPC } from "~/trpc/client";

const EditProductDialog = dynamic(
  () =>
    import("~/components/forms/edit-product").then((m) => ({
      default: m.EditProductDialog,
    })),
  { ssr: false },
);

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`bg-muted animate-pulse rounded-lg ${className}`} />;
}

const STATUS_BADGE: Record<string, { label: string; class: string }> = {
  active: {
    label: "Activo",
    class:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  },
  draft: {
    label: "Borrador",
    class:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  },
  discontinued: {
    label: "Descontinuado",
    class: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  },
  inactive: {
    label: "Inactivo",
    class: "bg-slate-100 text-muted-foreground dark:bg-secondary",
  },
  inventory_locked: {
    label: "Bloqueado",
    class: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  },
};

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
      <div className="space-y-6 p-4 lg:p-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="text-muted-foreground flex flex-col items-center justify-center p-12">
        <span className="material-symbols-outlined mb-3 text-5xl">
          search_off
        </span>
        <p className="text-lg font-medium">Producto no encontrado</p>
        <Link
          href="/catalog"
          className="text-primary mt-4 text-sm hover:underline"
        >
          ← Volver al catálogo
        </Link>
      </div>
    );
  }

  const badge = STATUS_BADGE[product.status] ?? {
    label: product.status,
    class: "",
  };

  return (
    <div className="space-y-6 p-4 lg:p-8">
      {/* Breadcrumb + actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
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
          <span className="text-foreground font-medium">{product.name}</span>
        </div>
        <RoleGuard allow={["owner", "admin", "supervisor"]}>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowEdit(true)}
              className="border-border bg-card hover:bg-accent inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
            >
              <span className="material-symbols-outlined text-lg">edit</span>
              Editar
            </button>
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

      {/* Header card */}
      <div className="border-border bg-card rounded-xl border p-6 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="bg-muted flex size-32 shrink-0 items-center justify-center rounded-xl">
            <span className="material-symbols-outlined text-muted-foreground text-4xl">
              image
            </span>
          </div>
          <div className="flex-1 space-y-3">
            <div className="flex flex-wrap items-start gap-3">
              <h1 className="text-2xl font-bold tracking-tight">
                {product.name}
              </h1>
              <span
                className={`mt-1 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.class}`}
              >
                {badge.label}
              </span>
            </div>
            <div className="text-muted-foreground flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <span>
                SKU: <strong className="text-foreground">{product.sku}</strong>
              </span>
              {product.barcode && (
                <span>
                  Código:{" "}
                  <strong className="text-foreground">{product.barcode}</strong>
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
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {[
          { label: "SKU", value: product.sku, icon: "qr_code" },
          { label: "Estado", value: badge.label, icon: "verified" },
          {
            label: "Creado",
            value: new Date(product.createdAt).toLocaleDateString("es-VE"),
            icon: "calendar_today",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="border-border bg-card rounded-xl border p-4 shadow-sm"
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-muted-foreground text-lg">
                {stat.icon}
              </span>
              <span className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
                {stat.label}
              </span>
            </div>
            <p className="mt-1 text-lg font-bold">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Metadata */}
      <section className="border-border bg-card rounded-xl border p-6 shadow-sm">
        <h2 className="text-muted-foreground mb-4 text-sm font-bold tracking-widest uppercase">
          Información del Producto
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { label: "Nombre", value: product.name },
            { label: "SKU", value: product.sku },
            { label: "Código de Barras", value: product.barcode ?? "—" },
            { label: "Estado", value: badge.label },
            {
              label: "Creado",
              value: new Date(product.createdAt).toLocaleDateString("es-VE"),
            },
            {
              label: "Actualizado",
              value: product.updatedAt
                ? new Date(product.updatedAt).toLocaleDateString("es-VE")
                : "—",
            },
          ].map((a) => (
            <div
              key={a.label}
              className="border-border flex items-center justify-between rounded-lg border p-3"
            >
              <span className="text-muted-foreground text-sm">{a.label}</span>
              <span className="text-sm font-semibold">{a.value}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
