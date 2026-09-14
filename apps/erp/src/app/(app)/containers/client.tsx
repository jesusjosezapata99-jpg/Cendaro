"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@cendaro/ui";
import { Icons } from "@cendaro/ui/icons";
import { StatusPill } from "@cendaro/ui/status-pill";

import { DataTable } from "~/components/data-table/data-table";
import { EmptyState } from "~/components/empty-state";
import { PageHeader } from "~/components/page-header";
import { StatCard } from "~/components/stat-card";
import { useContainerParams } from "~/hooks/params/use-container-params";
import { useBcvRate } from "~/hooks/use-bcv-rate";
import { formatDualCurrency } from "~/lib/format-currency";
import { getStatus } from "~/lib/status";
import { useTRPC } from "~/trpc/client";

interface ContainerItem {
  id: string;
  containerNumber: string;
  status: string;
  departureDate: string | Date | null;
  arrivalDate: string | Date | null;
  costFob: string | number | null;
  notes: string | null;
  createdAt: string | Date;
}

const FILTER_TABS = [
  { key: "all", label: "Todos" },
  { key: "created", label: "Creados" },
  { key: "in_transit", label: "En Tránsito" },
  { key: "received", label: "Recibidos" },
  { key: "closed", label: "Cerrados" },
] as const;

export default function ContainersPage() {
  const trpc = useTRPC();
  const bcv = useBcvRate();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [, setContainerParams] = useContainerParams();

  const {
    data: containers,
    isLoading,
    isError,
    refetch,
  } = useQuery(trpc.container.list.queryOptions());

  const list = useMemo<ContainerItem[]>(() => containers ?? [], [containers]);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return list;
    return list.filter((c) => c.status === statusFilter);
  }, [list, statusFilter]);

  const inTransit = useMemo(
    () => list.filter((c) => c.status === "in_transit").length,
    [list],
  );

  const received = useMemo(
    () => list.filter((c) => c.status === "received").length,
    [list],
  );

  const totalFob = useMemo(
    () => list.reduce((s, c) => s + Number(c.costFob ?? 0), 0),
    [list],
  );

  const dualFob = useMemo(
    () => formatDualCurrency(totalFob, bcv.rate),
    [totalFob, bcv.rate],
  );

  const columns = useMemo<ColumnDef<ContainerItem>[]>(
    () => [
      {
        id: "index",
        header: "#",
        cell: ({ row }) => (
          <span className="text-muted-foreground font-mono text-xs tabular-nums">
            {row.index + 1}
          </span>
        ),
        meta: { className: "w-14 text-center" },
      },
      {
        accessorKey: "containerNumber",
        header: "Contenedor",
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div className="flex flex-col py-1">
              <Link
                href={`/containers/${item.id}`}
                className="text-foreground hover:text-primary font-mono text-sm font-medium transition-colors"
              >
                {item.containerNumber}
              </Link>
              {item.notes && (
                <p className="text-muted-foreground line-clamp-1 max-w-xs text-xs">
                  {item.notes}
                </p>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Estado",
        cell: ({ row }) => {
          const { label, tone } = getStatus("container", row.original.status);
          return <StatusPill tone={tone}>{label}</StatusPill>;
        },
      },
      {
        accessorKey: "departureDate",
        header: "Salida",
        cell: ({ row }) => {
          const date = row.original.departureDate;
          return (
            <span className="text-foreground text-xs">
              {date ? new Date(date).toLocaleDateString("es-VE") : "—"}
            </span>
          );
        },
      },
      {
        accessorKey: "arrivalDate",
        header: "Llegada Est.",
        cell: ({ row }) => {
          const date = row.original.arrivalDate;
          return (
            <span className="text-foreground text-xs">
              {date ? new Date(date).toLocaleDateString("es-VE") : "—"}
            </span>
          );
        },
      },
      {
        accessorKey: "costFob",
        header: () => <span className="block text-right">Costo FOB</span>,
        cell: ({ row }) => {
          const dual = formatDualCurrency(
            Number(row.original.costFob ?? 0),
            bcv.rate,
          );
          return (
            <div className="text-right font-mono tabular-nums">
              <span className="text-foreground font-medium">{dual.usd}</span>
              <span className="text-muted-foreground block text-[11px]">
                {dual.bs}
              </span>
            </div>
          );
        },
        meta: { numeric: true },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Link
              href={`/containers/${row.original.id}`}
              className="border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 inline-flex size-8 items-center justify-center border transition-all"
              title="Ver detalle de contenedor"
            >
              <Icons.ChevronRight className="size-4" />
            </Link>
          </div>
        ),
        meta: { className: "w-16 text-right" },
      },
    ],
    [bcv.rate],
  );

  return (
    <div className="space-y-6 py-4 lg:py-8">
      {/* Page Header */}
      <PageHeader
        title="Contenedores & Importaciones"
        description="Gestión logística de importaciones internacionales, costeo FOB y recepción de carga"
        actions={
          <Button
            onClick={() => void setContainerParams({ createContainer: true })}
            className="min-h-11 w-full gap-2 sm:w-auto"
          >
            <Icons.Add className="size-4.5" />
            Nuevo Contenedor
          </Button>
        }
      />

      {/* 4 StatCards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Contenedores"
          value={isLoading ? "—" : list.length}
          icon="Package2"
          tone="default"
          sub="En todas las fases del flujo"
        />
        <StatCard
          label="En Tránsito"
          value={isLoading ? "—" : inTransit}
          icon="DirectionsBoat"
          tone="primary"
          sub="Carga marítima / aérea en curso"
        />
        <StatCard
          label="En Puerto / Recepción"
          value={isLoading ? "—" : received}
          icon="MoveToInbox"
          tone="warning"
          sub="Pendientes por descargar o verificar"
        />
        <StatCard
          label="Inversión FOB Total"
          value={isLoading ? "—" : dualFob.usd}
          icon="AttachMoney"
          tone="success"
          sub={`Equivalente oficial: ${dualFob.bs}`}
        />
      </div>

      {/* Filter Tabs (Horizontal Scrollable) */}
      <div className="mobile-scroll-x border-border flex gap-1 border-b pb-3">
        {FILTER_TABS.map((tab) => {
          const isActive = statusFilter === tab.key;
          const count =
            tab.key === "all"
              ? list.length
              : list.filter((c) => c.status === tab.key).length;

          return (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`flex min-h-9 shrink-0 items-center gap-2 border px-3 py-1.5 text-xs font-medium transition-all ${
                isActive
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.5 font-mono text-[10px] tabular-nums ${
                  isActive
                    ? "bg-background/20 text-background"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main List Body */}
      {isLoading ? (
        <div className="border-border bg-card border">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="border-border flex h-11.25 animate-pulse items-center border-b px-4 last:border-b-0"
            >
              <div className="bg-muted h-4 w-12" />
              <div className="bg-muted ml-6 h-4 w-32" />
              <div className="bg-muted ml-6 h-4 w-20" />
              <div className="bg-muted ml-auto h-4 w-24" />
            </div>
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <>
          {/* Mobile Cards View (md:hidden) */}
          <div className="space-y-3 md:hidden">
            {filtered.map((container) => {
              const { label, tone } = getStatus("container", container.status);
              const dual = formatDualCurrency(
                Number(container.costFob ?? 0),
                bcv.rate,
              );

              return (
                <Link
                  key={container.id}
                  href={`/containers/${container.id}`}
                  className="border-border bg-card hover:border-foreground/40 block border p-4 transition-all active:scale-[0.99]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-foreground font-mono text-base font-medium">
                        {container.containerNumber}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {container.departureDate
                          ? `Salida: ${new Date(container.departureDate).toLocaleDateString("es-VE")}`
                          : "Fecha salida no definida"}
                      </p>
                    </div>
                    <StatusPill tone={tone}>{label}</StatusPill>
                  </div>

                  <div className="border-border mt-3.5 grid grid-cols-2 gap-2 border-t pt-3 text-xs">
                    <div>
                      <p className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                        Llegada Estimada
                      </p>
                      <p className="text-foreground mt-0.5 font-medium">
                        {container.arrivalDate
                          ? new Date(container.arrivalDate).toLocaleDateString(
                              "es-VE",
                            )
                          : "—"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                        Costo FOB
                      </p>
                      <p className="text-foreground mt-0.5 font-mono font-medium tabular-nums">
                        {dual.usd}
                      </p>
                      <p className="text-muted-foreground font-mono text-[10px] tabular-nums">
                        {dual.bs}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Desktop Table View (hidden md:block) */}
          <div className="hidden md:block">
            <DataTable
              columns={columns}
              data={filtered}
              isLoading={isLoading}
              isError={isError}
              onRetry={() => void refetch()}
              onResetFilters={
                statusFilter !== "all"
                  ? () => setStatusFilter("all")
                  : undefined
              }
              emptyTitle="No hay contenedores registrados"
              emptyDescription="No se encontraron contenedores para el criterio seleccionado."
            />
          </div>
        </>
      ) : (
        <div className="border-border bg-card border p-12">
          <EmptyState
            icon="Package2"
            title="No hay contenedores registrados"
            description={
              statusFilter === "all"
                ? "Aún no se han registrado contenedores de importación en el sistema."
                : `No se encontraron contenedores en estado "${getStatus("container", statusFilter).label}".`
            }
            action={
              <Button
                onClick={() =>
                  void setContainerParams({ createContainer: true })
                }
                className="gap-2"
              >
                <Icons.Add className="size-4" />
                Registrar Contenedor
              </Button>
            }
          />
        </div>
      )}
    </div>
  );
}
