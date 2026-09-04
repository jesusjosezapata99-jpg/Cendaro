"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "~/trpc/client";

const CreateSupplierDialog = dynamic(
  () =>
    import("~/components/forms/create-supplier").then((m) => ({
      default: m.CreateSupplierDialog,
    })),
  { ssr: false },
);

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`bg-muted animate-pulse rounded-lg ${className}`} />;
}

const COUNTRY_FLAGS: Record<string, string> = {
  CN: "🇨🇳",
  VE: "🇻🇪",
  US: "🇺🇸",
  CO: "🇨🇴",
};

export default function SuppliersPage() {
  const trpc = useTRPC();
  const { data: suppliers, isLoading } = useQuery(
    trpc.catalog.listSuppliers.queryOptions(),
  );
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const filtered = (suppliers ?? []).filter(
    (s) =>
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.contactName ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-black tracking-tight">
            Proveedores
          </h1>
          <p className="text-muted-foreground text-sm">
            {suppliers?.length ?? 0} proveedores registrados
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
        >
          <span className="material-symbols-outlined text-lg">add</span> Nuevo
          Proveedor
        </button>
      </div>

      <CreateSupplierDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
      />

      <input
        type="text"
        placeholder="Buscar proveedor o contacto..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="border-border bg-card text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-ring/20 w-full rounded-lg border px-4 py-2.5 text-sm outline-none focus:ring-2"
      />

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : (
        <div className="border-border bg-card overflow-hidden rounded-xl border">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-border text-muted-foreground border-b text-xs uppercase">
                <th className="px-4 py-3 font-medium">Proveedor</th>
                <th className="px-4 py-3 font-medium">País</th>
                <th className="px-4 py-3 font-medium">Contacto</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((supplier) => (
                <tr
                  key={supplier.id}
                  className="border-border hover:bg-accent/50 border-b transition-colors"
                >
                  <td className="text-foreground px-4 py-3 font-medium">
                    {supplier.name}
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5 text-sm">
                      <span>{COUNTRY_FLAGS[supplier.country] ?? "🌐"}</span>
                      <span className="text-muted-foreground">
                        {supplier.country}
                      </span>
                    </span>
                  </td>
                  <td className="text-muted-foreground px-4 py-3">
                    {supplier.contactName ?? "—"}
                  </td>
                  <td className="text-muted-foreground px-4 py-3">
                    {supplier.contactEmail ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${supplier.status === "active" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}
                    >
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
        <div className="border-border bg-card text-muted-foreground flex flex-col items-center justify-center rounded-xl border py-12">
          <span className="material-symbols-outlined mb-2 text-3xl">
            local_shipping
          </span>
          <p className="text-sm">No se encontraron proveedores</p>
        </div>
      )}
    </div>
  );
}
