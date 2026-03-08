"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useTRPC } from "~/trpc/client";
import { useQuery } from "@tanstack/react-query";

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-muted ${className}`} />;
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  wholesale: { label: "Mayorista", color: "bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400" },
  retail: { label: "Detal", color: "bg-secondary text-muted-foreground" },
  distributor: { label: "Distribuidor", color: "bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400" },
  vip: { label: "VIP", color: "bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400" },
  marketplace: { label: "Marketplace", color: "bg-cyan-100 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400" },
  vendor_client: { label: "Cliente Vendedor", color: "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" },
};

export default function CustomerDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const trpc = useTRPC();

  const { data: customer, isLoading } = useQuery(
    trpc.sales.customerById.queryOptions({ id }),
  );

  if (isLoading) {
    return (
      <div className="p-4 lg:p-8 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
        <span className="material-symbols-outlined text-5xl mb-3">person_off</span>
        <p className="text-lg font-medium">Cliente no encontrado</p>
        <Link href="/customers" className="mt-4 text-sm text-primary hover:underline">← Volver a clientes</Link>
      </div>
    );
  }

  const typeCfg = TYPE_LABELS[customer.customerType] ?? { label: customer.customerType, color: "" };

  return (
    <div className="p-4 lg:p-8 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/customers" className="hover:text-foreground transition-colors">Clientes</Link>
        <span className="material-symbols-outlined text-base">chevron_right</span>
        <span className="font-medium text-foreground">{customer.name}</span>
      </div>

      {/* Header */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary">
            {customer.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold tracking-tight">{customer.name}</h1>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${typeCfg.color}`}>
                {typeCfg.label}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
              {customer.identification && <span>ID: <strong className="text-foreground">{customer.identification}</strong></span>}
              {customer.phone && <span>Tel: <strong className="text-foreground">{customer.phone}</strong></span>}
              {customer.email && <span>Email: <strong className="text-foreground">{customer.email}</strong></span>}
            </div>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {[
          { label: "Tipo", value: typeCfg.label, icon: "badge" },
          { label: "Límite Crédito", value: Number(customer.creditLimit ?? 0) > 0 ? `$${Number(customer.creditLimit).toLocaleString()}` : "Sin crédito", icon: "account_balance" },
          { label: "Registrado", value: new Date(customer.createdAt).toLocaleDateString("es-VE"), icon: "calendar_today" },
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
        <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-muted-foreground">Datos del Cliente</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { label: "Nombre/Razón Social", value: customer.name },
            { label: "RIF/Cédula", value: customer.identification ?? "—" },
            { label: "Teléfono", value: customer.phone ?? "—" },
            { label: "Email", value: customer.email ?? "—" },
            { label: "Dirección", value: customer.address ?? "—" },
            { label: "Límite de Crédito", value: Number(customer.creditLimit ?? 0) > 0 ? `$${Number(customer.creditLimit).toLocaleString()}` : "—" },
          ].map((d) => (
            <div key={d.label} className="flex items-center justify-between rounded-lg border border-border p-3">
              <span className="text-sm text-muted-foreground">{d.label}</span>
              <span className="text-sm font-semibold text-right">{d.value}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
