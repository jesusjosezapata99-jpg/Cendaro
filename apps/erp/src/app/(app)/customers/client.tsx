"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
} from "@tanstack/react-query";

import type { StatusTone } from "@cendaro/ui/status-pill";
import { Button } from "@cendaro/ui";
import { Icons } from "@cendaro/ui/icons";
import { StatusPill } from "@cendaro/ui/status-pill";
import { CUSTOMER_TYPES, isFiscalInvoiceReady } from "@cendaro/validators";

import { DataTable } from "~/components/data-table/data-table";
import { PageHeader } from "~/components/page-header";
import { Can } from "~/components/role-guard";
import { StatCard } from "~/components/stat-card";
import { useCustomerParams } from "~/hooks/params/use-customer-params";
import { useBcvRate } from "~/hooks/use-bcv-rate";
import { useDebounce } from "~/hooks/use-debounce";
import { formatDualCurrency } from "~/lib/format-currency";
import { useTRPC } from "~/trpc/client";

const CreateCustomerDialog = dynamic(
  () =>
    import("~/components/forms/create-customer").then((m) => ({
      default: m.CreateCustomerDialog,
    })),
  { ssr: false },
);

const CUSTOMER_TYPE_MAP: Record<string, { label: string; tone: StatusTone }> = {
  wholesale: { label: "Mayorista", tone: "info" },
  retail: { label: "Detal", tone: "neutral" },
  distributor: { label: "Distribuidor", tone: "warning" },
  vip: { label: "VIP", tone: "success" },
  marketplace: { label: "Marketplace", tone: "default" },
  vendor_client: { label: "Cliente Vendedor", tone: "orange" },
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

/** Page size of the directory; keep in sync with the prefetch in page.tsx. */
const CUSTOMERS_PAGE_SIZE = 50;

type CustomerType = (typeof CUSTOMER_TYPES)[number];

function isCustomerType(value: string): value is CustomerType {
  return (CUSTOMER_TYPES as readonly string[]).includes(value);
}

interface CustomerListItem {
  id: string;
  name: string;
  legalName?: string | null;
  identification?: string | null;
  address?: string | null;
  customerType: string;
  phone: string | null;
  email: string | null;
  assignedVendorId: string | null;
  creditLimit: number | null;
  createdAt: Date;
}

export default function CustomersClient() {
  const router = useRouter();
  const trpc = useTRPC();
  const bcv = useBcvRate();
  const [{ createCustomer, search, type: typeFilter }, setCustomerParams] =
    useCustomerParams();

  // Search and type filter run on the server so the whole directory is
  // reachable (name, legal name, phone or RIF/cédula with or without dashes).
  // listCustomers accepts up to 64 characters.
  const debouncedSearch = useDebounce(search.trim().slice(0, 64), 300);
  const {
    data: customerPages,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    ...trpc.sales.listCustomers.infiniteQueryOptions(
      {
        limit: CUSTOMERS_PAGE_SIZE,
        search: debouncedSearch.length >= 2 ? debouncedSearch : undefined,
        customerType: isCustomerType(typeFilter) ? typeFilter : undefined,
      },
      {
        getNextPageParam: (lastPage, allPages) =>
          lastPage.length < CUSTOMERS_PAGE_SIZE
            ? undefined
            : allPages.length * CUSTOMERS_PAGE_SIZE,
      },
    ),
    placeholderData: keepPreviousData,
  });

  const { data: stats, isLoading: statsLoading } = useQuery(
    trpc.sales.customerStats.queryOptions(),
  );

  const list = useMemo(
    () => (customerPages?.pages.flat() ?? []) as CustomerListItem[],
    [customerPages],
  );

  const totalWithCredit = stats?.withCredit ?? 0;
  const totalWholesale =
    (stats?.byType.wholesale ?? 0) + (stats?.byType.distributor ?? 0);
  const totalCreditAssigned = stats?.creditTotal ?? 0;

  const dualCredit = useMemo(
    () => formatDualCurrency(totalCreditAssigned, bcv.rate),
    [totalCreditAssigned, bcv.rate],
  );

  const columns = useMemo<ColumnDef<CustomerListItem>[]>(
    () => [
      {
        id: "index",
        header: "#",
        meta: { align: "center", className: "w-12 text-center" },
        cell: ({ row }) => (
          <span className="text-muted-foreground font-mono text-xs tabular-nums">
            {row.index + 1}
          </span>
        ),
      },
      {
        accessorKey: "name",
        header: "Cliente",
        meta: { sticky: true, className: "min-w-52" },
        cell: ({ row }) => {
          const c = row.original;
          return (
            <div className="flex flex-col gap-0.5">
              <Link
                href={`/customers/${c.id}`}
                onClick={(e) => e.stopPropagation()}
                className="text-foreground truncate text-xs font-medium hover:underline"
              >
                {c.name}
              </Link>
              {c.legalName || c.identification ? (
                <span className="text-muted-foreground truncate font-mono text-[11px] tabular-nums">
                  {c.identification ?? c.legalName}
                </span>
              ) : null}
              {!isFiscalInvoiceReady(c) && (
                <span className="text-status-warning-fg flex items-center gap-1 text-[11px]">
                  <Icons.Warning className="size-3" />
                  Datos fiscales incompletos
                </span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "customerType",
        header: "Tipo",
        meta: { align: "center", className: "w-32 text-center" },
        cell: ({ row }) => {
          const cfg = CUSTOMER_TYPE_MAP[row.original.customerType] ?? {
            label: row.original.customerType,
            tone: "neutral" as StatusTone,
          };
          return <StatusPill tone={cfg.tone}>{cfg.label}</StatusPill>;
        },
      },
      {
        accessorKey: "email",
        header: "Email",
        meta: { className: "w-44" },
        cell: ({ row }) => (
          <span className="text-muted-foreground truncate text-xs">
            {row.original.email ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "phone",
        header: "Contacto",
        meta: { className: "w-40" },
        cell: ({ row }) => {
          const phone = row.original.phone;
          if (!phone) {
            return <span className="text-muted-foreground text-xs">—</span>;
          }
          const phoneClean = phone.replace(/[^0-9]/g, "");
          return (
            <div
              className="flex items-center gap-1.5"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="text-foreground font-mono text-xs tabular-nums">
                {phone}
              </span>
              {phoneClean ? (
                <a
                  href={`https://wa.me/${phoneClean}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-500 hover:text-emerald-400"
                  title="Enviar WhatsApp"
                >
                  <Icons.Chat className="size-3.5" />
                </a>
              ) : null}
            </div>
          );
        },
      },
      {
        accessorKey: "creditLimit",
        header: "Línea Crédito",
        meta: {
          numeric: true,
          align: "right",
          className: "w-36 text-right font-mono tabular-nums",
        },
        cell: ({ row }) => {
          const limit = Number(row.original.creditLimit ?? 0);
          if (limit <= 0) {
            return (
              <span className="text-muted-foreground font-mono text-xs">
                Sin crédito
              </span>
            );
          }
          const dual = formatDualCurrency(limit, bcv.rate);
          return (
            <div className="text-right font-mono tabular-nums">
              <span className="text-foreground font-medium">{dual.usd}</span>
              {bcv.rate > 0 ? (
                <span className="text-muted-foreground ml-1.5 text-[10px] font-normal">
                  {dual.bs}
                </span>
              ) : null}
            </div>
          );
        },
      },
      {
        id: "actions",
        header: "Ficha",
        meta: { align: "center", className: "w-16 text-center" },
        cell: ({ row }) => (
          <Link
            href={`/customers/${row.original.id}`}
            onClick={(e) => e.stopPropagation()}
            className="text-muted-foreground hover:text-foreground inline-flex size-6 items-center justify-center transition-colors"
            title="Ver ficha de cliente"
          >
            <Icons.ChevronRight className="size-4" />
          </Link>
        ),
      },
    ],
    [bcv.rate],
  );

  const handleRowClick = useCallback(
    (customer: CustomerListItem) => {
      router.push(`/customers/${customer.id}`);
    },
    [router],
  );

  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 space-y-6 py-4 duration-200 lg:py-8">
      {/* Page Header */}
      <PageHeader
        title="Directorio de Clientes"
        description="Gestión integral de clientes comerciales, líneas de crédito y contacto directo"
        actions={
          <Can module="customers" action="create">
            <Button
              onClick={() => void setCustomerParams({ createCustomer: true })}
              className="min-h-11 w-full gap-2 sm:w-auto"
            >
              <Icons.PersonAdd className="size-4.5" />
              Nuevo Cliente
            </Button>
          </Can>
        }
      />

      {/* 4 StatCards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Clientes"
          value={statsLoading ? "—" : (stats?.total ?? 0)}
          icon="Group"
          tone="default"
          sub="Directorio consolidado"
        />
        <StatCard
          label="Con Línea de Crédito"
          value={statsLoading ? "—" : totalWithCredit}
          icon="AccountBalance"
          tone="success"
          sub="Cuentas con crédito habilitado"
        />
        <StatCard
          label="Mayoristas & Distribuidores"
          value={statsLoading ? "—" : totalWholesale}
          icon="Business"
          tone="primary"
          sub="Cuentas corporativas B2B"
        />
        <StatCard
          label="Línea de Crédito Total"
          value={statsLoading ? "—" : dualCredit.usd}
          icon="AttachMoney"
          tone="warning"
          sub={`Equivalente oficial: ${dualCredit.bs}`}
        />
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Icons.Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => void setCustomerParams({ search: e.target.value })}
            placeholder="Buscar por nombre, RIF o teléfono..."
            className="border-border bg-card text-foreground placeholder:text-muted-foreground focus:border-primary w-full border py-2 pr-4 pl-9 text-xs focus:outline-none"
          />
        </div>

        {/* Filter Tabs — Clean sharp style */}
        <div className="mobile-scroll-x flex items-center gap-1.5 border-b border-[--line] pb-2 sm:border-0 sm:pb-0">
          {FILTER_TYPES.map((tab) => {
            const isActive = typeFilter === tab.key;
            const count =
              tab.key === "all"
                ? (stats?.total ?? 0)
                : (stats?.byType[tab.key] ?? 0);

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => void setCustomerParams({ type: tab.key })}
                className={`flex min-h-8 items-center gap-1.5 border px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground hover:bg-secondary hover:text-foreground border-[--line] hover:border-[--line-hover]"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1 font-mono text-[10px] tabular-nums ${
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

      {/* Main Data Table with 45px rows */}
      <DataTable
        columns={columns}
        data={list}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => void refetch()}
        isFetchingNextPage={isFetchingNextPage}
        hasNextPage={hasNextPage}
        fetchNextPage={() => void fetchNextPage()}
        onRowClick={handleRowClick}
        onResetFilters={() =>
          void setCustomerParams({ search: "", type: "all" })
        }
        emptyTitle="No se encontraron clientes"
        emptyDescription={
          search
            ? `No hay clientes que coincidan con "${search}".`
            : typeFilter !== "all"
              ? `No hay clientes registrados bajo la tipología "${CUSTOMER_TYPE_MAP[typeFilter]?.label ?? typeFilter}".`
              : "Aún no hay clientes registrados en el sistema."
        }
      />

      {/* Modal create customer */}
      <CreateCustomerDialog
        open={createCustomer}
        onClose={() => void setCustomerParams({ createCustomer: false })}
      />
    </div>
  );
}
