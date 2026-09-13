"use client";

import { useState } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@cendaro/ui";
import { Icons } from "@cendaro/ui/icons";

import type { StatusTone } from "~/components/status-badge";
import { EmptyState } from "~/components/empty-state";
import { PageHeader } from "~/components/page-header";
import { Skeleton } from "~/components/skeleton";
import { StatCard } from "~/components/stat-card";
import { StatusBadge } from "~/components/status-badge";
import { useDebounce } from "~/hooks/use-debounce";
import { useTRPC } from "~/trpc/client";

/** Business status → semantic token chip (single source of truth). */
const STATUS_CONFIG: Record<string, { label: string; tone: StatusTone }> = {
  active: { label: "Activo", tone: "success" },
  draft: { label: "Borrador", tone: "warning" },
  discontinued: { label: "Descontinuado", tone: "destructive" },
};

/** Shared cell padding for the catalog table. */
const cellPx = "px-4 py-3";

export default function CatalogClient() {
  const trpc = useTRPC();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
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
    <div className="animate-in fade-in slide-in-from-bottom-1 space-y-6 p-4 duration-200 lg:p-8">
      <PageHeader
        title="Catálogo de Productos"
        description={`Gestiona tu catálogo de ${total.toLocaleString("es-VE")} referencias`}
        actions={
          <>
            <Button variant="outline" asChild className="min-h-11">
              <Link href="/catalog/import">
                <Icons.UploadFile className="size-4.5" />
                Importar
              </Link>
            </Button>
            <Button asChild className="min-h-11">
              <Link href="/catalog/new">
                <Icons.Add className="size-4.5" />
                Nuevo Producto
              </Link>
            </Button>
          </>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Total Productos"
          value={isLoading ? "—" : total.toLocaleString("es-VE")}
          icon="Inventory2"
          tone="primary"
        />
        <StatCard
          label="Mostrando"
          value={isLoading ? "—" : products.length}
          icon="Visibility"
          tone="success"
        />
        <StatCard
          label="Página"
          value={`${page + 1} / ${Math.max(totalPages, 1)}`}
          icon="AutoStories"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Icons.Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            type="text"
            placeholder="Buscar por nombre o referencia..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="min-h-11 pl-10"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            setPage(0);
          }}
        >
          <SelectTrigger className="h-11 w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="active">Activos</SelectItem>
            <SelectItem value="draft">Borradores</SelectItem>
            <SelectItem value="discontinued">Descontinuados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ── Mobile: Card View ─────────────────────── */}
      <div className="space-y-3 md:hidden">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="border-border-subtle surface-card rounded-xl border p-4"
              >
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="mt-2 h-4 w-24" />
              </div>
            ))
          : products.map((product) => {
              const statusCfg = STATUS_CONFIG[product.status] ?? {
                label: product.status,
                tone: "neutral" as StatusTone,
              };
              return (
                <Link
                  key={product.id}
                  href={`/catalog/${product.id}`}
                  className="border-border-subtle surface-card hover:border-primary/30 focus-visible:border-ring focus-visible:ring-ring/50 block rounded-xl border p-4 transition-all duration-200 outline-none active:scale-[0.99] motion-reduce:active:scale-100"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground truncate font-medium">
                        {product.name}
                      </p>
                      <p className="text-muted-foreground mt-0.5 font-mono text-xs tabular-nums">
                        {product.sku}
                      </p>
                    </div>
                    <StatusBadge tone={statusCfg.tone}>
                      {statusCfg.label}
                    </StatusBadge>
                  </div>
                  <p className="text-muted-foreground mt-2 text-xs">
                    {new Date(product.createdAt).toLocaleDateString("es-VE")}
                  </p>
                </Link>
              );
            })}
        {!isLoading && products.length === 0 && (
          <EmptyState
            icon="SearchOff"
            title="No se encontraron productos"
            description="Ajusta la búsqueda o el filtro de estado e inténtalo de nuevo."
          />
        )}
      </div>

      {/* ── Desktop: Table View ───────────────────── */}
      <div className="border-border-subtle surface-card hidden gap-0 overflow-hidden rounded-xl border py-0 md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead
                className={`text-muted-foreground ${cellPx} text-xs font-medium tracking-widest uppercase`}
              >
                Referencia
              </TableHead>
              <TableHead
                className={`text-muted-foreground ${cellPx} text-xs font-medium tracking-widest uppercase`}
              >
                Producto
              </TableHead>
              <TableHead
                className={`text-muted-foreground ${cellPx} text-xs font-medium tracking-widest uppercase`}
              >
                Estado
              </TableHead>
              <TableHead
                className={`text-muted-foreground ${cellPx} text-xs font-medium tracking-widest uppercase`}
              >
                Creado
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell className={cellPx}>
                      <Skeleton className="h-5 w-20" />
                    </TableCell>
                    <TableCell className={cellPx}>
                      <Skeleton className="h-5 w-48" />
                    </TableCell>
                    <TableCell className={cellPx}>
                      <Skeleton className="h-5 w-20" />
                    </TableCell>
                    <TableCell className={cellPx}>
                      <Skeleton className="h-5 w-24" />
                    </TableCell>
                  </TableRow>
                ))
              : products.map((product) => {
                  const statusCfg = STATUS_CONFIG[product.status] ?? {
                    label: product.status,
                    tone: "neutral" as StatusTone,
                  };
                  return (
                    <TableRow key={product.id}>
                      <TableCell
                        className={`text-muted-foreground ${cellPx} font-mono text-xs tabular-nums`}
                      >
                        {product.sku}
                      </TableCell>
                      <TableCell className={cellPx}>
                        <Link
                          href={`/catalog/${product.id}`}
                          className="text-foreground hover:text-primary font-medium transition-colors"
                        >
                          {product.name}
                        </Link>
                      </TableCell>
                      <TableCell className={cellPx}>
                        <StatusBadge tone={statusCfg.tone}>
                          {statusCfg.label}
                        </StatusBadge>
                      </TableCell>
                      <TableCell
                        className={`text-muted-foreground ${cellPx} text-sm`}
                      >
                        {new Date(product.createdAt).toLocaleDateString(
                          "es-VE",
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
            {!isLoading && products.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={4} className="px-4 py-6">
                  <EmptyState
                    icon="SearchOff"
                    title="No se encontraron productos"
                    description="Ajusta la búsqueda o el filtro de estado e inténtalo de nuevo."
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="text-muted-foreground flex flex-col items-center gap-3 text-xs sm:flex-row sm:justify-between">
        <p>
          Mostrando{" "}
          <span className="text-foreground font-mono font-medium tabular-nums">
            {products.length}
          </span>{" "}
          de{" "}
          <span className="text-foreground font-mono font-medium tabular-nums">
            {total.toLocaleString("es-VE")}
          </span>{" "}
          productos
        </p>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            <Icons.ArrowBack className="size-4" aria-hidden />
            Anterior
          </Button>
          <span className="text-foreground px-2 font-mono text-sm font-medium tabular-nums">
            {page + 1} / {Math.max(totalPages, 1)}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => (p + 1 < totalPages ? p + 1 : p))}
            disabled={page + 1 >= totalPages}
          >
            Siguiente
            <Icons.ArrowForward className="size-4" aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );
}
