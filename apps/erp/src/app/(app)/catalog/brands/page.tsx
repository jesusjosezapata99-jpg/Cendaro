"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useTRPC } from "~/trpc/client";
import { useQuery } from "@tanstack/react-query";

const CreateBrandDialog = dynamic(
  () => import("~/components/forms/create-brand").then((m) => ({ default: m.CreateBrandDialog })),
  { ssr: false },
);

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-muted ${className}`} />;
}

const COLORS = [
  "bg-amber-600", "bg-pink-600", "bg-orange-600", "bg-cyan-600",
  "bg-yellow-600", "bg-violet-600", "bg-emerald-600", "bg-slate-600",
  "bg-primary", "bg-red-600", "bg-blue-600", "bg-rose-600",
];

export default function BrandsPage() {
  const trpc = useTRPC();
  const { data: brands, isLoading } = useQuery(trpc.catalog.listBrands.queryOptions());
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const filtered = (brands ?? []).filter(
    (b) =>
      !search ||
      b.name.toLowerCase().includes(search.toLowerCase()) ||
      b.slug.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="p-4 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">Marcas</h1>
          <p className="text-sm text-muted-foreground">
            {brands?.length ?? 0} marcas registradas en el catálogo
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
          <span className="material-symbols-outlined text-lg">add</span> Nueva Marca
        </button>
      </div>

      <CreateBrandDialog open={showCreate} onClose={() => setShowCreate(false)} />

      {/* Search */}
      <input
        type="text"
        placeholder="Buscar marca..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/20"
      />

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4">
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
                className="group rounded-xl border border-border bg-card p-4 transition-all hover:border-blue-500/30 hover:bg-secondary/60"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-xl ${color} text-sm font-bold text-foreground`}
                  >
                    {initials}
                  </div>
                  <div>
                    <p className="font-medium text-foreground group-hover:text-primary">
                      {brand.name}
                    </p>
                    <p className="text-xs text-muted-foreground">/{brand.slug}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {brand.description ?? "Sin descripción"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {filtered.length === 0 && !isLoading && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-12 text-muted-foreground">
          <span className="material-symbols-outlined text-3xl mb-2">label_off</span>
          <p className="text-sm">No se encontraron marcas</p>
        </div>
      )}
    </div>
  );
}
