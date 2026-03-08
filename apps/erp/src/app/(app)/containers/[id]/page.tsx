"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useTRPC } from "~/trpc/client";
import { useQuery } from "@tanstack/react-query";

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-muted ${className}`} />;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  created: { label: "Creado", color: "bg-secondary text-muted-foreground", icon: "draft" },
  in_transit: { label: "En Tránsito", color: "bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400", icon: "directions_boat" },
  received: { label: "Recibido", color: "bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400", icon: "move_to_inbox" },
  closed: { label: "Cerrado", color: "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400", icon: "check_circle" },
};

export default function ContainerDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const trpc = useTRPC();

  const { data: container, isLoading } = useQuery(
    trpc.container.byId.queryOptions({ id }),
  );

  if (isLoading) {
    return (
      <div className="p-4 lg:p-8 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      </div>
    );
  }

  if (!container) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
        <span className="material-symbols-outlined text-5xl mb-3">package_2</span>
        <p className="text-lg font-medium">Contenedor no encontrado</p>
        <Link href="/containers" className="mt-4 text-sm text-primary hover:underline">← Volver a contenedores</Link>
      </div>
    );
  }

  const cfg = STATUS_CONFIG[container.status] ?? { label: container.status, color: "", icon: "draft" };

  return (
    <div className="p-4 lg:p-8 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/containers" className="hover:text-foreground transition-colors">Contenedores</Link>
        <span className="material-symbols-outlined text-base">chevron_right</span>
        <span className="font-medium text-foreground">{container.containerNumber}</span>
      </div>

      {/* Header */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-3xl text-muted-foreground">{cfg.icon}</span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight font-mono">{container.containerNumber}</h1>
              <p className="text-sm text-muted-foreground">Contenedor de importación</p>
            </div>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${cfg.color}`}>{cfg.label}</span>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Estado", value: cfg.label, icon: "flag" },
          { label: "Costo FOB", value: `$${Number(container.costFob ?? 0).toLocaleString()}`, icon: "attach_money" },
          { label: "Salida", value: container.departureDate ? new Date(container.departureDate).toLocaleDateString("es-VE") : "—", icon: "flight_takeoff" },
          { label: "Llegada", value: container.arrivalDate ? new Date(container.arrivalDate).toLocaleDateString("es-VE") : "—", icon: "flight_land" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-lg text-muted-foreground">{stat.icon}</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{stat.label}</span>
            </div>
            <p className="mt-1 text-lg font-bold">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Details */}
      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-muted-foreground">Información del Contenedor</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { label: "Número", value: container.containerNumber },
            { label: "Estado", value: cfg.label },
            { label: "Costo FOB", value: `$${Number(container.costFob ?? 0).toLocaleString()}` },
            { label: "Fecha Salida", value: container.departureDate ? new Date(container.departureDate).toLocaleDateString("es-VE") : "—" },
            { label: "Fecha Llegada", value: container.arrivalDate ? new Date(container.arrivalDate).toLocaleDateString("es-VE") : "—" },
            { label: "Creado", value: new Date(container.createdAt).toLocaleDateString("es-VE") },
          ].map((d) => (
            <div key={d.label} className="flex items-center justify-between rounded-lg border border-border p-3">
              <span className="text-sm text-muted-foreground">{d.label}</span>
              <span className="text-sm font-semibold">{d.value}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
