"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "~/trpc/client";

const CreateBrandDialog = dynamic(
  () =>
    import("~/components/forms/create-brand").then((m) => ({
      default: m.CreateBrandDialog,
    })),
  { ssr: false },
);

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`bg-muted animate-pulse rounded-lg ${className}`} />;
}

const COLORS = [
  "bg-amber-600",
  "bg-pink-600",
  "bg-orange-600",
  "bg-cyan-600",
  "bg-yellow-600",
  "bg-violet-600",
  "bg-emerald-600",
  "bg-slate-600",
  "bg-primary",
  "bg-red-600",
  "bg-blue-600",
  "bg-rose-600",
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
    <div className="space-y-6 p-4 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-black tracking-tight">
            Marcas
          </h1>
          <p className="text-muted-foreground text-sm">
            {brands?.length ?? 0} marcas registradas en el catálogo
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
        >
          <span className="material-symbols-outlined text-lg">add</span> Nueva
          Marca
        </button>
      </div>

      <CreateBrandDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
      />

      {/* Search */}
      <input
        type="text"
        placeholder="Buscar marca..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="border-border bg-card text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-ring/20 w-full rounded-lg border px-4 py-2.5 text-sm outline-none focus:ring-2"
      />

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="border-border bg-card rounded-xl border p-4"
            >
              <Skeleton className="h-12 w-full" />
              <Skeleton className="mt-3 h-4 w-20" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((brand, idx) => {
            const initials = brand.name.slice(0, 2).toUpperCase();
            const color = COLORS[idx % COLORS.length];
            return (
              <div
                key={brand.id}
                className="group border-border bg-card hover:bg-secondary/60 rounded-xl border p-4 transition-all hover:border-blue-500/30"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-xl ${color} text-foreground text-sm font-bold`}
                  >
                    {initials}
                  </div>
                  <div>
                    <p className="text-foreground group-hover:text-primary font-medium">
                      {brand.name}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      /{brand.slug}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-muted-foreground text-xs">
                    {brand.description ?? "Sin descripción"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {filtered.length === 0 && !isLoading && (
        <div className="border-border bg-card text-muted-foreground flex flex-col items-center justify-center rounded-xl border py-12">
          <span className="material-symbols-outlined mb-2 text-3xl">
            label_off
          </span>
          <p className="text-sm">No se encontraron marcas</p>
        </div>
      )}
    </div>
  );
}
