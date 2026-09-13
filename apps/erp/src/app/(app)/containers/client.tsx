"use client";

import { lazy, Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import type { IconName } from "@cendaro/ui/icons";
import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@cendaro/ui";
import { Icon, Icons } from "@cendaro/ui/icons";

import type { StatusTone } from "~/components/status-badge";
import { EmptyState } from "~/components/empty-state";
import { PageHeader } from "~/components/page-header";
import { Skeleton } from "~/components/skeleton";
import { StatCard } from "~/components/stat-card";
import { StatusBadge } from "~/components/status-badge";
import { useBcvRate } from "~/hooks/use-bcv-rate";
import { formatDualCurrency } from "~/lib/format-currency";
import { useTRPC } from "~/trpc/client";

const CreateContainerDialog = lazy(() =>
  import("~/components/forms/create-container").then((m) => ({
    default: m.CreateContainerDialog,
  })),
);

const STATUS_CONFIG: Record<
  string,
  { label: string; tone: StatusTone; icon: IconName }
> = {
  created: {
    label: "Creado",
    tone: "neutral",
    icon: "Draft",
  },
  in_transit: {
    label: "En Tránsito",
    tone: "primary",
    icon: "DirectionsBoat",
  },
  received: {
    label: "Recibido",
    tone: "warning",
    icon: "MoveToInbox",
  },
  closed: {
    label: "Cerrado",
    tone: "success",
    icon: "CheckCircle",
  },
};

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
  const [showCreate, setShowCreate] = useState(false);

  const { data: containers, isLoading } = useQuery(
    trpc.container.list.queryOptions(),
  );

  const list = useMemo(() => containers ?? [], [containers]);

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

  return (
    <div className="space-y-6 py-4 lg:py-8">
      {/* Page Header */}
      <PageHeader
        title="Contenedores & Importaciones"
        description="Gestión logística de importaciones internacionales, costeo FOB y recepción de carga"
      >
        <Button
          onClick={() => setShowCreate(true)}
          className="min-h-11 w-full gap-2 sm:w-auto"
        >
          <Icons.Add className="size-4.5" />
          Nuevo Contenedor
        </Button>
      </PageHeader>

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
      <div className="mobile-scroll-x border-border-subtle flex gap-2 border-b pb-3">
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
              className={`flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium transition-all ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-surface-card text-muted-foreground hover:bg-accent hover:text-foreground border-border-subtle border"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] tabular-nums ${
                  isActive
                    ? "bg-primary-foreground/20 text-primary-foreground"
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
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <>
          {/* Mobile Cards View (md:hidden) */}
          <div className="space-y-3 md:hidden">
            {filtered.map((container) => {
              const cfg = STATUS_CONFIG[container.status] ?? {
                label: container.status,
                tone: "neutral" as StatusTone,
                icon: "Draft" as const,
              };
              const dual = formatDualCurrency(
                Number(container.costFob ?? 0),
                bcv.rate,
              );

              return (
                <Link
                  key={container.id}
                  href={`/containers/${container.id}`}
                  className="surface-card border-border-subtle hover:border-primary/40 block rounded-xl border p-4 transition-all active:scale-[0.99]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg">
                        <Icon name={cfg.icon} className="size-4.5" />
                      </div>
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
                    </div>
                    <StatusBadge tone={cfg.tone}>{cfg.label}</StatusBadge>
                  </div>

                  <div className="border-border-subtle/60 mt-3.5 grid grid-cols-2 gap-2 border-t pt-3 text-xs">
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
          <div className="surface-card border-border-subtle hidden overflow-hidden rounded-xl border md:block">
            <Table>
              <TableHeader>
                <TableRow className="border-border-subtle hover:bg-transparent">
                  <TableHead className="w-14 text-center">#</TableHead>
                  <TableHead>Contenedor</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Salida</TableHead>
                  <TableHead>Llegada Est.</TableHead>
                  <TableHead className="text-right">
                    Costo FOB (USD / Bs)
                  </TableHead>
                  <TableHead className="w-24 text-center">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((container, idx) => {
                  const cfg = STATUS_CONFIG[container.status] ?? {
                    label: container.status,
                    tone: "neutral" as StatusTone,
                    icon: "Draft" as const,
                  };
                  const dual = formatDualCurrency(
                    Number(container.costFob ?? 0),
                    bcv.rate,
                  );

                  return (
                    <TableRow
                      key={container.id}
                      className="border-border-subtle hover:bg-accent/40 transition-colors"
                    >
                      <TableCell className="text-muted-foreground text-center font-mono text-xs tabular-nums">
                        {idx + 1}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-md">
                            <Icon name={cfg.icon} className="size-4" />
                          </div>
                          <div>
                            <Link
                              href={`/containers/${container.id}`}
                              className="text-foreground hover:text-primary font-mono text-sm font-medium transition-colors"
                            >
                              {container.containerNumber}
                            </Link>
                            {container.notes && (
                              <p className="text-muted-foreground line-clamp-1 max-w-xs text-xs">
                                {container.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge tone={cfg.tone}>{cfg.label}</StatusBadge>
                      </TableCell>
                      <TableCell className="text-foreground text-xs">
                        {container.departureDate
                          ? new Date(
                              container.departureDate,
                            ).toLocaleDateString("es-VE")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-foreground text-xs">
                        {container.arrivalDate
                          ? new Date(container.arrivalDate).toLocaleDateString(
                              "es-VE",
                            )
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        <span className="text-foreground font-medium">
                          {dual.usd}
                        </span>
                        <span className="text-muted-foreground block text-[11px]">
                          {dual.bs}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Link
                          href={`/containers/${container.id}`}
                          className="border-border-subtle text-muted-foreground hover:border-primary hover:bg-primary/10 hover:text-primary inline-flex size-9 items-center justify-center rounded-lg border transition-all"
                          title="Ver detalle de contenedor"
                        >
                          <Icons.ChevronRight className="size-4.5" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      ) : (
        <EmptyState
          icon="Package2"
          title="No hay contenedores registrados"
          description={
            statusFilter === "all"
              ? "Aún no se han registrado contenedores de importación en el sistema."
              : `No se encontraron contenedores en estado "${STATUS_CONFIG[statusFilter]?.label ?? statusFilter}".`
          }
          action={
            <Button onClick={() => setShowCreate(true)} className="gap-2">
              <Icons.Add className="size-4" />
              Registrar Contenedor
            </Button>
          }
        />
      )}

      {/* Modal create container */}
      <Suspense fallback={null}>
        <CreateContainerDialog
          open={showCreate}
          onClose={() => setShowCreate(false)}
        />
      </Suspense>
    </div>
  );
}
