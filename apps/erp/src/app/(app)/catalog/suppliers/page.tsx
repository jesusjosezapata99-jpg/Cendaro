"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useTRPC } from "~/trpc/client";
import { useQuery } from "@tanstack/react-query";

const CreateSupplierDialog = dynamic(
  () => import("~/components/forms/create-supplier").then((m) => ({ default: m.CreateSupplierDialog })),
  { ssr: false },
);

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-muted ${className}`} />;
}

const COUNTRY_FLAGS: Record<string, string> = { CN: "🇨🇳", VE: "🇻🇪", US: "🇺🇸", CO: "🇨🇴" };

export default function SuppliersPage() {
  const trpc = useTRPC();
  const { data: suppliers, isLoading } = useQuery(trpc.catalog.listSuppliers.queryOptions());
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const filtered = (suppliers ?? []).filter(
    (s) =>
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.contactName ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">Proveedores</h1>
          <p className="text-sm text-muted-foreground">
            {suppliers?.length ?? 0} proveedores registrados
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
          <span className="material-symbols-outlined text-lg">add</span> Nuevo Proveedor
        </button>
      </div>

      <CreateSupplierDialog open={showCreate} onClose={() => setShowCreate(false)} />

      <input
        type="text"
        placeholder="Buscar proveedor o contacto..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/20"
      />

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase text-muted-foreground">
                <th className="px-4 py-3 font-medium">Proveedor</th>
                <th className="px-4 py-3 font-medium">País</th>
                <th className="px-4 py-3 font-medium">Contacto</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((supplier) => (
                <tr key={supplier.id} className="border-b border-border transition-colors hover:bg-accent/50">
                  <td className="px-4 py-3 font-medium text-foreground">{supplier.name}</td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5 text-sm">
                      <span>{COUNTRY_FLAGS[supplier.country] ?? "🌐"}</span>
                      <span className="text-muted-foreground">{supplier.country}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{supplier.contactName ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{supplier.contactEmail ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${supplier.status === "active" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                      {supplier.status === "active" ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filtered.length === 0 && !isLoading && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-12 text-muted-foreground">
          <span className="material-symbols-outlined text-3xl mb-2">local_shipping</span>
          <p className="text-sm">No se encontraron proveedores</p>
        </div>
      )}
    </div>
  );
}
