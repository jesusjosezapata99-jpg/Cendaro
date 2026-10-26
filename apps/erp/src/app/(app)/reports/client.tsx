"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@cendaro/ui";
import { Icons } from "@cendaro/ui/icons";
import { StatusPill } from "@cendaro/ui/status-pill";

import { EmptyState } from "~/components/empty-state";
import { PageHeader } from "~/components/page-header";
import { StatCard } from "~/components/stat-card";
import { useBcvRate } from "~/hooks/use-bcv-rate";
import { formatDualCurrency } from "~/lib/format-currency";
import { useTRPC } from "~/trpc/client";

const CHANNEL_LABELS: Record<string, string> = {
  store: "Tienda Física / POS",
  mercadolibre: "Mercado Libre",
  vendors: "Fuerza de Ventas",
  whatsapp: "WhatsApp Comercial",
  instagram: "Instagram",
};

const METHOD_LABELS: Record<string, string> = {
  mobile_payment: "Pago Móvil",
  transfer: "Transferencia Bancaria",
  cash: "Efectivo Divisas / Bs",
  pos_terminal: "Punto de Venta",
  zelle: "Zelle",
};

export default function ReportsClient() {
  const trpc = useTRPC();
  const bcv = useBcvRate();

  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      from: start.toISOString().slice(0, 10),
      to: now.toISOString().slice(0, 10),
    };
  });

  const rangeInput = useMemo(
    () => ({
      from: `${dateRange.from}T00:00:00.000Z`,
      to: `${dateRange.to}T23:59:59.999Z`,
    }),
    [dateRange],
  );

  const {
    data: salesSummary,
    isLoading: isSummaryLoading,
    refetch: refetchSummary,
  } = useQuery(trpc.reporting.salesSummary.queryOptions(rangeInput));

  const { data: salesByChannel, refetch: refetchChannels } = useQuery(
    trpc.reporting.salesByChannel.queryOptions(rangeInput),
  );

  const { data: paymentMethods, refetch: refetchMethods } = useQuery(
    trpc.reporting.paymentMethods.queryOptions(rangeInput),
  );

  const { data: inventoryValuation, refetch: refetchValuation } = useQuery(
    trpc.reporting.inventoryValuation.queryOptions(),
  );

  const { data: topProducts, refetch: refetchTopProducts } = useQuery(
    trpc.reporting.topProducts.queryOptions({
      ...rangeInput,
      limit: 10,
    }),
  );

  const { data: reconciliation, refetch: refetchReconciliation } = useQuery(
    trpc.reporting.reconcileFinancialLedger.queryOptions(),
  );

  const handleRefreshAll = () => {
    void refetchSummary();
    void refetchChannels();
    void refetchMethods();
    void refetchValuation();
    void refetchTopProducts();
    void refetchReconciliation();
  };

  const totalRevenueUsd = Number(salesSummary?.totalRevenue ?? 0);
  const avgOrderUsd = Number(salesSummary?.avgOrderValue ?? 0);
  const totalValuationUsd = useMemo(
    () =>
      (inventoryValuation ?? []).reduce(
        (acc, w) => acc + Number(w.totalCostValueUsd),
        0,
      ),
    [inventoryValuation],
  );

  const revenueDual = formatDualCurrency(totalRevenueUsd, bcv.rate);
  const avgDual = formatDualCurrency(avgOrderUsd, bcv.rate);
  const valuationDual = formatDualCurrency(totalValuationUsd, bcv.rate);

  return (
    <div className="space-y-6 py-4 lg:py-8">
      <PageHeader
        title="Reportes Ejecutivos & Conciliación Financiera"
        description="Analítica comercial por canal, valoración de inventario a costo promedio y conciliación contable SOC 1 ICFR"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <label
                htmlFor="report-from"
                className="text-muted-foreground text-xs"
              >
                Desde
              </label>
              <input
                id="report-from"
                type="date"
                value={dateRange.from}
                onChange={(e) =>
                  setDateRange((prev) => ({ ...prev, from: e.target.value }))
                }
                className="border-border bg-background text-foreground h-9 border px-2.5 font-mono text-xs outline-none"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <label
                htmlFor="report-to"
                className="text-muted-foreground text-xs"
              >
                Hasta
              </label>
              <input
                id="report-to"
                type="date"
                value={dateRange.to}
                onChange={(e) =>
                  setDateRange((prev) => ({ ...prev, to: e.target.value }))
                }
                className="border-border bg-background text-foreground h-9 border px-2.5 font-mono text-xs outline-none"
              />
            </div>
            <Button
              variant="outline"
              onClick={handleRefreshAll}
              className="border-border h-9 text-xs font-medium"
            >
              <Icons.Refresh className="mr-1.5 size-3.5" />
              Actualizar
            </Button>
          </div>
        }
      />

      {/* 4 Executive KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Facturación Neta (Período)"
          value={isSummaryLoading ? "—" : revenueDual.usd}
          icon="AttachMoney"
          tone="success"
          sub={`Oficial BCV: ${revenueDual.bs}`}
        />
        <StatCard
          label="Pedidos Confirmados"
          value={
            isSummaryLoading ? "—" : Number(salesSummary?.totalOrders ?? 0)
          }
          icon="ReceiptLong"
          tone="default"
          sub="Excluye órdenes anuladas"
        />
        <StatCard
          label="Ticket Promedio"
          value={isSummaryLoading ? "—" : avgDual.usd}
          icon="TrendingUp"
          tone="primary"
          sub={`Oficial BCV: ${avgDual.bs}`}
        />
        <StatCard
          label="Valoración de Inventario"
          value={valuationDual.usd}
          icon="Inventory"
          tone="default"
          sub={`Costo promedio: ${valuationDual.bs}`}
        />
      </div>

      {/* SOC 1 ICFR Ledger Reconciliation Banner */}
      {reconciliation && (
        <section className="border-border bg-card border p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <h2 className="text-foreground text-sm font-medium tracking-wider uppercase">
                  Conciliación Automática de Libros (
                  {reconciliation.complianceStandard})
                </h2>
                <StatusPill
                  tone={
                    reconciliation.status === "BALANCED_COMPLIANT"
                      ? "success"
                      : "warning"
                  }
                >
                  {reconciliation.status === "BALANCED_COMPLIANT"
                    ? "Libros Cuadrados"
                    : "Revisión Requerida"}
                </StatusPill>
              </div>
              <p className="text-muted-foreground text-xs">
                Ecuación de control: Ventas Confirmadas ($
                {reconciliation.financials.totalSalesRevenue.toFixed(2)}) =
                Cobros Recibidos ($
                {reconciliation.financials.totalPaymentsCollected.toFixed(2)}) +
                CxC Pendientes ($
                {reconciliation.financials.totalReceivablesOutstanding.toFixed(
                  2,
                )}
                )
              </p>
            </div>
            <div className="flex items-center gap-4 font-mono text-xs tabular-nums">
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase">
                  Diferencia Contable
                </span>
                <span className="text-foreground font-medium">
                  ${reconciliation.financials.discrepancy.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase">
                  Anomalías Stock Negativo
                </span>
                <span className="text-foreground font-medium">
                  {reconciliation.inventory.negativeStockAnomalies}
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Sales by Channel & Payment Methods */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="border-border bg-card border">
          <div className="border-border border-b p-4">
            <h2 className="text-foreground text-xs font-medium tracking-widest uppercase">
              Ventas por Canal Comercial
            </h2>
          </div>
          {(salesByChannel ?? []).length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon="Storefront"
                title="Sin ventas en el período"
                description="No se registran pedidos confirmados para el rango de fechas seleccionado."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead>Canal</TableHead>
                  <TableHead className="text-right">Pedidos</TableHead>
                  <TableHead className="text-right">Total (USD)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(salesByChannel ?? []).map((row) => (
                  <TableRow key={row.channel} className="border-border">
                    <TableCell className="text-foreground text-xs font-medium">
                      {CHANNEL_LABELS[row.channel] ?? row.channel}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-right font-mono text-xs tabular-nums">
                      {Number(row.count)}
                    </TableCell>
                    <TableCell className="text-foreground text-right font-mono text-xs font-medium tabular-nums">
                      ${Number(row.total).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>

        <section className="border-border bg-card border">
          <div className="border-border border-b p-4">
            <h2 className="text-foreground text-xs font-medium tracking-widest uppercase">
              Recaudación por Método de Pago
            </h2>
          </div>
          {(paymentMethods ?? []).length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon="Payments"
                title="Sin pagos en el período"
                description="No se registran cobros en el rango de fechas seleccionado."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead>Método de Pago</TableHead>
                  <TableHead className="text-right">Transacciones</TableHead>
                  <TableHead className="text-right">Monto (USD)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(paymentMethods ?? []).map((row) => (
                  <TableRow key={row.method} className="border-border">
                    <TableCell className="text-foreground text-xs font-medium">
                      {METHOD_LABELS[row.method] ?? row.method}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-right font-mono text-xs tabular-nums">
                      {Number(row.count)}
                    </TableCell>
                    <TableCell className="text-foreground text-right font-mono text-xs font-medium tabular-nums">
                      ${Number(row.total).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      </div>

      {/* Inventory Valuation & Top Products */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="border-border bg-card border">
          <div className="border-border border-b p-4">
            <h2 className="text-foreground text-xs font-medium tracking-widest uppercase">
              Valoración de Inventario por Almacén
            </h2>
          </div>
          {(inventoryValuation ?? []).length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon="Inventory"
                title="Sin stock valorizado"
                description="No hay existencias registradas en los almacenes del workspace."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead>Almacén</TableHead>
                  <TableHead className="text-right">SKUs</TableHead>
                  <TableHead className="text-right">Unidades</TableHead>
                  <TableHead className="text-right">
                    Valor Costo (USD)
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(inventoryValuation ?? []).map((row) => (
                  <TableRow key={row.warehouseId} className="border-border">
                    <TableCell className="text-foreground text-xs font-medium">
                      {row.warehouseName ?? "Almacén"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-right font-mono text-xs tabular-nums">
                      {Number(row.totalProducts)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-right font-mono text-xs tabular-nums">
                      {Number(row.totalUnits)}
                    </TableCell>
                    <TableCell className="text-foreground text-right font-mono text-xs font-medium tabular-nums">
                      ${Number(row.totalCostValueUsd).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>

        <section className="border-border bg-card border">
          <div className="border-border border-b p-4">
            <h2 className="text-foreground text-xs font-medium tracking-widest uppercase">
              Top 10 Productos Más Vendidos
            </h2>
          </div>
          {(topProducts ?? []).length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon="Category"
                title="Sin movimiento de productos"
                description="No hay productos facturados en el rango seleccionado."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead>Producto</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Unidades</TableHead>
                  <TableHead className="text-right">Ingresos (USD)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(topProducts ?? []).map((row) => (
                  <TableRow key={row.productId} className="border-border">
                    <TableCell className="text-foreground max-w-48 truncate text-xs font-medium">
                      {row.productName}
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">
                      {row.sku}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-right font-mono text-xs tabular-nums">
                      {row.total_qty}
                    </TableCell>
                    <TableCell className="text-foreground text-right font-mono text-xs font-medium tabular-nums">
                      ${row.total_revenue.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      </div>
    </div>
  );
}
