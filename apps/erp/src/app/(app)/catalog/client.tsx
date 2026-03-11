"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { useDebounce } from "~/hooks/use-debounce";
import { useTRPC } from "~/trpc/client";

const CreateProductDialog = dynamic(
  () =>
    import("~/components/forms/create-product").then((m) => ({
      default: m.CreateProductDialog,
    })),
  { ssr: false },
);

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`bg-muted animate-pulse rounded-lg ${className}`} />;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active: {
    label: "Activo",
    color:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  },
  draft: {
    label: "Borrador",
    color:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  },
  discontinued: {
    label: "Descontinuado",
    color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  },
};

export default function CatalogClient() {
  const trpc = useTRPC();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const limit = 25;

  const { data, isLoading } = useQuery({
    ...trpc.catalog.listProducts.queryOptions({
      limit,
      offset: page * limit,
      search: debouncedSearch || undefined,
      status:
        statusFilter !== "all"
          ? (statusFilter as "active" | "draft" | "discontinued")
          : undefined,
    }),
    placeholderData: keepPreviousData,
  });

  const products = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6 p-4 lg:p-8">
      {/* Header — stacks vertically on mobile */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-black tracking-tight">
            Catálogo de Productos
          </h1>
          <p className="text-muted-foreground text-sm">
            Gestiona tu catálogo de {total.toLocaleString()} referencias
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-primary text-primary-foreground hover:bg-primary/90 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors sm:w-auto"
        >
          <span className="material-symbols-outlined text-lg">add</span>
          Nuevo Producto
        </button>
      </div>

      <CreateProductDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
      />

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          {
            label: "Total Productos",
            value: total,
            icon: "inventory_2",
            accent: "border-blue-500/40",
          },
          {
            label: "Mostrando",
            value: products.length,
            icon: "visibility",
            accent: "border-emerald-500/40",
          },
          {
            label: "Página",
            value: `${page + 1} / ${Math.max(totalPages, 1)}`,
            icon: "auto_stories",
            accent: "border-amber-500/40",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className={`rounded-xl border-l-4 ${stat.accent} bg-card border-border border p-4`}
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-muted-foreground text-lg">
                {stat.icon}
              </span>
              <span className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
                {stat.label}
              </span>
            </div>
            <p className="text-foreground mt-1 text-2xl font-black tracking-tight">
              {isLoading ? "—" : stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <input
          type="text"
          placeholder="Buscar por nombre o SKU..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          className="border-border bg-card text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-ring/20 min-h-[44px] flex-1 rounded-lg border px-4 py-2.5 text-sm transition-colors outline-none focus:ring-2"
        />
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(0);
          }}
          className="border-border bg-card text-foreground focus:border-primary focus:ring-ring/20 min-h-[44px] rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2"
        >
          <option value="all">Todos los estados</option>
          <option value="active">Activos</option>
          <option value="draft">Borradores</option>
          <option value="discontinued">Descontinuados</option>
        </select>
      </div>

      {/* ── Mobile: Card View ─────────────────────── */}
      <div className="space-y-3 md:hidden">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))
          : products.map((product) => {
              const statusCfg = STATUS_CONFIG[product.status] ?? {
                label: product.status,
                color: "",
              };
              return (
                <Link
                  key={product.id}
                  href={`/catalog/${product.id}`}
                  className="border-border bg-card hover:border-primary/30 block rounded-xl border p-4 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground truncate font-medium">
                        {product.name}
                      </p>
                      <p className="text-muted-foreground mt-0.5 font-mono text-xs">
                        {product.sku}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusCfg.color}`}
                    >
                      {statusCfg.label}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-2 text-xs">
                    {new Date(product.createdAt).toLocaleDateString("es-VE")}
                  </p>
                </Link>
              );
            })}
        {!isLoading && products.length === 0 && (
          <div className="text-muted-foreground flex flex-col items-center py-12 text-center">
            <span className="material-symbols-outlined mb-2 text-3xl">
              search_off
            </span>
            No se encontraron productos
          </div>
        )}
      </div>

      {/* ── Desktop: Table View ───────────────────── */}
      <div className="border-border bg-card hidden overflow-hidden rounded-xl border md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-border text-muted-foreground border-b text-xs uppercase">
              <th className="px-4 py-3 font-medium">SKU</th>
              <th className="px-4 py-3 font-medium">Producto</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Creado</th>
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-border border-b">
                    <td className="px-4 py-3">
                      <Skeleton className="h-5 w-20" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-5 w-48" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-5 w-20" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-5 w-24" />
                    </td>
                  </tr>
                ))
              : products.map((product) => {
                  const statusCfg = STATUS_CONFIG[product.status] ?? {
                    label: product.status,
                    color: "",
                  };
                  return (
                    <tr
                      key={product.id}
                      className="border-border hover:bg-accent/50 border-b transition-colors"
                    >
                      <td className="text-muted-foreground px-4 py-3 font-mono text-xs">
                        {product.sku}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/catalog/${product.id}`}
                          className="text-foreground hover:text-primary font-medium transition-colors"
                        >
                          {product.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusCfg.color}`}
                        >
                          {statusCfg.label}
                        </span>
                      </td>
                      <td className="text-muted-foreground px-4 py-3 text-sm">
                        {new Date(product.createdAt).toLocaleDateString(
                          "es-VE",
                        )}
                      </td>
                    </tr>
                  );
                })}
            {!isLoading && products.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="text-muted-foreground px-4 py-12 text-center"
                >
                  <span className="material-symbols-outlined mb-2 block text-3xl">
                    search_off
                  </span>
                  No se encontraron productos
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination — simplified on mobile */}
      <div className="text-muted-foreground flex flex-col items-center gap-3 text-xs sm:flex-row sm:justify-between">
        <p>
          Mostrando {products.length} de {total} productos
        </p>
        <div className="flex gap-1">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="bg-secondary text-muted-foreground hover:bg-accent min-h-[36px] rounded px-3 py-1 transition-colors disabled:opacity-50"
          >
            ← Anterior
          </button>
          <span className="bg-primary text-primary-foreground flex min-h-[36px] items-center rounded px-3 py-1">
            {page + 1}
          </span>
          <button
            onClick={() => setPage((p) => (p + 1 < totalPages ? p + 1 : p))}
            disabled={page + 1 >= totalPages}
            className="bg-secondary text-muted-foreground hover:bg-accent min-h-[36px] rounded px-3 py-1 transition-colors disabled:opacity-50"
          >
            Siguiente →
          </button>
        </div>
      </div>
    </div>
  );
}
