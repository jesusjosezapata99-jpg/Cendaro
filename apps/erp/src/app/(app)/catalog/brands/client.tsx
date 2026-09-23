"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";

import { Button, Input } from "@cendaro/ui";
import { Icons } from "@cendaro/ui/icons";

import { EmptyState } from "~/components/empty-state";
import { PageHeader } from "~/components/page-header";
import { Can } from "~/components/role-guard";
import { Skeleton } from "~/components/skeleton";
import { useTRPC } from "~/trpc/client";

const CreateBrandDialog = dynamic(
  () =>
    import("~/components/forms/create-brand").then((m) => ({
      default: m.CreateBrandDialog,
    })),
  { ssr: false },
);

/** Brand avatar chips rotate through the system chart palette. */
const AVATAR_TONES = [
  "bg-chart-1/10 text-chart-1 border-chart-1/20",
  "bg-chart-2/10 text-chart-2 border-chart-2/20",
  "bg-chart-3/10 text-chart-3 border-chart-3/20",
  "bg-chart-4/10 text-chart-4 border-chart-4/20",
  "bg-chart-5/10 text-chart-5 border-chart-5/20",
];

export default function BrandsPage() {
  const trpc = useTRPC();
  const { data: brands, isLoading } = useQuery(
    trpc.catalog.listBrands.queryOptions(),
  );
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const filtered = (brands ?? []).filter(
    (b) =>
      !search ||
      b.name.toLowerCase().includes(search.toLowerCase()) ||
      b.slug.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 space-y-6 py-4 duration-200 lg:py-8">
      <PageHeader
        title="Marcas"
        description={`${(brands?.length ?? 0).toLocaleString("es-VE")} marcas registradas en el catálogo`}
        actions={
          <Can module="catalog" action="create">
            <Button
              onClick={() => setShowCreate(true)}
              className="h-9 px-3 text-xs"
            >
              <Icons.Add className="mr-1.5 size-4" />
              Nueva Marca
            </Button>
          </Can>
        }
      />

      <CreateBrandDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
      />

      {/* Search */}
      <div className="relative">
        <Icons.Search
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2"
          aria-hidden
        />
        <Input
          type="text"
          placeholder="Buscar marca..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 pl-9 text-xs"
        />
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="border-border bg-card border p-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="mt-3 h-4 w-20" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((brand, idx) => {
            const initials = brand.name.slice(0, 2).toUpperCase();
            const tone = AVATAR_TONES[idx % AVATAR_TONES.length];
            return (
              <div
                key={brand.id}
                className="border-border bg-card hover:border-foreground/40 group border p-4 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    aria-hidden
                    className={`flex size-10 shrink-0 items-center justify-center border font-mono text-xs font-medium ${tone}`}
                  >
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-foreground group-hover:text-primary truncate text-sm font-medium transition-colors">
                      {brand.name}
                    </p>
                    <p className="text-muted-foreground truncate font-mono text-xs">
                      /{brand.slug}
                    </p>
                  </div>
                </div>
                <p className="text-muted-foreground mt-3 truncate text-xs">
                  {brand.description ?? "Sin descripción"}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {filtered.length === 0 && !isLoading && (
        <EmptyState
          icon="LabelOff"
          title="No se encontraron marcas"
          description="Ajusta la búsqueda o crea una nueva marca para empezar."
        />
      )}
    </div>
  );
}
