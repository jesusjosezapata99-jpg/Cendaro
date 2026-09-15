"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";

import { Button, Input } from "@cendaro/ui";
import { Icons } from "@cendaro/ui/icons";
import { StatusPill } from "@cendaro/ui/status-pill";

import { DataTable } from "~/components/data-table/data-table";
import { PageHeader } from "~/components/page-header";
import { useTRPC } from "~/trpc/client";

const CreateSupplierDialog = dynamic(
  () =>
    import("~/components/forms/create-supplier").then((m) => ({
      default: m.CreateSupplierDialog,
    })),
  { ssr: false },
);

interface SupplierItem {
  id: string;
  name: string;
  country: string;
  contactName: string | null;
  contactEmail: string | null;
  status: string;
}

export default function SuppliersPage() {
  const trpc = useTRPC();
  const {
    data: suppliers,
    isLoading,
    isError,
    refetch,
  } = useQuery(trpc.catalog.listSuppliers.queryOptions());
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const items = useMemo(() => (suppliers ?? []) as SupplierItem[], [suppliers]);

  const filtered = useMemo(() => {
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.contactName ?? "").toLowerCase().includes(q) ||
        (s.contactEmail ?? "").toLowerCase().includes(q) ||
        s.country.toLowerCase().includes(q),
    );
  }, [items, search]);

  const columns = useMemo<ColumnDef<SupplierItem>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Proveedor",
        meta: { className: "w-56 font-medium text-foreground" },
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span className="text-foreground truncate text-xs font-medium">
              {row.original.name}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "country",
        header: "País",
        meta: { className: "w-28 font-mono text-xs" },
        cell: ({ row }) => (
          <span className="border-border bg-muted/40 text-muted-foreground inline-flex items-center border px-2 py-0.5 font-mono text-[11px] font-medium tracking-wider uppercase">
            {row.original.country}
          </span>
        ),
      },
      {
        accessorKey: "contactName",
        header: "Contacto",
        meta: { className: "w-48 text-muted-foreground text-xs" },
        cell: ({ row }) => (
          <span className="text-muted-foreground truncate text-xs">
            {row.original.contactName ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "contactEmail",
        header: "Email",
        meta: { className: "w-56 font-mono text-xs text-muted-foreground" },
        cell: ({ row }) => (
          <span className="text-muted-foreground truncate font-mono text-xs">
            {row.original.contactEmail ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Estado",
        meta: { align: "center", className: "w-28 text-center" },
        cell: ({ row }) => {
          const isActive = row.original.status === "active";
          return (
            <StatusPill tone={isActive ? "success" : "neutral"}>
              {isActive ? "Activo" : "Inactivo"}
            </StatusPill>
          );
        },
      },
    ],
    [],
  );

  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 space-y-6 py-4 duration-200 lg:py-8">
      <PageHeader
        title="Proveedores"
        description={`${items.length.toLocaleString("es-VE")} proveedores registrados`}
        actions={
          <Button
            onClick={() => setShowCreate(true)}
            className="h-9 px-3 text-xs"
          >
            <Icons.Add className="mr-1.5 size-4" />
            Nuevo Proveedor
          </Button>
        }
      />

      <CreateSupplierDialog
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
          placeholder="Buscar proveedor o contacto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 pl-9 text-xs"
        />
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => void refetch()}
        onResetFilters={search ? () => setSearch("") : undefined}
        emptyTitle="No se encontraron proveedores"
        emptyDescription="Ajusta la búsqueda o registra un nuevo proveedor para empezar."
      />
    </div>
  );
}
