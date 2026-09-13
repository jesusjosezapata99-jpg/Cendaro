"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
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
import { Icons } from "@cendaro/ui/icons";

import type { StatusTone } from "~/components/status-badge";
import { EmptyState } from "~/components/empty-state";
import { PageHeader } from "~/components/page-header";
import { Skeleton } from "~/components/skeleton";
import { StatCard } from "~/components/stat-card";
import { StatusBadge } from "~/components/status-badge";
import { useBcvRate } from "~/hooks/use-bcv-rate";
import { formatDualCurrency } from "~/lib/format-currency";
import { useTRPC } from "~/trpc/client";

const CreateCustomerDialog = dynamic(
  () =>
    import("~/components/forms/create-customer").then((m) => ({
      default: m.CreateCustomerDialog,
    })),
  { ssr: false },
);

const TYPE_CONFIG: Record<string, { label: string; tone: StatusTone }> = {
  wholesale: { label: "Mayorista", tone: "primary" },
  retail: { label: "Detal", tone: "neutral" },
  distributor: { label: "Distribuidor", tone: "warning" },
  vip: { label: "VIP", tone: "success" },
  marketplace: { label: "Marketplace", tone: "primary" },
  vendor_client: { label: "Cliente Vendedor", tone: "success" },
};

const FILTER_TYPES = [
  { key: "all", label: "Todos" },
  { key: "wholesale", label: "Mayoristas" },
  { key: "retail", label: "Detal" },
  { key: "distributor", label: "Distribuidores" },
  { key: "vip", label: "VIP" },
  { key: "marketplace", label: "Marketplace" },
  { key: "vendor_client", label: "Vendedores" },
] as const;

export default function CustomersClient() {
  const trpc = useTRPC();
  const bcv = useBcvRate();
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data: customers, isLoading } = useQuery(
    trpc.sales.listCustomers.queryOptions({ limit: 100 }),
  );

  const list = useMemo(() => customers ?? [], [customers]);

  const filtered = useMemo(() => {
    return list.filter((c) => {
      const matchesType =
        typeFilter === "all" ? true : c.customerType === typeFilter;
      if (!matchesType) return false;

      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        Boolean(c.phone?.toLowerCase().includes(q)) ||
        Boolean(c.email?.toLowerCase().includes(q))
      );
    });
  }, [list, typeFilter, search]);

  const totalWithCredit = useMemo(
    () => list.filter((c) => Number(c.creditLimit ?? 0) > 0).length,
    [list],
  );

  const totalWholesale = useMemo(
    () =>
      list.filter(
        (c) =>
          c.customerType === "wholesale" || c.customerType === "distributor",
      ).length,
    [list],
  );

  const totalCreditAssigned = useMemo(
    () => list.reduce((s, c) => s + Number(c.creditLimit ?? 0), 0),
    [list],
  );

  const dualCredit = useMemo(
    () => formatDualCurrency(totalCreditAssigned, bcv.rate),
    [totalCreditAssigned, bcv.rate],
  );

  return (
    <div className="space-y-6 py-4 lg:py-8">
      {/* Page Header */}
      <PageHeader
        title="Directorio de Clientes"
        description="Gestión integral de clientes comerciales, líneas de crédito y contacto directo"
      >
        <Button
          onClick={() => setShowCreate(true)}
          className="min-h-11 w-full gap-2 sm:w-auto"
        >
          <Icons.PersonAdd className="size-4.5" />
          Nuevo Cliente
        </Button>
      </PageHeader>

      {/* 4 StatCards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Clientes"
          value={isLoading ? "—" : list.length}
          icon="Group"
          tone="default"
          sub="Directorio consolidado"
        />
        <StatCard
          label="Con Línea de Crédito"
          value={isLoading ? "—" : totalWithCredit}
          icon="AccountBalance"
          tone="success"
          sub="Cuentas con crédito habilitado"
        />
        <StatCard
          label="Mayoristas & Distribuidores"
          value={isLoading ? "—" : totalWholesale}
          icon="Business"
          tone="primary"
          sub="Cuentas corporativas B2B"
        />
        <StatCard
          label="Línea de Crédito Total"
          value={isLoading ? "—" : dualCredit.usd}
          icon="AttachMoney"
          tone="warning"
          sub={`Equivalente oficial: ${dualCredit.bs}`}
        />
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Icons.Search className="text-muted-foreground absolute top-1/2 left-3 size-4.5 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, RIF o teléfono..."
            className="h-11 pl-9"
          />
        </div>

        {/* Filter Tabs (Horizontal Scrollable) */}
        <div className="mobile-scroll-x border-border-subtle flex gap-1.5 border-b pb-2 sm:border-0 sm:pb-0">
          {FILTER_TYPES.map((tab) => {
            const isActive = typeFilter === tab.key;
            const count =
              tab.key === "all"
                ? list.length
                : list.filter((c) => c.customerType === tab.key).length;

            return (
              <button
                key={tab.key}
                onClick={() => setTypeFilter(tab.key)}
                className={`flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-surface-card text-muted-foreground hover:bg-accent hover:text-foreground border-border-subtle border"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`py-0.2 rounded-full px-1.5 font-mono text-[10px] tabular-nums ${
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
      </div>

      {/* Main Content Body */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <>
          {/* Mobile View: Cards (md:hidden) */}
          <div className="space-y-3 md:hidden">
            {filtered.map((c) => {
              const typeCfg = TYPE_CONFIG[c.customerType] ?? {
                label: c.customerType,
                tone: "neutral" as StatusTone,
              };
              const phoneClean = c.phone?.replace(/[^0-9]/g, "") ?? "";
              const dual = formatDualCurrency(
                Number(c.creditLimit ?? 0),
                bcv.rate,
              );

              return (
                <div
                  key={c.id}
                  className="surface-card border-border-subtle hover:border-primary/40 rounded-xl border p-4 transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/customers/${c.id}`}
                      className="group min-w-0 flex-1"
                    >
                      <p className="text-foreground group-hover:text-primary truncate font-medium transition-colors">
                        {c.name}
                      </p>
                      <p className="text-muted-foreground mt-0.5 font-mono text-xs">
                        {c.email ??
                          (c.phone ? `Tel: ${c.phone}` : "Cliente registrado")}
                      </p>
                    </Link>
                    <StatusBadge tone={typeCfg.tone}>
                      {typeCfg.label}
                    </StatusBadge>
                  </div>

                  <div className="border-border-subtle/60 mt-3 flex items-center justify-between border-t pt-2.5 text-xs">
                    <div className="flex items-center gap-2">
                      {c.phone ? (
                        <>
                          <a
                            href={`tel:${c.phone}`}
                            className="border-border-subtle text-muted-foreground hover:text-foreground inline-flex items-center gap-1 rounded-md border px-2 py-1"
                            title="Llamar"
                          >
                            <Icons.Phone className="size-3.5" />
                            {c.phone}
                          </a>
                          {phoneClean && (
                            <a
                              href={`https://wa.me/${phoneClean}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex size-7 items-center justify-center rounded-md border border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
                              title="Abrir WhatsApp"
                            >
                              <Icons.Chat className="size-3.5" />
                            </a>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground">
                          Sin teléfono
                        </span>
                      )}
                    </div>

                    <div className="text-right">
                      {Number(c.creditLimit ?? 0) > 0 ? (
                        <div>
                          <span className="text-foreground block font-mono text-xs font-medium tabular-nums">
                            {dual.usd}
                          </span>
                          <span className="text-muted-foreground block font-mono text-[10px] tabular-nums">
                            {dual.bs}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">
                          Sin crédito
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop View: Table (hidden md:block) */}
          <div className="surface-card border-border-subtle hidden overflow-hidden rounded-xl border md:block">
            <Table>
              <TableHeader>
                <TableRow className="border-border-subtle hover:bg-transparent">
                  <TableHead className="w-12 text-center">#</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead className="text-right">
                    Límite Crédito (USD / Bs)
                  </TableHead>
                  <TableHead className="w-20 text-center">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c, idx) => {
                  const typeCfg = TYPE_CONFIG[c.customerType] ?? {
                    label: c.customerType,
                    tone: "neutral" as StatusTone,
                  };
                  const phoneClean = c.phone?.replace(/[^0-9]/g, "") ?? "";
                  const dual = formatDualCurrency(
                    Number(c.creditLimit ?? 0),
                    bcv.rate,
                  );

                  return (
                    <TableRow
                      key={c.id}
                      className="border-border-subtle hover:bg-accent/40 transition-colors"
                    >
                      <TableCell className="text-muted-foreground text-center font-mono text-xs tabular-nums">
                        {idx + 1}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/customers/${c.id}`}
                          className="text-foreground hover:text-primary block font-medium transition-colors"
                        >
                          {c.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <StatusBadge tone={typeCfg.tone}>
                          {typeCfg.label}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {c.email ?? "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {c.phone ? (
                            <>
                              <span className="text-foreground text-xs">
                                {c.phone}
                              </span>
                              {phoneClean && (
                                <a
                                  href={`https://wa.me/${phoneClean}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex size-6 items-center justify-center rounded text-emerald-600 transition-colors hover:bg-emerald-500/10"
                                  title="Enviar WhatsApp"
                                >
                                  <Icons.Chat className="size-3.5" />
                                </a>
                              )}
                            </>
                          ) : (
                            <span className="text-muted-foreground text-xs">
                              —
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {Number(c.creditLimit ?? 0) > 0 ? (
                          <div>
                            <span className="text-foreground font-medium">
                              {dual.usd}
                            </span>
                            <span className="text-muted-foreground block text-[11px]">
                              {dual.bs}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">
                            Sin crédito
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Link
                          href={`/customers/${c.id}`}
                          className="border-border-subtle text-muted-foreground hover:border-primary hover:bg-primary/10 hover:text-primary inline-flex size-8 items-center justify-center rounded-lg border transition-all"
                          title="Ver ficha de cliente"
                        >
                          <Icons.ChevronRight className="size-4" />
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
          icon="PersonOff"
          title="No se encontraron clientes"
          description={
            search
              ? `No hay clientes que coincidan con "${search}".`
              : typeFilter !== "all"
                ? `No hay clientes registrados bajo la tipología "${TYPE_CONFIG[typeFilter]?.label ?? typeFilter}".`
                : "Aún no hay clientes registrados en el sistema."
          }
          action={
            <Button onClick={() => setShowCreate(true)} className="gap-2">
              <Icons.PersonAdd className="size-4" />
              Crear Nuevo Cliente
            </Button>
          }
        />
      )}

      {/* Modal create customer */}
      <CreateCustomerDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
      />
    </div>
  );
}
