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
import { CreateOrderDialog } from "~/components/forms/create-order";
import { InvoiceVoucherDialog } from "~/components/modals/invoice-voucher-dialog";
import { PageHeader } from "~/components/page-header";
import { StatCard } from "~/components/stat-card";
import { useBcvRate } from "~/hooks/use-bcv-rate";
import { formatDualCurrency } from "~/lib/format-currency";
import { getStatus } from "~/lib/status";
import { useTRPC } from "~/trpc/client";

interface WhatsAppOrderItem {
  id: string;
  orderNumber: string;
  channel: string;
  status: string;
  total: number | string;
  createdAt: Date | string;
  customerId: string | null;
}

export default function WhatsAppPage() {
  const trpc = useTRPC();
  const bcv = useBcvRate();

  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [createOrderOpen, setCreateOrderOpen] = useState(false);
  const [selectedVoucherOrderId, setSelectedVoucherOrderId] = useState<
    string | null
  >(null);

  const {
    data: orders,
    isLoading: ordersLoading,
    isError,
    refetch,
  } = useQuery(trpc.sales.listOrders.queryOptions({ limit: 100 }));
  const { data: customers, isLoading: customersLoading } = useQuery(
    trpc.sales.listCustomers.queryOptions({ limit: 100 }),
  );

  const customerMap = useMemo(() => {
    const map = new Map<
      string,
      { name: string; phone: string | null; email: string | null }
    >();
    if (customers) {
      for (const c of customers) {
        map.set(c.id, {
          name: c.name,
          phone: c.phone,
          email: c.email,
        });
      }
    }
    return map;
  }, [customers]);

  // Filter WhatsApp channel orders
  const waOrders = useMemo(
    () =>
      ((orders ?? []) as unknown as WhatsAppOrderItem[]).filter(
        (o) => o.channel === "whatsapp",
      ),
    [orders],
  );

  const todayStr = useMemo(
    () => new Date().toISOString().split("T")[0] ?? "",
    [],
  );

  const todayOrders = useMemo(
    () =>
      waOrders.filter((o) =>
        new Date(o.createdAt).toISOString().startsWith(todayStr),
      ),
    [waOrders, todayStr],
  );

  const todayRevenue = useMemo(
    () => todayOrders.reduce((s, o) => s + Number(o.total), 0),
    [todayOrders],
  );

  const totalRevenue = useMemo(
    () => waOrders.reduce((s, o) => s + Number(o.total), 0),
    [waOrders],
  );

  const pendingOrders = useMemo(
    () => waOrders.filter((o) => o.status === "pending").length,
    [waOrders],
  );

  const filteredOrders = useMemo(() => {
    let result = waOrders;
    if (activeFilter !== "all") {
      result = result.filter((o) => o.status === activeFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((o) => {
        const cust = o.customerId ? customerMap.get(o.customerId) : null;
        return (
          o.orderNumber.toLowerCase().includes(q) ||
          Boolean(cust?.name.toLowerCase().includes(q)) ||
          Boolean(cust?.phone?.includes(q))
        );
      });
    }
    return result;
  }, [waOrders, activeFilter, search, customerMap]);

  const dualToday = useMemo(
    () => formatDualCurrency(todayRevenue, bcv.rate),
    [todayRevenue, bcv.rate],
  );

  const dualTotal = useMemo(
    () => formatDualCurrency(totalRevenue, bcv.rate),
    [totalRevenue, bcv.rate],
  );

  const cleanPhoneForWa = (phone: string | null | undefined) => {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, "");
    if (!digits) return null;
    if (digits.startsWith("0")) return `58${digits.slice(1)}`;
    if (digits.startsWith("58")) return digits;
    return digits;
  };

  const columns = useMemo<ColumnDef<WhatsAppOrderItem>[]>(
    () => [
      {
        accessorKey: "orderNumber",
        header: "Pedido",
        cell: ({ row }) => (
          <Link
            href={`/orders/${row.original.id}`}
            className="text-primary font-mono text-xs font-medium hover:underline"
          >
            {row.original.orderNumber}
          </Link>
        ),
      },
      {
        id: "customer",
        header: "Cliente",
        cell: ({ row }) => {
          const cust = row.original.customerId
            ? customerMap.get(row.original.customerId)
            : null;
          return (
            <span className="text-foreground text-xs font-medium">
              {cust?.name ?? "Cliente Mostrador"}
            </span>
          );
        },
      },
      {
        id: "whatsapp",
        header: "Contacto WhatsApp",
        cell: ({ row }) => {
          const cust = row.original.customerId
            ? customerMap.get(row.original.customerId)
            : null;
          const cleanPhone = cleanPhoneForWa(cust?.phone);
          const customerName = cust?.name ?? "Cliente Mostrador";
          if (!cleanPhone) {
            return (
              <span className="text-muted-foreground font-mono text-xs">—</span>
            );
          }
          return (
            <a
              href={`https://wa.me/${cleanPhone}?text=${encodeURIComponent(
                `Hola ${customerName}, te contactamos desde Cendaro respecto a tu pedido ${row.original.orderNumber}.`,
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-mono text-xs font-medium text-emerald-400 hover:text-emerald-300"
            >
              <Icons.Chat className="size-3.5" />
              {cust?.phone}
            </a>
          );
        },
      },
      {
        accessorKey: "total",
        header: () => <div className="text-right">Monto Total</div>,
        cell: ({ row }) => {
          const totalNum = Number(row.original.total);
          const dual = formatDualCurrency(totalNum, bcv.rate);
          return (
            <div className="text-right">
              <span className="text-foreground font-mono text-xs font-medium tabular-nums">
                {dual.usd}
              </span>
              {bcv.rate > 0 && (
                <span className="text-muted-foreground ml-1.5 font-mono text-[10px] tabular-nums">
                  {dual.bs}
                </span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        header: () => <div className="text-center">Estado</div>,
        cell: ({ row }) => {
          const { label, tone } = getStatus("order", row.original.status);
          return (
            <div className="text-center">
              <StatusPill tone={tone}>{label}</StatusPill>
            </div>
          );
        },
      },
      {
        accessorKey: "createdAt",
        header: "Fecha",
        cell: ({ row }) => (
          <span className="text-muted-foreground font-mono text-xs tabular-nums">
            {new Date(row.original.createdAt).toLocaleDateString("es-VE")}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => <div className="text-right">Acciones</div>,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedVoucherOrderId(row.original.id)}
              className="border-border h-7 px-2 text-xs font-medium"
            >
              Comprobante
            </Button>
            <Link
              href={`/orders/${row.original.id}`}
              className="border-border hover:border-foreground hover:bg-accent flex size-7 items-center justify-center border transition-colors"
            >
              <Icons.ArrowForward className="text-muted-foreground size-3.5" />
            </Link>
          </div>
        ),
      },
    ],
    [customerMap, bcv.rate],
  );

  return (
    <div className="space-y-6 py-4 lg:py-8">
      {/* Header */}
      <PageHeader
        title="Ventas WhatsApp & CRM"
        description="Canal de venta conversacional asistida e integración con inventario central"
        actions={
          <Button
            onClick={() => setCreateOrderOpen(true)}
            className="min-h-11 flex-1 sm:flex-initial"
          >
            <Icons.Add className="size-4.5" />
            Registrar Venta WhatsApp
          </Button>
        }
      />

      {/* 4 StatCards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Pedidos WhatsApp Hoy"
          value={todayOrders.length}
          icon="Chat"
          tone="primary"
        />
        <StatCard
          label="Facturación Hoy"
          value={ordersLoading ? "—" : dualToday.usd}
          sub={bcv.rate > 0 ? dualToday.bs : undefined}
          icon="Payments"
          tone="primary"
        />
        <StatCard
          label="Total Histórico WhatsApp"
          value={ordersLoading ? "—" : dualTotal.usd}
          sub={bcv.rate > 0 ? dualTotal.bs : undefined}
          icon="ReceiptLong"
          tone="success"
        />
        <StatCard
          label="Pedidos Pendientes"
          value={pendingOrders}
          icon="Schedule"
          tone={pendingOrders > 0 ? "warning" : "default"}
        />
      </div>

      {/* Omnichannel Architecture Banner */}
      <div className="border-border bg-card flex items-start gap-3 border p-4">
        <Icons.Info className="text-primary mt-0.5 size-5 shrink-0" />
        <div className="space-y-0.5 text-xs">
          <p className="text-foreground font-medium">
            Canal Híbrido Asistido: WhatsApp consume stock en tiempo real
          </p>
          <p className="text-muted-foreground">
            Los pedidos captados por mensajería reservan inventario de tienda y
            almacén central al instante. Las confirmaciones y comprobantes
            pueden enviarse directamente al chat del cliente.
          </p>
        </div>
      </div>

      {/* Search and Status Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="mobile-scroll-x flex gap-1.5">
          {[
            { key: "all", label: "Todos", count: waOrders.length },
            {
              key: "pending",
              label: "Pendientes",
              count: waOrders.filter((o) => o.status === "pending").length,
            },
            {
              key: "confirmed",
              label: "Confirmados",
              count: waOrders.filter((o) => o.status === "confirmed").length,
            },
            {
              key: "dispatched",
              label: "Despachados",
              count: waOrders.filter((o) => o.status === "dispatched").length,
            },
            {
              key: "delivered",
              label: "Entregados",
              count: waOrders.filter((o) => o.status === "delivered").length,
            },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveFilter(tab.key)}
              className={`h-8 shrink-0 border px-3 text-xs font-medium transition-colors ${
                activeFilter === tab.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              }`}
            >
              {tab.label}
              <span
                className={`py-0.2 ml-1.5 px-1.5 font-mono text-[10px] tabular-nums ${
                  activeFilter === tab.key
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Icons.Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por # pedido, cliente..."
            className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-foreground min-h-9 w-full border py-1.5 pr-4 pl-9 text-xs transition-colors outline-none"
          />
        </div>
      </div>

      {/* Orders List */}
      {ordersLoading || customersLoading ? (
        <div className="border-border bg-card border">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="border-border flex h-11.25 animate-pulse items-center border-b px-4 last:border-b-0"
            >
              <div className="bg-muted h-4 w-28" />
              <div className="bg-muted ml-6 h-4 w-32" />
              <div className="bg-muted ml-auto h-4 w-20" />
            </div>
          ))}
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="border-border bg-card border p-12">
          <EmptyState
            icon="Chat"
            title="No hay ventas de WhatsApp registradas"
            description="Las ventas originadas o asistidas por mensajería aparecerán registradas en este panel comercial."
            action={
              <Button onClick={() => setCreateOrderOpen(true)} className="mt-2">
                <Icons.Add className="mr-1.5 size-4" />
                Registrar Primera Venta
              </Button>
            }
          />
        </div>
      ) : (
        <>
          {/* Mobile Cards */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {filteredOrders.map((o) => {
              const cust = o.customerId ? customerMap.get(o.customerId) : null;
              const customerName = cust?.name ?? "Cliente Mostrador";
              const cleanPhone = cleanPhoneForWa(cust?.phone);
              const dual = formatDualCurrency(Number(o.total), bcv.rate);
              const { label, tone } = getStatus("order", o.status);

              return (
                <div
                  key={o.id}
                  className="border-border bg-card space-y-3 border p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-primary font-mono text-xs font-medium">
                        {o.orderNumber}
                      </span>
                      <p className="text-foreground mt-0.5 text-sm font-medium">
                        {customerName}
                      </p>
                    </div>
                    <StatusPill tone={tone}>{label}</StatusPill>
                  </div>

                  <div className="border-border flex items-center justify-between border-t pt-2 text-xs">
                    <div>
                      <p className="text-muted-foreground text-[10px] tracking-wider uppercase">
                        Total Pedido
                      </p>
                      <p className="text-foreground font-mono text-sm font-medium tabular-nums">
                        {dual.usd}
                      </p>
                      {bcv.rate > 0 && (
                        <p className="text-muted-foreground font-mono text-[10px] tabular-nums">
                          {dual.bs}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-muted-foreground text-[10px] tracking-wider uppercase">
                        Fecha
                      </p>
                      <p className="text-foreground font-mono text-xs tabular-nums">
                        {new Date(o.createdAt).toLocaleDateString("es-VE")}
                      </p>
                    </div>
                  </div>

                  <div className="border-border flex items-center justify-between border-t pt-2">
                    <div className="flex items-center gap-2">
                      {cleanPhone && (
                        <a
                          href={`https://wa.me/${cleanPhone}?text=${encodeURIComponent(
                            `Hola ${customerName}, te escribimos desde Cendaro respecto a tu pedido ${o.orderNumber}.`,
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20"
                        >
                          <Icons.Chat className="size-3.5" />
                          Chat
                        </a>
                      )}
                      {cust?.phone && (
                        <a
                          href={`tel:${cust.phone}`}
                          className="border-border text-muted-foreground hover:text-foreground flex items-center gap-1 border px-2.5 py-1 text-xs font-medium transition-colors"
                        >
                          <Icons.Phone className="size-3.5" />
                          Llamar
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedVoucherOrderId(o.id)}
                        className="border-border h-7 px-2 text-xs font-medium"
                      >
                        Comprobante
                      </Button>
                      <Link
                        href={`/orders/${o.id}`}
                        className="border-border hover:border-foreground hover:bg-accent flex size-7 items-center justify-center border transition-colors"
                      >
                        <Icons.ArrowForward className="text-muted-foreground size-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block">
            <DataTable
              columns={columns}
              data={filteredOrders}
              isLoading={ordersLoading}
              isError={isError}
              onRetry={() => void refetch()}
              onResetFilters={
                search || activeFilter !== "all"
                  ? () => {
                      setSearch("");
                      setActiveFilter("all");
                    }
                  : undefined
              }
              emptyTitle="No hay ventas de WhatsApp registradas"
              emptyDescription="Las ventas originadas o asistidas por mensajería aparecerán registradas en este panel comercial."
            />
          </div>
        </>
      )}

      {/* Create Order Dialog (preconfigured for WhatsApp) */}
      <CreateOrderDialog
        open={createOrderOpen}
        onClose={() => setCreateOrderOpen(false)}
        defaultChannel="whatsapp"
      />

      {/* Invoice Voucher Dialog */}
      <InvoiceVoucherDialog
        open={Boolean(selectedVoucherOrderId)}
        onClose={() => setSelectedVoucherOrderId(null)}
        orderId={selectedVoucherOrderId}
      />
    </div>
  );
}
