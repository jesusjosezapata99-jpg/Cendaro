"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";

import {
  Button,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@cendaro/ui";

import { EmptyState } from "~/components/empty-state";
import { PageHeader } from "~/components/page-header";
import { Skeleton } from "~/components/skeleton";
import { StatusBadge } from "~/components/status-badge";
import { useTRPC } from "~/trpc/client";

const CreateSupplierDialog = dynamic(
  () =>
    import("~/components/forms/create-supplier").then((m) => ({
      default: m.CreateSupplierDialog,
    })),
  { ssr: false },
);

const cellPx = "px-4 py-3";

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
    <div className="animate-in fade-in slide-in-from-bottom-1 space-y-6 p-4 duration-200 lg:p-8">
      <PageHeader
        title="Proveedores"
        description={`${(suppliers?.length ?? 0).toLocaleString("es-VE")} proveedores registrados`}
        actions={
          <Button onClick={() => setShowCreate(true)} className="min-h-11">
            <span className="material-symbols-outlined text-lg">add</span>
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
        <span
          aria-hidden
          className="material-symbols-outlined text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-base"
        >
          search
        </span>
        <Input
          type="text"
          placeholder="Buscar proveedor o contacto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-h-11 pl-10"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="border-border-subtle surface-card gap-0 overflow-hidden rounded-xl border py-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead
                  className={`text-muted-foreground ${cellPx} text-xs font-medium tracking-widest uppercase`}
                >
                  Proveedor
                </TableHead>
                <TableHead
                  className={`text-muted-foreground ${cellPx} text-xs font-medium tracking-widest uppercase`}
                >
                  País
                </TableHead>
                <TableHead
                  className={`text-muted-foreground ${cellPx} text-xs font-medium tracking-widest uppercase`}
                >
                  Contacto
                </TableHead>
                <TableHead
                  className={`text-muted-foreground ${cellPx} text-xs font-medium tracking-widest uppercase`}
                >
                  Email
                </TableHead>
                <TableHead
                  className={`text-muted-foreground ${cellPx} text-xs font-medium tracking-widest uppercase`}
                >
                  Estado
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((supplier) => (
                <TableRow key={supplier.id}>
                  <TableCell
                    className={`text-foreground ${cellPx} font-medium`}
                  >
                    {supplier.name}
                  </TableCell>
                  <TableCell className={cellPx}>
                    <span className="border-border-subtle bg-muted/50 text-muted-foreground inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-xs font-medium tracking-wider">
                      {supplier.country}
                    </span>
                  </TableCell>
                  <TableCell
                    className={`text-muted-foreground ${cellPx} text-sm`}
                  >
                    {supplier.contactName ?? "—"}
                  </TableCell>
                  <TableCell
                    className={`text-muted-foreground ${cellPx} text-sm`}
                  >
                    {supplier.contactEmail ?? "—"}
                  </TableCell>
                  <TableCell className={cellPx}>
                    <StatusBadge
                      tone={
                        supplier.status === "active" ? "success" : "neutral"
                      }
                    >
                      {supplier.status === "active" ? "Activo" : "Inactivo"}
                    </StatusBadge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {filtered.length === 0 && !isLoading && (
        <EmptyState
          icon="local_shipping"
          title="No se encontraron proveedores"
          description="Ajusta la búsqueda o registra un nuevo proveedor para empezar."
        />
      )}
    </div>
  );
}
