"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@cendaro/ui";
import { Icons } from "@cendaro/ui/icons";

import type { StatusTone } from "~/components/status-badge";
import { EmptyState } from "~/components/empty-state";
import { Skeleton } from "~/components/skeleton";
import { StatCard } from "~/components/stat-card";
import { StatusBadge } from "~/components/status-badge";
import { useBcvRate } from "~/hooks/use-bcv-rate";
import { formatDualCurrency } from "~/lib/format-currency";
import { useTRPC } from "~/trpc/client";

const TYPE_CONFIG: Record<string, { label: string; tone: StatusTone }> = {
  wholesale: { label: "Mayorista", tone: "primary" },
  retail: { label: "Detal", tone: "neutral" },
  distributor: { label: "Distribuidor", tone: "warning" },
  vip: { label: "VIP", tone: "success" },
  marketplace: { label: "Marketplace", tone: "primary" },
  vendor_client: { label: "Cliente Vendedor", tone: "success" },
};

export default function CustomerDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const trpc = useTRPC();
  const bcv = useBcvRate();

  const { data: customer, isLoading } = useQuery(
    trpc.sales.customerById.queryOptions({ id }),
  );

  const typeCfg = useMemo((): { label: string; tone: StatusTone } => {
    if (!customer) return { label: "Cliente", tone: "neutral" };
    return (
      TYPE_CONFIG[customer.customerType] ?? {
        label: customer.customerType,
        tone: "neutral",
      }
    );
  }, [customer]);

  const dualCredit = useMemo(() => {
    if (!customer) return { usd: "—", bs: "—" };
    return formatDualCurrency(Number(customer.creditLimit ?? 0), bcv.rate);
  }, [customer, bcv.rate]);

  const phoneClean = customer?.phone?.replace(/[^0-9]/g, "") ?? "";

  if (isLoading) {
    return (
      <div className="space-y-6 py-4 lg:py-8">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-36 w-full rounded-xl" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="py-4 lg:py-8">
        <EmptyState
          icon="PersonOff"
          title="Cliente no encontrado"
          description="El registro del cliente solicitado no existe o fue removido del sistema."
          action={
            <Button
              variant="outline"
              onClick={() => window.history.back()}
              className="gap-2"
            >
              <Icons.ArrowBack className="size-3.5" />
              Volver al Directorio
            </Button>
          }
        />
      </div>
    );
  }

  const initials = customer.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="space-y-6 py-4 lg:py-8">
      {/* Breadcrumb */}
      <div className="text-muted-foreground flex items-center gap-2 text-xs">
        <Link
          href="/customers"
          className="hover:text-foreground flex items-center gap-1 font-medium transition-colors"
        >
          <Icons.ArrowBack className="size-3.5" />
          Clientes
        </Link>
        <Icons.ChevronRight className="size-3" />
        <span className="text-foreground max-w-xs truncate font-medium">
          {customer.name}
        </span>
      </div>

      {/* Customer Profile Header Card */}
      <div className="surface-card border-border-subtle rounded-xl border p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="bg-primary/10 text-primary flex size-16 shrink-0 items-center justify-center rounded-2xl text-xl font-black">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-foreground text-2xl font-medium tracking-tight">
                  {customer.name}
                </h1>
                <StatusBadge tone={typeCfg.tone}>{typeCfg.label}</StatusBadge>
              </div>
              <p className="text-muted-foreground mt-1 font-mono text-xs">
                {customer.identification
                  ? `RIF / Identificación: ${customer.identification}`
                  : "Sin RIF registrado"}
                {customer.legalName && ` · Razón Social: ${customer.legalName}`}
              </p>
            </div>
          </div>

          {/* Direct Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {customer.phone && (
              <>
                <a
                  href={`tel:${customer.phone}`}
                  className="border-border-subtle bg-surface-card text-foreground hover:bg-accent inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 py-2 text-xs font-medium transition-colors"
                >
                  <Icons.Phone className="size-4" />
                  Llamar ({customer.phone})
                </a>
                {phoneClean && (
                  <a
                    href={`https://wa.me/${phoneClean}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-emerald-500"
                  >
                    <Icons.Chat className="size-4" />
                    WhatsApp
                  </a>
                )}
              </>
            )}
            {customer.email && (
              <a
                href={`mailto:${customer.email}`}
                className="border-border-subtle bg-surface-card text-muted-foreground hover:bg-accent hover:text-foreground inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors"
                title="Enviar Correo"
              >
                <Icons.Mail className="size-4" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* 4 KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Límite de Crédito"
          value={
            Number(customer.creditLimit ?? 0) > 0
              ? dualCredit.usd
              : "Sin crédito"
          }
          icon="AccountBalance"
          tone={Number(customer.creditLimit ?? 0) > 0 ? "success" : "default"}
          sub={
            Number(customer.creditLimit ?? 0) > 0
              ? `Equivalente oficial: ${dualCredit.bs}`
              : "Ventas solo al contado"
          }
        />
        <StatCard
          label="Días de Crédito"
          value={
            customer.creditDays != null && customer.creditDays > 0
              ? `${customer.creditDays} días`
              : "Contado"
          }
          icon="CalendarToday"
          tone="default"
          sub="Plazo de vencimiento de facturas"
        />
        <StatCard
          label="Tipología Comercial"
          value={typeCfg.label}
          icon="Badge"
          tone={typeCfg.tone === "neutral" ? "default" : typeCfg.tone}
          sub="Segmento de facturación y precios"
        />
        <StatCard
          label="Cliente Desde"
          value={new Date(customer.createdAt).toLocaleDateString("es-VE")}
          icon="CalendarToday"
          tone="default"
          sub="Fecha de apertura de ficha"
        />
      </div>

      {/* Structured Customer Data Section */}
      <section className="surface-card border-border-subtle rounded-xl border p-6">
        <h2 className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
          Ficha Comercial & Fiscal
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { label: "Nombre / Razón Social", value: customer.name },
            { label: "Nombre Legal", value: customer.legalName ?? "—" },
            { label: "RIF / Cédula", value: customer.identification ?? "—" },
            { label: "Teléfono Principal", value: customer.phone ?? "—" },
            { label: "Correo Electrónico", value: customer.email ?? "—" },
            { label: "Dirección Fiscal", value: customer.address ?? "—" },
            {
              label: "Línea de Crédito",
              value:
                Number(customer.creditLimit ?? 0) > 0
                  ? `${dualCredit.usd} (${dualCredit.bs})`
                  : "No asignada",
            },
            {
              label: "Plazo de Pago",
              value:
                customer.creditDays != null && customer.creditDays > 0
                  ? `${customer.creditDays} días calendario`
                  : "Inmediato / Contado",
            },
            {
              label: "Vendedor Asignado",
              value: customer.assignedVendorId
                ? `ID: ${customer.assignedVendorId.slice(0, 8)}…`
                : "Venta directa de mostrador",
            },
          ].map((d) => (
            <div
              key={d.label}
              className="border-border-subtle/80 bg-muted/20 rounded-lg border p-3.5"
            >
              <span className="text-muted-foreground block text-[11px] font-medium tracking-wider uppercase">
                {d.label}
              </span>
              <span className="text-foreground mt-1 block font-mono text-sm font-medium">
                {d.value}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
