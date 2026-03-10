"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "~/trpc/client";

const CreateCustomerDialog = dynamic(
  () =>
    import("~/components/forms/create-customer").then((m) => ({
      default: m.CreateCustomerDialog,
    })),
  { ssr: false },
);

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`bg-muted animate-pulse rounded-lg ${className}`} />;
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  wholesale: {
    label: "Mayorista",
    color: "bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400",
  },
  retail: { label: "Detal", color: "bg-secondary text-muted-foreground" },
  distributor: {
    label: "Distribuidor",
    color:
      "bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400",
  },
  vip: {
    label: "VIP",
    color:
      "bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400",
  },
  marketplace: {
    label: "Marketplace",
    color: "bg-cyan-100 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400",
  },
  vendor_client: {
    label: "Cliente Vendedor",
    color:
      "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
  },
};

export default function CustomersClient() {
  const trpc = useTRPC();
  const { data: customers, isLoading } = useQuery(
    trpc.sales.listCustomers.queryOptions({ limit: 50 }),
  );
  const [showCreate, setShowCreate] = useState(false);

  const list = customers ?? [];

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-black tracking-tight">
            Clientes
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Gestión de clientes y CxC
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition-colors"
        >
          <span className="material-symbols-outlined text-lg">person_add</span>
          Nuevo Cliente
        </button>
      </div>

      <CreateCustomerDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          {
            label: "Total Clientes",
            value: isLoading ? "—" : list.length,
            icon: "group",
            accent: "border-blue-500/40",
          },
          {
            label: "Con Crédito",
            value: isLoading
              ? "—"
              : list.filter((c) => Number(c.creditLimit ?? 0) > 0).length,
            icon: "account_balance",
            accent: "border-emerald-500/40",
          },
          {
            label: "Mayoristas",
            value: isLoading
              ? "—"
              : list.filter((c) => c.customerType === "wholesale").length,
            icon: "business",
            accent: "border-violet-500/40",
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

      <div className="border-border bg-card overflow-hidden rounded-xl border">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-border text-muted-foreground border-b text-[10px] font-bold tracking-widest uppercase">
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">RIF/Cédula</th>
              <th className="px-4 py-3">Teléfono</th>
              <th className="px-4 py-3 text-right">Límite Crédito</th>
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-border border-b">
                    <td className="px-4 py-3">
                      <Skeleton className="h-5 w-40" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-5 w-24" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-5 w-28" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-5 w-32" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="ml-auto h-5 w-20" />
                    </td>
                  </tr>
                ))
              : list.map((c) => {
                  const typeCfg = TYPE_LABELS[c.customerType] ?? {
                    label: c.customerType,
                    color: "",
                  };
                  return (
                    <tr
                      key={c.id}
                      className="border-border hover:bg-accent/50 border-b transition-colors"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/customers/${c.id}`}
                          className="text-foreground hover:text-primary font-medium transition-colors"
                        >
                          {c.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${typeCfg.color}`}
                        >
                          {typeCfg.label}
                        </span>
                      </td>
                      <td className="text-muted-foreground px-4 py-3 font-mono text-xs">
                        {c.email ?? "—"}
                      </td>
                      <td className="text-muted-foreground px-4 py-3">
                        {c.phone ?? "—"}
                      </td>
                      <td className="text-muted-foreground px-4 py-3 text-right font-mono">
                        {Number(c.creditLimit ?? 0) > 0
                          ? `$${Number(c.creditLimit).toLocaleString()}`
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
            {!isLoading && list.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="text-muted-foreground px-4 py-12 text-center"
                >
                  <span className="material-symbols-outlined mb-2 block text-3xl">
                    person_off
                  </span>
                  No hay clientes registrados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
