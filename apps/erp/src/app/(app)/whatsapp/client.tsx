"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import type { StatusTone } from "~/components/status-badge";
import { EmptyState } from "~/components/empty-state";
import { CreateOrderDialog } from "~/components/forms/create-order";
import { InvoiceVoucherDialog } from "~/components/modals/invoice-voucher-dialog";
import { PageHeader } from "~/components/page-header";
import { StatCard } from "~/components/stat-card";
import { StatusBadge } from "~/components/status-badge";
import { useBcvRate } from "~/hooks/use-bcv-rate";
import { formatDualCurrency } from "~/lib/format-currency";
import { useTRPC } from "~/trpc/client";

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`bg-muted animate-pulse rounded-lg ${className}`} />;
}

const STATUS_TONES: Record<string, { label: string; tone: StatusTone }> = {
  pending: { label: "Pendiente", tone: "warning" },
  confirmed: { label: "Confirmado", tone: "primary" },
  delivered: { label: "Entregado", tone: "success" },
  shipped: { label: "Enviado", tone: "primary" },
  prepared: { label: "Preparado", tone: "neutral" },
  dispatched: { label: "Despachado", tone: "primary" },
  cancelled: { label: "Cancelado", tone: "destructive" },
  returned: { label: "Devuelto", tone: "neutral" },
};

export default function WhatsAppPage() {
  const trpc = useTRPC();
  const bcv = useBcvRate();

  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [createOrderOpen, setCreateOrderOpen] = useState(false);
  const [selectedVoucherOrderId, setSelectedVoucherOrderId] = useState<
    string | null
  >(null);

  const { data: orders, isLoading: ordersLoading } = useQuery(
    trpc.sales.listOrders.queryOptions({ limit: 100 }),
  );
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
    () => (orders ?? []).filter((o) => o.channel === "whatsapp"),
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

  return (
    <div className="space-y-6 p-4 lg:p-8">
      {/* Header */}
      <PageHeader
        title="Ventas WhatsApp & CRM"
        description="Canal de venta conversacional asistida e integración con inventario central"
        actions={
          <button
            type="button"
            onClick={() => setCreateOrderOpen(true)}
            className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition-all active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-base">add</span>
            Registrar Venta WhatsApp
          </button>
        }
      />

      {/* 4 StatCards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Pedidos WhatsApp Hoy"
          value={todayOrders.length}
          icon="chat"
          tone="primary"
        />
        <StatCard
          label="Facturación Hoy"
          value={ordersLoading ? "—" : dualToday.usd}
          sub={bcv.rate > 0 ? dualToday.bs : undefined}
          icon="payments"
          tone="primary"
        />
        <StatCard
          label="Total Histórico WhatsApp"
          value={ordersLoading ? "—" : dualTotal.usd}
          sub={bcv.rate > 0 ? dualTotal.bs : undefined}
          icon="receipt_long"
          tone="success"
        />
        <StatCard
          label="Pedidos Pendientes"
          value={pendingOrders}
          icon="schedule"
          tone={pendingOrders > 0 ? "warning" : "default"}
        />
      </div>

      {/* Omnichannel Architecture Banner */}
      <div className="surface-card border-border flex items-start gap-3 rounded-xl border p-4">
        <span className="material-symbols-outlined text-primary mt-0.5 shrink-0 text-xl">
          info
        </span>
        <div className="space-y-0.5 text-xs">
          <p className="text-foreground font-semibold">
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
        <div className="flex flex-wrap gap-2">
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
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                activeFilter === tab.key
                  ? "bg-primary text-primary-foreground"
                  : "surface-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
              <span
                className={`py-0.2 rounded-full px-1.5 text-[10px] font-semibold ${
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
          <span className="material-symbols-outlined text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-lg">
            search
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por # pedido, cliente..."
            className="border-border bg-card text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-ring/20 min-h-10 w-full rounded-lg border py-2 pr-4 pl-10 text-sm transition-colors outline-none focus:ring-2"
          />
        </div>
      </div>

      {/* Orders List */}
      {ordersLoading || customersLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : filteredOrders.length === 0 ? (
        <EmptyState
          icon="chat"
          title="No hay ventas de WhatsApp registradas"
          description="Las ventas originadas o asistidas por mensajería aparecerán registradas en este panel comercial."
          action={
            <button
              type="button"
              onClick={() => setCreateOrderOpen(true)}
              className="bg-primary text-primary-foreground hover:bg-primary/90 mt-2 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition-all active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-base">add</span>
              Registrar Primera Venta
            </button>
          }
        />
      ) : (
        <>
          {/* Mobile Cards */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {filteredOrders.map((o) => {
              const cust = o.customerId ? customerMap.get(o.customerId) : null;
              const customerName = cust?.name ?? "Cliente Mostrador";
              const cleanPhone = cleanPhoneForWa(cust?.phone);
              const dual = formatDualCurrency(Number(o.total), bcv.rate);
              const cfg = STATUS_TONES[o.status] ?? {
                label: o.status,
                tone: "neutral" as StatusTone,
              };

              return (
                <div
                  key={o.id}
                  className="surface-card space-y-3 rounded-xl p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-primary font-mono text-xs font-semibold">
                        {o.orderNumber}
                      </span>
                      <p className="text-foreground mt-0.5 text-sm font-semibold">
                        {customerName}
                      </p>
                    </div>
                    <StatusBadge tone={cfg.tone}>{cfg.label}</StatusBadge>
                  </div>

                  <div className="border-border/50 flex items-center justify-between border-t pt-2 text-xs">
                    <div>
                      <p className="text-muted-foreground text-[10px] tracking-wider uppercase">
                        Total Pedido
                      </p>
                      <p className="text-foreground font-mono text-sm font-bold">
                        {dual.usd}
                      </p>
                      {bcv.rate > 0 && (
                        <p className="text-muted-foreground font-mono text-[10px]">
                          {dual.bs}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-muted-foreground text-[10px] tracking-wider uppercase">
                        Fecha
                      </p>
                      <p className="text-foreground font-mono text-xs">
                        {new Date(o.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="border-border/50 flex items-center justify-between border-t pt-2">
                    <div className="flex items-center gap-2">
                      {cleanPhone && (
                        <a
                          href={`https://wa.me/${cleanPhone}?text=${encodeURIComponent(
                            `Hola ${customerName}, te escribimos desde Cendaro respecto a tu pedido ${o.orderNumber}.`,
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="surface-card border-border flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium text-emerald-400 transition-colors hover:text-emerald-300"
                        >
                          <span className="material-symbols-outlined text-sm">
                            chat
                          </span>
                          Chat
                        </a>
                      )}
                      {cust?.phone && (
                        <a
                          href={`tel:${cust.phone}`}
                          className="surface-card border-border text-muted-foreground hover:text-foreground flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors"
                        >
                          <span className="material-symbols-outlined text-sm">
                            phone
                          </span>
                          Llamar
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedVoucherOrderId(o.id)}
                        className="surface-card border-border text-foreground hover:bg-accent flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-all active:scale-[0.98]"
                      >
                        Comprobante
                      </button>
                      <Link
                        href={`/orders/${o.id}`}
                        className="surface-card border-border text-muted-foreground hover:text-foreground rounded-lg border p-1.5 transition-colors"
                      >
                        <span className="material-symbols-outlined text-base">
                          arrow_forward
                        </span>
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table */}
          <div className="surface-card border-border hidden overflow-hidden rounded-xl border md:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-border bg-muted/30 text-muted-foreground border-b text-xs font-medium uppercase">
                  <th className="px-4 py-3 font-mono">Pedido</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Contacto WhatsApp</th>
                  <th className="px-4 py-3 text-right">Monto Total</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {filteredOrders.map((o) => {
                  const cust = o.customerId
                    ? customerMap.get(o.customerId)
                    : null;
                  const customerName = cust?.name ?? "Cliente Mostrador";
                  const cleanPhone = cleanPhoneForWa(cust?.phone);
                  const dual = formatDualCurrency(Number(o.total), bcv.rate);
                  const cfg = STATUS_TONES[o.status] ?? {
                    label: o.status,
                    tone: "neutral" as StatusTone,
                  };

                  return (
                    <tr
                      key={o.id}
                      className="hover:bg-accent/40 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/orders/${o.id}`}
                          className="text-primary font-mono text-xs font-semibold hover:underline"
                        >
                          {o.orderNumber}
                        </Link>
                      </td>
                      <td className="text-foreground px-4 py-3 font-medium">
                        {customerName}
                      </td>
                      <td className="px-4 py-3">
                        {cleanPhone ? (
                          <a
                            href={`https://wa.me/${cleanPhone}?text=${encodeURIComponent(
                              `Hola ${customerName}, te contactamos desde Cendaro respecto a tu pedido ${o.orderNumber}.`,
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 font-mono text-xs font-medium text-emerald-400 hover:text-emerald-300"
                          >
                            <span className="material-symbols-outlined text-sm">
                              chat
                            </span>
                            {cust?.phone}
                          </a>
                        ) : (
                          <span className="text-muted-foreground font-mono text-xs">
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <p className="text-foreground font-mono text-sm font-bold">
                          {dual.usd}
                        </p>
                        {bcv.rate > 0 && (
                          <p className="text-muted-foreground font-mono text-[10px]">
                            {dual.bs}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge tone={cfg.tone}>{cfg.label}</StatusBadge>
                      </td>
                      <td className="text-muted-foreground px-4 py-3 font-mono text-xs">
                        {new Date(o.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedVoucherOrderId(o.id)}
                            className="surface-card border-border text-foreground hover:bg-accent flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all active:scale-[0.98]"
                          >
                            Comprobante
                          </button>
                          <Link
                            href={`/orders/${o.id}`}
                            className="surface-card border-border text-muted-foreground hover:text-foreground rounded-lg border p-1.5 transition-colors"
                          >
                            <span className="material-symbols-outlined text-base">
                              arrow_forward
                            </span>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
