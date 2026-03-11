"use client";

import { lazy, Suspense, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "~/trpc/client";

const CreateContainerDialog = lazy(() =>
  import("~/components/forms/create-container").then((m) => ({
    default: m.CreateContainerDialog,
  })),
);

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`bg-muted animate-pulse rounded-lg ${className}`} />;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: string }
> = {
  created: {
    label: "Creado",
    color: "bg-secondary text-muted-foreground",
    icon: "draft",
  },
  in_transit: {
    label: "En Tránsito",
    color: "bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400",
    icon: "directions_boat",
  },
  received: {
    label: "Recibido",
    color:
      "bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400",
    icon: "move_to_inbox",
  },
  closed: {
    label: "Cerrado",
    color:
      "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
    icon: "check_circle",
  },
};

export default function ContainersPage() {
  const trpc = useTRPC();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);
  const { data: containers, isLoading } = useQuery(
    trpc.container.list.queryOptions(),
  );

  const list = containers ?? [];
  const filtered =
    statusFilter === "all"
      ? list
      : list.filter((c) => c.status === statusFilter);
  const inTransit = list.filter((c) => c.status === "in_transit").length;
  const pending = list.filter((c) => c.status === "received").length;
  const totalFob = list.reduce((s, c) => s + Number(c.costFob ?? 0), 0);

  return (
    <>
      <div className="space-y-6 p-4 lg:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-foreground text-2xl font-black tracking-tight">
              Contenedores
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Gestión de importaciones y recepción de mercancía
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="bg-primary text-primary-foreground hover:bg-primary/90 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition-colors sm:w-auto"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            Nuevo Contenedor
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          {[
            {
              label: "Total",
              value: isLoading ? "—" : list.length,
              icon: "package_2",
              accent: "border-blue-500/40",
            },
            {
              label: "En Tránsito",
              value: isLoading ? "—" : inTransit,
              icon: "directions_boat",
              accent: "border-cyan-500/40",
            },
            {
              label: "Pendientes",
              value: isLoading ? "—" : pending,
              icon: "move_to_inbox",
              accent: "border-amber-500/40",
            },
            {
              label: "FOB Total",
              value: isLoading ? "—" : `$${totalFob.toLocaleString()}`,
              icon: "attach_money",
              accent: "border-emerald-500/40",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className={`rounded-xl border-l-4 ${stat.accent} bg-card border-border border p-4`}
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-muted-foreground text-lg">
                  {stat.icon}
                </span>
                <span className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
                  {stat.label}
                </span>
              </div>
              <p className="text-foreground mt-1 text-2xl font-bold">
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          {["all", "created", "in_transit", "received", "closed"].map(
            (status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                  statusFilter === status
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:bg-accent"
                }`}
              >
                {status === "all"
                  ? "Todos"
                  : (STATUS_CONFIG[status]?.label ?? status)}
              </button>
            ),
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <div className="space-y-3">
            {filtered.map((container) => {
              const cfg = STATUS_CONFIG[container.status] ?? {
                label: container.status,
                color: "",
                icon: "draft",
              };
              return (
                <Link
                  key={container.id}
                  href={`/containers/${container.id}`}
                  className="border-border bg-card hover:border-primary/30 block rounded-xl border p-5 transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-muted-foreground text-2xl">
                        {cfg.icon}
                      </span>
                      <div>
                        <h3 className="text-foreground font-mono text-lg font-bold">
                          {container.containerNumber}
                        </h3>
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${cfg.color}`}
                    >
                      {cfg.label}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <div>
                      <p className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
                        Salida
                      </p>
                      <p className="text-foreground text-sm">
                        {container.departureDate
                          ? new Date(
                              container.departureDate,
                            ).toLocaleDateString("es-VE")
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
                        Llegada Est.
                      </p>
                      <p className="text-foreground text-sm">
                        {container.arrivalDate
                          ? new Date(container.arrivalDate).toLocaleDateString(
                              "es-VE",
                            )
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
                        Costo FOB
                      </p>
                      <p className="text-foreground font-mono text-sm font-bold">
                        ${Number(container.costFob ?? 0).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
                        Estado
                      </p>
                      <p className="text-foreground text-sm">{cfg.label}</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="text-muted-foreground flex flex-col items-center justify-center py-12">
            <span className="material-symbols-outlined mb-2 text-4xl">
              package_2
            </span>
            <p className="text-sm">No hay contenedores registrados</p>
          </div>
        )}
      </div>

      <Suspense>
        <CreateContainerDialog
          open={showCreate}
          onClose={() => setShowCreate(false)}
        />
      </Suspense>
    </>
  );
}
