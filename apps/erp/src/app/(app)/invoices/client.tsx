"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { IconName } from "@cendaro/ui/icons";
import type { StatusTone } from "@cendaro/ui/status-pill";
import { Button } from "@cendaro/ui";
import { Icon, Icons } from "@cendaro/ui/icons";
import { StatusPill } from "@cendaro/ui/status-pill";

import { DataTable } from "~/components/data-table/data-table";
import { PageHeader } from "~/components/page-header";
import { StatCard } from "~/components/stat-card";
import { useBcvRate } from "~/hooks/use-bcv-rate";
import { formatDualCurrency } from "~/lib/format-currency";
import { getStatus } from "~/lib/status";
import { useTRPC } from "~/trpc/client";

const InvoiceVoucherDialog = dynamic(
  () =>
    import("~/components/modals/invoice-voucher-dialog").then((m) => ({
      default: m.InvoiceVoucherDialog,
    })),
  { ssr: false },
);

const CHANNEL_ICONS: Record<string, IconName> = {
  store: "Store",
  mercadolibre: "ShoppingCart",
  vendors: "LocalShipping",
  whatsapp: "Chat",
  instagram: "PhotoCamera",
};

const CHANNEL_LABELS: Record<string, string> = {
  store: "Tienda",
  mercadolibre: "Mercado Libre",
  vendors: "Vendedores",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
};

interface InvoiceItem {
  id: string;
  orderNumber: string;
  customerId: string | null;
  status: string;
  channel: string;
  total: string | number;
  totalPaid?: string | number | null;
  createdAt: Date | string;
}

export default function InvoicesClient() {
  const router = useRouter();
  const trpc = useTRPC();
  const qc = useQueryClient();
  const bcv = useBcvRate();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const { data: creditNotesData, refetch: refetchCreditNotes } = useQuery(
    trpc.creditNotes.list.queryOptions({ limit: 50 }),
  );

  const { data: salesBookData, refetch: refetchSalesBook } = useQuery(
    trpc.fiscal.salesBookReport.queryOptions(),
  );

  const [showEmitFiscalForm, setShowEmitFiscalForm] = useState(false);
  const [fiscalBuyerRif, setFiscalBuyerRif] = useState("");
  const [fiscalBuyerName, setFiscalBuyerName] = useState("");
  const [fiscalBase16, setFiscalBase16] = useState("100");
  const [fiscalBase8, setFiscalBase8] = useState("0");
  const [fiscalExempt, setFiscalExempt] = useState("0");
  const [fiscalIgtfBase, setFiscalIgtfBase] = useState("0");

  const emitFiscalDoc = useMutation(
    trpc.fiscal.emitDocument.mutationOptions({
      onSuccess: (doc) => {
        toast.success(
          `Documento fiscal ${doc?.fiscalInvoiceNumber ?? ""} (${doc?.controlNumber ?? ""}) emitido`,
        );
        setShowEmitFiscalForm(false);
        setFiscalBuyerRif("");
        setFiscalBuyerName("");
        void refetchSalesBook();
      },
      onError: (err) => {
        toast.error(err.message || "Error al emitir documento fiscal SENIAT");
      },
    }),
  );

  const recordRetentionMutation = useMutation(
    trpc.fiscal.recordRetention.mutationOptions({
      onSuccess: () => {
        toast.success(
          "Comprobante de retención IVA registrado en Libro de Ventas",
        );
        void refetchSalesBook();
        void qc.invalidateQueries({ queryKey: [["receivables"]] });
      },
      onError: (err) => {
        toast.error(err.message || "Error al registrar retención");
      },
    }),
  );

  const approveCreditNote = useMutation(
    trpc.creditNotes.approve.mutationOptions({
      onSuccess: () => {
        toast.success("Nota de crédito aprobada y aplicada");
        void refetchCreditNotes();
        void qc.invalidateQueries({ queryKey: [["creditNotes"]] });
        void qc.invalidateQueries({ queryKey: [["receivables"]] });
        void qc.invalidateQueries({ queryKey: [["inventory"]] });
      },
      onError: (err) => {
        toast.error(err.message || "Error al aprobar la nota de crédito");
      },
    }),
  );

  const {
    data: ordersData,
    isLoading: ordersLoading,
    isError,
    refetch,
  } = useQuery(trpc.sales.listOrders.queryOptions({ limit: 100 }));

  const { data: internalInvoicesData } = useQuery(
    trpc.sales.listInternalInvoices.queryOptions({ limit: 100 }),
  );

  const { data: customersData } = useQuery(
    trpc.sales.listCustomers.queryOptions({ limit: 100 }),
  );

  const customerMap = useMemo(() => {
    return new Map((customersData ?? []).map((c) => [c.id, c.name]));
  }, [customersData]);

  const internalInvoiceByOrderId = useMemo(() => {
    const map = new Map<
      string,
      { id: string; invoiceNumber: string; status: string }
    >();
    for (const inv of internalInvoicesData ?? []) {
      if (!map.has(inv.orderId)) {
        map.set(inv.orderId, {
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          status: inv.status,
        });
      }
    }
    return map;
  }, [internalInvoicesData]);

  const orders = useMemo(
    () => (ordersData ?? []) as InvoiceItem[],
    [ordersData],
  );

  // Filter invoices based on selection and search
  const filteredInvoices = useMemo(() => {
    return orders.filter((order) => {
      // Status / Payment filtering
      const isPaid = Number(order.totalPaid) >= Number(order.total);
      if (filter === "invoiced" && order.status !== "invoiced") return false;
      if (filter === "delivered" && order.status !== "delivered") return false;
      if (filter === "dispatched" && order.status !== "dispatched")
        return false;
      if (filter === "confirmed" && order.status !== "confirmed") return false;
      if (filter === "paid" && !isPaid) return false;
      if (filter === "unpaid" && isPaid) return false;

      // Text search
      if (search.trim()) {
        const q = search.toLowerCase();
        const persistedInvoice = internalInvoiceByOrderId.get(order.id);
        const invoiceNum = (
          persistedInvoice?.invoiceNumber ?? `FAC-${order.orderNumber}`
        ).toLowerCase();
        const orderNum = order.orderNumber.toLowerCase();
        const customerName = (
          (order.customerId ? customerMap.get(order.customerId) : null) ??
          "Cliente Ocasional"
        ).toLowerCase();

        return (
          invoiceNum.includes(q) ||
          orderNum.includes(q) ||
          customerName.includes(q)
        );
      }

      return true;
    });
  }, [orders, filter, search, customerMap, internalInvoiceByOrderId]);

  // Aggregate metrics
  const totalFacturas = orders.length;
  const totalFacturadoUsd = orders.reduce((sum, o) => sum + Number(o.total), 0);
  const totalCobradoUsd = orders.reduce(
    (sum, o) => sum + Number(o.totalPaid ?? 0),
    0,
  );
  const totalPendienteUsd = Math.max(0, totalFacturadoUsd - totalCobradoUsd);

  const columns = useMemo<ColumnDef<InvoiceItem>[]>(
    () => [
      {
        accessorKey: "orderNumber",
        header: "Factura #",
        meta: { sticky: true, className: "w-36" },
        cell: ({ row }) => {
          const persisted = internalInvoiceByOrderId.get(row.original.id);
          return (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedOrderId(row.original.id);
              }}
              className="text-primary font-mono text-xs font-medium tabular-nums hover:underline"
            >
              {persisted?.invoiceNumber ?? `FAC-${row.original.orderNumber}`}
            </button>
          );
        },
      },
      {
        id: "orderRef",
        header: "Orden Ref.",
        meta: { className: "w-32" },
        cell: ({ row }) => (
          <Link
            href={`/orders/${row.original.id}`}
            onClick={(e) => e.stopPropagation()}
            className="text-muted-foreground hover:text-foreground font-mono text-xs tabular-nums hover:underline"
          >
            {row.original.orderNumber}
          </Link>
        ),
      },
      {
        id: "customer",
        header: "Cliente",
        meta: { className: "min-w-44" },
        cell: ({ row }) => {
          const customerName =
            (row.original.customerId
              ? customerMap.get(row.original.customerId)
              : null) ?? "Cliente Ocasional";
          return (
            <span className="text-foreground truncate text-xs font-medium">
              {customerName}
            </span>
          );
        },
      },
      {
        accessorKey: "channel",
        header: "Canal",
        meta: { className: "w-36" },
        cell: ({ row }) => {
          const ch = row.original.channel;
          return (
            <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <Icon
                name={CHANNEL_ICONS[ch] ?? "Store"}
                className="size-4 shrink-0"
              />
              <span className="truncate">{CHANNEL_LABELS[ch] ?? ch}</span>
            </div>
          );
        },
      },
      {
        accessorKey: "createdAt",
        header: "Fecha",
        meta: {
          className:
            "w-28 font-mono text-xs tabular-nums text-muted-foreground",
        },
        cell: ({ row }) => (
          <span className="text-muted-foreground font-mono text-xs tabular-nums">
            {new Date(row.original.createdAt).toLocaleDateString("es-VE")}
          </span>
        ),
      },
      {
        accessorKey: "total",
        header: "Total",
        meta: {
          numeric: true,
          align: "right",
          className: "w-36 text-right font-mono tabular-nums",
        },
        cell: ({ row }) => {
          const val = Number(row.original.total);
          return (
            <div className="text-right font-mono tabular-nums">
              <span className="text-foreground font-medium">
                ${val.toFixed(2)}
              </span>
              {bcv.rate > 0 ? (
                <span className="text-muted-foreground ml-1.5 text-[10px] font-normal">
                  {formatDualCurrency(val, bcv.rate).bs}
                </span>
              ) : null}
            </div>
          );
        },
      },
      {
        accessorKey: "totalPaid",
        header: "Cobrado",
        meta: {
          numeric: true,
          align: "right",
          className: "w-36 text-right font-mono tabular-nums",
        },
        cell: ({ row }) => {
          const paid = Number(row.original.totalPaid ?? 0);
          return (
            <div className="text-right font-mono tabular-nums">
              <span className="text-foreground font-medium">
                ${paid.toFixed(2)}
              </span>
              {bcv.rate > 0 ? (
                <span className="text-muted-foreground ml-1.5 text-[10px] font-normal">
                  {formatDualCurrency(paid, bcv.rate).bs}
                </span>
              ) : null}
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Estado",
        meta: { align: "center", className: "w-32 text-center" },
        cell: ({ row }) => {
          const s = getStatus("order", row.original.status);
          return <StatusPill tone={s.tone}>{s.label}</StatusPill>;
        },
      },
      {
        id: "payment",
        header: "Cobro",
        meta: { align: "center", className: "w-28 text-center" },
        cell: ({ row }) => {
          const isPaid =
            Number(row.original.totalPaid) >= Number(row.original.total);
          const isPartial =
            Number(row.original.totalPaid) > 0 &&
            Number(row.original.totalPaid) < Number(row.original.total);
          const paymentTone: StatusTone = isPaid
            ? "success"
            : isPartial
              ? "warning"
              : "neutral";
          const paymentLabel = isPaid
            ? "Pagada"
            : isPartial
              ? "Parcial"
              : "Pendiente";
          return <StatusPill tone={paymentTone}>{paymentLabel}</StatusPill>;
        },
      },
      {
        id: "actions",
        header: "Acciones",
        meta: { align: "right", className: "w-28 text-right" },
        cell: ({ row }) => (
          <div
            className="flex items-center justify-end gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedOrderId(row.original.id)}
              className="min-h-7 px-2 text-[11px]"
              title="Ver Comprobante de Facturación"
            >
              <Icons.ReceiptLong className="mr-1 size-3.5" />
              Comprobante
            </Button>
            <Button
              variant="outline"
              size="sm"
              asChild
              className="min-h-7 px-1.5 text-xs"
              title="Ir a Detalle de Pedido"
            >
              <Link href={`/orders/${row.original.id}`}>
                <Icons.OpenInNew className="size-3.5" />
              </Link>
            </Button>
          </div>
        ),
      },
    ],
    [bcv.rate, customerMap, internalInvoiceByOrderId],
  );

  const handleRowClick = useCallback(
    (order: InvoiceItem) => {
      router.push(`/orders/${order.id}`);
    },
    [router],
  );

  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 space-y-6 py-4 duration-200 lg:py-8">
      {/* Page Header */}
      <PageHeader
        title="Facturas Internas"
        description="Emisión de comprobantes proforma, liquidación comercial y estado de cobranza"
        actions={
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            {orders[0] ? (
              <Button
                variant="outline"
                onClick={() => setSelectedOrderId(orders[0]?.id ?? null)}
                className="min-h-11 flex-1 sm:flex-initial"
              >
                <Icons.ReceiptLong className="size-4.5" />
                Último Comprobante
              </Button>
            ) : null}
            <Button asChild className="min-h-11 flex-1 sm:flex-initial">
              <Link href="/orders">
                <Icons.Add className="size-4.5" />
                Nueva Factura / Venta
              </Link>
            </Button>
          </div>
        }
      />

      {/* 4 StatCards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Facturas"
          value={ordersLoading ? "—" : totalFacturas.toLocaleString("es-VE")}
          icon="ReceiptLong"
        />
        <StatCard
          label="Total Facturado"
          value={
            ordersLoading
              ? "—"
              : formatDualCurrency(totalFacturadoUsd, bcv.rate).usd
          }
          sub={
            ordersLoading
              ? undefined
              : formatDualCurrency(totalFacturadoUsd, bcv.rate).bs
          }
          icon="Payments"
          tone="primary"
        />
        <StatCard
          label="Total Cobrado"
          value={
            ordersLoading
              ? "—"
              : formatDualCurrency(totalCobradoUsd, bcv.rate).usd
          }
          sub={
            ordersLoading
              ? undefined
              : formatDualCurrency(totalCobradoUsd, bcv.rate).bs
          }
          icon="CheckCircle"
          tone="success"
        />
        <StatCard
          label="Saldo Pendiente"
          value={
            ordersLoading
              ? "—"
              : formatDualCurrency(totalPendienteUsd, bcv.rate).usd
          }
          sub={
            ordersLoading
              ? undefined
              : formatDualCurrency(totalPendienteUsd, bcv.rate).bs
          }
          icon="Pending"
          tone="warning"
        />
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Icons.Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por Factura #, Orden # o Cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-border bg-card text-foreground placeholder:text-muted-foreground focus:border-primary w-full border py-2 pr-4 pl-9 text-xs focus:outline-none"
          />
        </div>

        {/* Filter chips — Clean sharp style */}
        <div className="mobile-scroll-x flex items-center gap-1.5">
          {[
            { key: "all", label: "Todas" },
            { key: "invoiced", label: "Facturadas" },
            { key: "delivered", label: "Entregadas" },
            { key: "dispatched", label: "Despachadas" },
            { key: "confirmed", label: "Confirmadas" },
            { key: "paid", label: "Cobradas" },
            { key: "unpaid", label: "Por Cobrar" },
          ].map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`flex min-h-8 items-center border px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                filter === f.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:bg-secondary hover:text-foreground border-[--line] hover:border-[--line-hover]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Data Table with 45px rows */}
      <DataTable
        columns={columns}
        data={filteredInvoices}
        isLoading={ordersLoading}
        isError={isError}
        onRetry={() => void refetch()}
        onRowClick={handleRowClick}
        onResetFilters={
          filter !== "all" || search
            ? () => {
                setFilter("all");
                setSearch("");
              }
            : undefined
        }
        emptyTitle="No se encontraron facturas"
        emptyDescription="No hay comprobantes que coincidan con los filtros seleccionados."
      />

      {/* Credit Notes Section (F10.3) */}
      <section className="border-border bg-card space-y-4 border p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-foreground text-sm font-medium">
              Notas de Crédito & Devoluciones ({(creditNotesData ?? []).length})
            </h2>
            <p className="text-muted-foreground text-xs">
              Trazabilidad de notas de crédito vinculadas a pedidos, reversa de
              inventario y ajuste de CxC.
            </p>
          </div>
        </div>

        {(creditNotesData ?? []).length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-xs">
            No hay notas de crédito emitidas en este workspace.
          </p>
        ) : (
          <div className="divide-border border-border divide-y border text-xs">
            {(creditNotesData ?? []).map((cn) => {
              const st = getStatus("creditNote", cn.status);
              return (
                <div
                  key={cn.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-3"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-foreground font-mono font-medium">
                        {cn.creditNoteNumber}
                      </span>
                      <StatusPill tone={st.tone}>{st.label}</StatusPill>
                      <Link
                        href={`/orders/${cn.orderId}`}
                        className="text-primary font-mono hover:underline"
                      >
                        Ver Pedido
                      </Link>
                    </div>
                    <p className="text-muted-foreground">{cn.reason}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right font-mono tabular-nums">
                      <div className="text-foreground font-medium">
                        -${Number(cn.totalUsd).toFixed(2)}
                      </div>
                      <div className="text-muted-foreground text-[10px]">
                        Bs. {Number(cn.totalVes).toFixed(2)}
                      </div>
                    </div>
                    {cn.status === "pending_approval" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={approveCreditNote.isPending}
                        onClick={() => approveCreditNote.mutate({ id: cn.id })}
                        className="h-7 text-xs"
                      >
                        <Icons.CheckCircle className="mr-1 size-3.5" />
                        Aprobar y Aplicar
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* SENIAT Fiscal Engine & Libro de Ventas Section (F11.1) */}
      <section className="border-border bg-card space-y-4 border p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-foreground text-sm font-medium">
              Libro de Ventas SENIAT & Retenciones IVA / IGTF (
              {salesBookData?.summary.documentsCount ?? 0})
            </h2>
            <p className="text-muted-foreground text-xs">
              Control fiscal Providencia 0071: IVA General 16%, Reducido 8%,
              Exento 0%, IGTF 3% y Retenciones 75% / 100%.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowEmitFiscalForm((v) => !v)}
            className="gap-1.5 text-xs"
          >
            <Icons.Add className="size-3.5" />
            {showEmitFiscalForm
              ? "Cerrar Emisor Fiscal"
              : "Emitir Factura Fiscal SENIAT"}
          </Button>
        </div>

        {salesBookData?.summary ? (
          <div className="border-border bg-muted/20 grid grid-cols-2 gap-3 border p-3 text-xs sm:grid-cols-6">
            <div>
              <span className="text-muted-foreground block text-[10px] uppercase">
                Base 16% + IVA 16%
              </span>
              <span className="text-foreground font-mono font-medium tabular-nums">
                ${salesBookData.summary.totalBase16Usd.toFixed(2)} / $
                {salesBookData.summary.totalIva16Usd.toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px] uppercase">
                Base 8% + IVA 8%
              </span>
              <span className="text-foreground font-mono font-medium tabular-nums">
                ${salesBookData.summary.totalBase8Usd.toFixed(2)} / $
                {salesBookData.summary.totalIva8Usd.toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px] uppercase">
                Exento (0%)
              </span>
              <span className="text-foreground font-mono font-medium tabular-nums">
                ${salesBookData.summary.totalExemptUsd.toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px] uppercase">
                IGTF (3% Divisas)
              </span>
              <span className="text-foreground font-mono font-medium tabular-nums">
                ${salesBookData.summary.totalIgtf3Usd.toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px] uppercase">
                IVA Retenido
              </span>
              <span className="text-foreground font-mono font-medium tabular-nums">
                ${salesBookData.summary.totalRetainedIvaUsd.toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px] uppercase">
                Total Libro Ventas
              </span>
              <span className="text-foreground font-mono font-medium tabular-nums">
                ${salesBookData.summary.totalUsd.toFixed(2)} (Bs.{" "}
                {salesBookData.summary.totalVes.toFixed(2)})
              </span>
            </div>
          </div>
        ) : null}

        {showEmitFiscalForm ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const lines: {
                subtotalUsd: number;
                taxClassification: "standard_16" | "reduced_8" | "exempt_0";
              }[] = [];
              if (Number(fiscalBase16) > 0) {
                lines.push({
                  subtotalUsd: Number(fiscalBase16),
                  taxClassification: "standard_16",
                });
              }
              if (Number(fiscalBase8) > 0) {
                lines.push({
                  subtotalUsd: Number(fiscalBase8),
                  taxClassification: "reduced_8",
                });
              }
              if (Number(fiscalExempt) > 0) {
                lines.push({
                  subtotalUsd: Number(fiscalExempt),
                  taxClassification: "exempt_0",
                });
              }
              if (lines.length === 0) {
                toast.error(
                  "Ingrese al menos un monto base o exento mayor a 0",
                );
                return;
              }
              emitFiscalDoc.mutate({
                buyerRif: fiscalBuyerRif,
                buyerLegalName: fiscalBuyerName,
                exchangeRateBcv: bcv.rate > 0 ? bcv.rate : 1,
                igtfBaseUsd: Number(fiscalIgtfBase) || 0,
                lines,
              });
            }}
            className="border-border bg-background grid gap-3 border p-4 sm:grid-cols-6"
          >
            <div className="sm:col-span-2">
              <label
                htmlFor="fiscal-buyer-rif"
                className="text-muted-foreground mb-1 block text-[11px]"
              >
                RIF Cliente (SENIAT)
              </label>
              <input
                id="fiscal-buyer-rif"
                name="fiscalBuyerRif"
                type="text"
                required
                value={fiscalBuyerRif}
                onChange={(e) => setFiscalBuyerRif(e.target.value)}
                placeholder="J-12345678-9"
                className="border-border bg-background text-foreground w-full border px-2.5 py-1.5 font-mono text-xs uppercase"
              />
            </div>
            <div className="sm:col-span-2">
              <label
                htmlFor="fiscal-buyer-name"
                className="text-muted-foreground mb-1 block text-[11px]"
              >
                Razón Social / Nombre Fiscal
              </label>
              <input
                id="fiscal-buyer-name"
                name="fiscalBuyerName"
                type="text"
                required
                value={fiscalBuyerName}
                onChange={(e) => setFiscalBuyerName(e.target.value)}
                placeholder="Comercializadora Ejemplo C.A."
                className="border-border bg-background text-foreground w-full border px-2.5 py-1.5 text-xs"
              />
            </div>
            <div>
              <label
                htmlFor="fiscal-base-16"
                className="text-muted-foreground mb-1 block text-[11px]"
              >
                Base 16% (USD)
              </label>
              <input
                id="fiscal-base-16"
                name="fiscalBase16"
                type="number"
                step="0.01"
                min="0"
                value={fiscalBase16}
                onChange={(e) => setFiscalBase16(e.target.value)}
                className="border-border bg-background text-foreground w-full border px-2.5 py-1.5 font-mono text-xs tabular-nums"
              />
            </div>
            <div>
              <label
                htmlFor="fiscal-base-8"
                className="text-muted-foreground mb-1 block text-[11px]"
              >
                Base 8% (USD)
              </label>
              <input
                id="fiscal-base-8"
                name="fiscalBase8"
                type="number"
                step="0.01"
                min="0"
                value={fiscalBase8}
                onChange={(e) => setFiscalBase8(e.target.value)}
                className="border-border bg-background text-foreground w-full border px-2.5 py-1.5 font-mono text-xs tabular-nums"
              />
            </div>
            <div>
              <label
                htmlFor="fiscal-exempt"
                className="text-muted-foreground mb-1 block text-[11px]"
              >
                Exento 0% (USD)
              </label>
              <input
                id="fiscal-exempt"
                name="fiscalExempt"
                type="number"
                step="0.01"
                min="0"
                value={fiscalExempt}
                onChange={(e) => setFiscalExempt(e.target.value)}
                className="border-border bg-background text-foreground w-full border px-2.5 py-1.5 font-mono text-xs tabular-nums"
              />
            </div>
            <div>
              <label
                htmlFor="fiscal-igtf-base"
                className="text-muted-foreground mb-1 block text-[11px]"
              >
                Base IGTF 3% (USD)
              </label>
              <input
                id="fiscal-igtf-base"
                name="fiscalIgtfBase"
                type="number"
                step="0.01"
                min="0"
                value={fiscalIgtfBase}
                onChange={(e) => setFiscalIgtfBase(e.target.value)}
                className="border-border bg-background text-foreground w-full border px-2.5 py-1.5 font-mono text-xs tabular-nums"
              />
            </div>
            <div className="flex items-end justify-end sm:col-span-4">
              <Button
                type="submit"
                size="sm"
                disabled={emitFiscalDoc.isPending}
                className="h-8 text-xs"
              >
                <Icons.Check className="mr-1.5 size-3.5" />
                {emitFiscalDoc.isPending
                  ? "Emitiendo..."
                  : "Registrar en Libro de Ventas SENIAT"}
              </Button>
            </div>
          </form>
        ) : null}

        {(salesBookData?.rows ?? []).length > 0 ? (
          <div className="divide-border border-border divide-y border text-xs">
            {(salesBookData?.rows ?? []).slice(0, 15).map((doc) => (
              <div
                key={doc.id}
                className="flex flex-wrap items-center justify-between gap-3 p-3"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-foreground font-mono font-medium">
                      {doc.fiscalInvoiceNumber}
                    </span>
                    <span className="text-muted-foreground font-mono text-[11px]">
                      Ctrl: {doc.controlNumber}
                    </span>
                    <span className="text-foreground font-medium">
                      {doc.buyerRif} — {doc.buyerLegalName}
                    </span>
                  </div>
                  <p className="text-muted-foreground font-mono text-[11px] tabular-nums">
                    Base 16%: ${doc.taxableBase16Usd.toFixed(2)} · IVA 16%: $
                    {doc.iva16Usd.toFixed(2)} · Base 8%: $
                    {doc.taxableBase8Usd.toFixed(2)} · Exento: $
                    {doc.exemptAmountUsd.toFixed(2)} · IGTF 3%: $
                    {doc.igtf3Usd.toFixed(2)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right font-mono tabular-nums">
                    <div className="text-foreground font-medium">
                      ${doc.totalUsd.toFixed(2)}
                    </div>
                    <div className="text-muted-foreground text-[10px]">
                      Bs. {doc.totalVes.toFixed(2)}
                    </div>
                  </div>
                  {doc.ivaRetentionPct === 0 ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={recordRetentionMutation.isPending}
                      onClick={() =>
                        recordRetentionMutation.mutate({
                          fiscalDocumentId: doc.id,
                          ivaRetentionPct: 75,
                          ivaRetentionVoucher: `RET-${Date.now().toString().slice(-6)}`,
                        })
                      }
                      className="h-7 text-[11px]"
                    >
                      Retener 75% IVA
                    </Button>
                  ) : (
                    <StatusPill tone="info">
                      Ret. IVA {doc.ivaRetentionPct}% ($
                      {doc.ivaRetentionUsd.toFixed(2)})
                    </StatusPill>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {/* Invoice Voucher Modal */}
      <InvoiceVoucherDialog
        open={!!selectedOrderId}
        onClose={() => setSelectedOrderId(null)}
        orderId={selectedOrderId}
      />
    </div>
  );
}
