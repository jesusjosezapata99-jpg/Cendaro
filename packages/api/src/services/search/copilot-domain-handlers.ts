/**
 * Cendaro — Full-ERP Deep Intelligence Domain Handlers (`search.copilotChat` & `search.askAi`)
 *
 * Executes rich, joined, single-round-trip read-only Drizzle queries inside
 * `runInWorkspaceRlsReadonly` to deliver digested, interactive dossiers across:
 *   • Invoices (`InternalInvoice` + SENIAT `FiscalDocument` + `SalesOrder` + `Payment` + `OrderItem`)
 *   • Orders (`SalesOrder` + `InternalInvoice` + `DeliveryNote` + `Payment` + `OrderItem`)
 *   • Payments (`Payment` + `SalesOrder` + `Customer` + `InternalInvoice`)
 *   • Delivery Notes (`DeliveryNote` + `DeliveryNoteItem` + `SalesOrder` + `Customer`)
 *   • Credit Notes (`CreditNote` + `SalesOrder` + `InternalInvoice` + `Customer`)
 *   • Cash Closures (`CashClosure`)
 *   • Customer 360° Dossiers (`Customer` + lifetime orders + last invoice + last payment + CxC)
 *   • Product 360° Dossiers (`Product` + multi-tier `ProductPrice` + per-warehouse `StockLedger`)
 *   • Suppliers, Warehouses/Kardex, Vendor Commissions, Top Products, and Approvals/Alerts.
 *
 * Security & Invariants:
 *   • 0 external LLM calls here (100% local deterministic SQL & formatting -> 0 extra tokens).
 *   • Strictly sequential `await tx.select(...)` on single `pg.PoolClient` (never `Promise.all`).
 *   • Enforces `workspace_id` on every table & JOIN, `vendorScopeId` / `createdByVendor`,
 *     role-gated `Customer.balance` & `Supplier.rif`, and 0% confidential cost exposure
 *     (`Product.costAvg`, `ProductSupplier.cost`, `Container.costFob`, `ContainerItem.unitCost`).
 */

import { and, asc, desc, eq, gt, ilike, inArray, or, sql } from "drizzle-orm";

import type { getDb } from "@cendaro/db/client";
import type {
  CopilotDetailField,
  CopilotQuickAction,
  QuickAiQueryResponse,
  QuickQueryIntent,
  QuickQueryKpi,
  QuickQueryResultRow,
  QuickQueryTimeWindow,
} from "@cendaro/validators";
import {
  Approval,
  Brand,
  CashClosure,
  Category,
  CreditNote,
  Customer,
  DeliveryNote,
  DeliveryNoteItem,
  ExchangeRate,
  FiscalDocument,
  InternalInvoice,
  OrderItem,
  Payment,
  Product,
  ProductPrice,
  SalesOrder,
  StockLedger,
  StockMovement,
  Supplier,
  SystemAlert,
  UserProfile,
  VendorCommission,
  Warehouse,
} from "@cendaro/db/schema";
import {
  addMoney,
  convertUsdToVes,
  roundMoney2,
  roundMoney4,
  subtractMoney,
} from "@cendaro/validators";

import { createdByVendor } from "../../modules/vendor-scope";

type Db = ReturnType<typeof getDb>;

export const SQL_ACCENT_FROM_CHARS = "áéíóúàèìòùäëïöüâêîôûãõñç";
export const SQL_ACCENT_TO_CHARS = "aeiouaeiouaeiouaeiouaonc";

export interface DomainHandlerEnv {
  tx: Db;
  workspaceId: string;
  query: string;
  sanitized: string;
  intent: QuickQueryIntent;
  source: QuickAiQueryResponse["source"];
  startedAt: number;
  vendorId: string | null;
  canReadOrders: boolean;
  canApproveOrders: boolean;
  canReadPayments: boolean;
  canReadReceivables: boolean;
  canReadCustomers: boolean;
  canReadCatalog: boolean;
  canReadPricing: boolean;
  canReadInventoryStock: boolean;
  canNavigateInventoryPage: boolean;
  canApproveVendors: boolean;
}

const CHANNEL_ES: Record<string, string> = {
  store: "Tienda",
  mercadolibre: "MercadoLibre",
  vendors: "Vendedores",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
};

const PAYMENT_METHOD_ES: Record<string, string> = {
  mobile_payment: "Pago Móvil",
  transfer: "Transferencia",
  cash: "Efectivo",
  pos_terminal: "Punto de Venta",
  zelle: "Zelle",
};

const ORDER_STATUS_ES: Record<string, string> = {
  draft: "Borrador",
  pending: "Pendiente",
  pending_confirmation: "Por confirmar",
  confirmed: "Confirmado",
  prepared: "Preparado",
  dispatched: "Despachado",
  delivered: "Entregado",
  invoiced: "Facturado",
  cancelled: "Anulado",
  returned: "Devuelto",
};

const DOC_STATUS_ES: Record<string, string> = {
  draft: "Borrador",
  issued: "Emitida",
  cancelled: "Anulada",
};

const CREDIT_NOTE_STATUS_ES: Record<string, string> = {
  draft: "Borrador",
  pending_approval: "Por aprobar",
  approved: "Aprobada",
  applied: "Aplicada",
  cancelled: "Anulada",
};

const CLOSURE_STATUS_ES: Record<string, string> = {
  open: "Abierta",
  closed: "Cerrada",
  reviewed: "Auditada",
};

const CUST_TYPE_ES: Record<string, string> = {
  wholesale: "Mayorista",
  retail: "Detal",
  distributor: "Distribuidor",
  vip: "VIP",
  marketplace: "Marketplace",
  vendor_client: "Cartera Vendedor",
};

const PRICE_TYPE_ES: Record<string, string> = {
  store: "Tienda / Detal",
  wholesale: "Mayorista",
  vendor: "Vendedor",
  promo: "Promo",
  special: "Especial",
};

const MOVEMENT_TYPE_ES: Record<string, string> = {
  purchase: "Compra",
  sale: "Venta",
  transfer: "Traslado",
  adjustment_in: "Ajuste (+)",
  adjustment_out: "Ajuste (-)",
  return: "Devolución",
  container_receipt: "Recepción contenedor",
  count_adjustment: "Conteo físico",
  initial_stock: "Stock inicial",
};

const APPROVAL_TYPE_ES: Record<string, string> = {
  credit_sale: "Venta a crédito",
  inventory_adjustment: "Ajuste de inventario",
  channel_stock_move: "Movimiento entre canales",
  product_unblock: "Desbloqueo de producto",
  price_change: "Cambio de precios",
  container_close: "Cierre de contenedor",
  cash_closure: "Cierre de caja",
  price_override: "Precio especial",
  edit_post_issue_document: "Edición post-emisión",
};

function foldLocal(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeLike(input: string): string {
  return input.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function formatUsd(amount: number): string {
  return `$${roundMoney2(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatBs(amount: number): string {
  return `Bs. ${roundMoney2(amount).toLocaleString("es-VE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDateTimeEs(value: Date | string | null | undefined): string {
  if (!value) return "Sin fecha";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "Sin fecha";
  try {
    return d.toLocaleString("es-VE", {
      timeZone: "America/Caracas",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return d.toISOString().slice(0, 16).replace("T", " ");
  }
}

function buildSinceDate(
  window: QuickQueryTimeWindow | null | undefined,
): Date | null {
  if (!window || window === "all") return null;
  const now = new Date();
  if (window === "today") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  const days = window === "7d" ? 7 : 30;
  return new Date(now.getTime() - days * 86_400_000);
}

async function fetchActiveBcvRate(
  tx: Db,
  workspaceId: string,
): Promise<number | null> {
  const rows = await tx
    .select({ rate: ExchangeRate.rate })
    .from(ExchangeRate)
    .where(
      and(
        eq(ExchangeRate.workspaceId, workspaceId),
        eq(ExchangeRate.rateType, "bcv"),
      ),
    )
    .orderBy(desc(ExchangeRate.createdAt))
    .limit(1);
  const val = Number(rows[0]?.rate ?? 0);
  return val > 0 ? val : null;
}

interface OrderEnrichmentDigest {
  paymentSummary: string;
  paymentTotalUsd: number;
  paymentCount: number;
  itemsSummary: string;
  itemCount: number;
}

async function fetchOrderEnrichmentMap(
  tx: Db,
  workspaceId: string,
  orderIds: string[],
  canReadPayments: boolean,
): Promise<Map<string, OrderEnrichmentDigest>> {
  const result = new Map<string, OrderEnrichmentDigest>();
  if (orderIds.length === 0) return result;

  const uniqueIds = [...new Set(orderIds)];
  const paymentsByOrder = new Map<
    string,
    {
      method: string;
      amount: number;
      reference: string | null;
      bankName: string | null;
      createdAt: Date;
    }[]
  >();

  if (canReadPayments) {
    const payRows = await tx
      .select({
        orderId: Payment.orderId,
        method: Payment.method,
        amount: Payment.amount,
        reference: Payment.reference,
        bankName: Payment.bankName,
        createdAt: Payment.createdAt,
      })
      .from(Payment)
      .where(
        and(
          eq(Payment.workspaceId, workspaceId),
          inArray(Payment.orderId, uniqueIds),
        ),
      )
      .orderBy(desc(Payment.createdAt));

    for (const p of payRows) {
      const list = paymentsByOrder.get(p.orderId) ?? [];
      list.push({
        method: p.method,
        amount: Number(p.amount),
        reference: p.reference,
        bankName: p.bankName,
        createdAt: p.createdAt,
      });
      paymentsByOrder.set(p.orderId, list);
    }
  }

  const itemsByOrder = new Map<
    string,
    { quantity: number; productName: string; sku: string; lineTotal: number }[]
  >();

  const lineRows = await tx
    .select({
      orderId: OrderItem.orderId,
      quantity: OrderItem.quantity,
      lineTotal: OrderItem.lineTotal,
      productName: Product.name,
      sku: Product.sku,
    })
    .from(OrderItem)
    .innerJoin(
      Product,
      and(
        eq(OrderItem.productId, Product.id),
        eq(Product.workspaceId, workspaceId),
      ),
    )
    .where(
      and(
        eq(OrderItem.workspaceId, workspaceId),
        inArray(OrderItem.orderId, uniqueIds),
      ),
    );

  for (const l of lineRows) {
    const list = itemsByOrder.get(l.orderId) ?? [];
    list.push({
      quantity: Number(l.quantity),
      productName: l.productName,
      sku: l.sku,
      lineTotal: Number(l.lineTotal),
    });
    itemsByOrder.set(l.orderId, list);
  }

  for (const id of uniqueIds) {
    const pays = paymentsByOrder.get(id) ?? [];
    const lines = itemsByOrder.get(id) ?? [];
    const paymentTotalUsd = addMoney(...pays.map((p) => p.amount));
    const paymentSummary = !canReadPayments
      ? "Consulta de métodos de pago restringida por rol"
      : pays.length === 0
        ? "Sin pagos registrados aún"
        : pays
            .slice(0, 4)
            .map((p) => {
              const label = PAYMENT_METHOD_ES[p.method] ?? p.method;
              const refPart = p.reference ? ` · Ref. ${p.reference}` : "";
              const bankPart = p.bankName ? ` (${p.bankName})` : "";
              return `${label} ${formatUsd(p.amount)}${refPart}${bankPart}`;
            })
            .join(" + ") +
          (pays.length > 4 ? ` (+${pays.length - 4} más)` : "");

    const itemsSummary =
      lines.length === 0
        ? "Sin renglones detallados"
        : lines
            .slice(0, 4)
            .map(
              (l) =>
                `${l.quantity}× ${l.productName} (${formatUsd(l.lineTotal)})`,
            )
            .join(", ") +
          (lines.length > 4 ? ` (+${lines.length - 4} ítems)` : "");

    result.set(id, {
      paymentSummary,
      paymentTotalUsd,
      paymentCount: pays.length,
      itemsSummary,
      itemCount: lines.length,
    });
  }

  return result;
}

// ──────────────────────────────────────────────
// 1. INVOICES (`InternalInvoice` + SENIAT `FiscalDocument` + Payments + Items)
// ──────────────────────────────────────────────

export async function executeInvoiceLookup(
  env: DomainHandlerEnv,
): Promise<QuickAiQueryResponse> {
  const {
    tx,
    workspaceId,
    intent,
    source,
    startedAt,
    vendorId,
    canApproveOrders,
    canReadPayments,
    canReadReceivables,
  } = env;

  const sinceDate = buildSinceDate(intent.timeWindow);
  const rawEntity = intent.searchTerm?.trim() ?? null;
  const rawDoc = intent.documentNumber?.trim() ?? null;
  const foldedEntity = rawEntity ? foldLocal(rawEntity) : null;
  const escapedEntity = foldedEntity ? `%${escapeLike(foldedEntity)}%` : null;
  const compactEntity = foldedEntity
    ? escapeLike(foldedEntity.replace(/[^a-z0-9]/g, ""))
    : "";
  const escapedDoc = rawDoc ? `%${escapeLike(foldLocal(rawDoc))}%` : null;

  const bcv = await fetchActiveBcvRate(tx, workspaceId);

  const invRows = await tx
    .select({
      id: InternalInvoice.id,
      invoiceNumber: InternalInvoice.invoiceNumber,
      orderId: InternalInvoice.orderId,
      customerId: sql<
        string | null
      >`COALESCE(${InternalInvoice.customerId}, ${SalesOrder.customerId})`,
      status: InternalInvoice.status,
      subtotal: InternalInvoice.subtotal,
      discount: InternalInvoice.discount,
      tax: InternalInvoice.tax,
      total: InternalInvoice.total,
      issuedAt: InternalInvoice.issuedAt,
      createdAt: InternalInvoice.createdAt,
      orderNumber: SalesOrder.orderNumber,
      channel: SalesOrder.channel,
      totalPaid: SalesOrder.totalPaid,
      customerName: Customer.name,
      customerLegalName: Customer.legalName,
      customerRif: Customer.identification,
    })
    .from(InternalInvoice)
    .innerJoin(
      SalesOrder,
      and(
        eq(InternalInvoice.orderId, SalesOrder.id),
        eq(SalesOrder.workspaceId, workspaceId),
      ),
    )
    .leftJoin(
      Customer,
      and(
        eq(
          Customer.id,
          sql`COALESCE(${InternalInvoice.customerId}, ${SalesOrder.customerId})`,
        ),
        eq(Customer.workspaceId, workspaceId),
      ),
    )
    .where(
      and(
        eq(InternalInvoice.workspaceId, workspaceId),
        vendorId
          ? createdByVendor(InternalInvoice.orderId, vendorId)
          : undefined,
        sinceDate ? gt(InternalInvoice.createdAt, sinceDate) : undefined,
        escapedDoc
          ? or(
              sql`lower(${InternalInvoice.invoiceNumber}) LIKE ${escapedDoc}`,
              sql`lower(${SalesOrder.orderNumber}) LIKE ${escapedDoc}`,
            )
          : undefined,
        escapedEntity
          ? or(
              sql`translate(lower(COALESCE(${Customer.name}, '')), ${SQL_ACCENT_FROM_CHARS}, ${SQL_ACCENT_TO_CHARS}) LIKE ${escapedEntity}`,
              sql`translate(lower(COALESCE(${Customer.legalName}, '')), ${SQL_ACCENT_FROM_CHARS}, ${SQL_ACCENT_TO_CHARS}) LIKE ${escapedEntity}`,
              sql`lower(${InternalInvoice.invoiceNumber}) LIKE ${escapedEntity}`,
              compactEntity.length >= 3
                ? sql`lower(regexp_replace(COALESCE(${Customer.identification}, ''), '[^a-zA-Z0-9]', '', 'g')) LIKE ${`%${compactEntity}%`}`
                : undefined,
              foldedEntity && foldedEntity.length >= 3
                ? sql`extensions.word_similarity(${foldedEntity}, translate(lower(COALESCE(${Customer.name}, '')), ${SQL_ACCENT_FROM_CHARS}, ${SQL_ACCENT_TO_CHARS})) >= 0.38`
                : undefined,
            )
          : undefined,
      ),
    )
    .orderBy(
      desc(
        sql`COALESCE(${InternalInvoice.issuedAt}, ${InternalInvoice.createdAt})`,
      ),
    )
    .limit(5);

  // Enrich with SENIAT FiscalDocument if caller has `receivables.read`
  const fiscalByInternalId = new Map<
    string,
    {
      fiscalInvoiceNumber: string;
      controlNumber: string;
      exchangeRateBcv: number;
      totalVes: number;
    }
  >();

  if (canReadReceivables && invRows.length > 0) {
    const invIds = invRows.map((r) => r.id);
    const fiscalRows = await tx
      .select({
        internalInvoiceId: FiscalDocument.internalInvoiceId,
        fiscalInvoiceNumber: FiscalDocument.fiscalInvoiceNumber,
        controlNumber: FiscalDocument.controlNumber,
        exchangeRateBcv: FiscalDocument.exchangeRateBcv,
        totalVes: FiscalDocument.totalVes,
      })
      .from(FiscalDocument)
      .where(
        and(
          eq(FiscalDocument.workspaceId, workspaceId),
          eq(FiscalDocument.documentType, "factura"),
          inArray(FiscalDocument.internalInvoiceId, invIds),
        ),
      );
    for (const f of fiscalRows) {
      if (f.internalInvoiceId) {
        fiscalByInternalId.set(f.internalInvoiceId, {
          fiscalInvoiceNumber: f.fiscalInvoiceNumber,
          controlNumber: f.controlNumber,
          exchangeRateBcv: Number(f.exchangeRateBcv),
          totalVes: Number(f.totalVes),
        });
      }
    }
  }

  // Fallback to standalone SENIAT FiscalDocument if `InternalInvoice` had 0 rows & caller is management
  if (invRows.length === 0 && canReadReceivables) {
    const standaloneFiscal = await tx
      .select({
        id: FiscalDocument.id,
        orderId: FiscalDocument.orderId,
        customerId: FiscalDocument.customerId,
        fiscalInvoiceNumber: FiscalDocument.fiscalInvoiceNumber,
        controlNumber: FiscalDocument.controlNumber,
        buyerLegalName: FiscalDocument.buyerLegalName,
        buyerRif: FiscalDocument.buyerRif,
        exchangeRateBcv: FiscalDocument.exchangeRateBcv,
        totalUsd: FiscalDocument.totalUsd,
        totalVes: FiscalDocument.totalVes,
        issuedAt: FiscalDocument.issuedAt,
      })
      .from(FiscalDocument)
      .where(
        and(
          eq(FiscalDocument.workspaceId, workspaceId),
          eq(FiscalDocument.documentType, "factura"),
          sinceDate ? gt(FiscalDocument.issuedAt, sinceDate) : undefined,
          escapedDoc
            ? or(
                sql`lower(${FiscalDocument.fiscalInvoiceNumber}) LIKE ${escapedDoc}`,
                sql`lower(${FiscalDocument.controlNumber}) LIKE ${escapedDoc}`,
              )
            : undefined,
          escapedEntity
            ? or(
                sql`translate(lower(${FiscalDocument.buyerLegalName}), ${SQL_ACCENT_FROM_CHARS}, ${SQL_ACCENT_TO_CHARS}) LIKE ${escapedEntity}`,
                compactEntity.length >= 3
                  ? sql`lower(regexp_replace(${FiscalDocument.buyerRif}, '[^a-zA-Z0-9]', '', 'g')) LIKE ${`%${compactEntity}%`}`
                  : undefined,
              )
            : undefined,
        ),
      )
      .orderBy(desc(FiscalDocument.issuedAt))
      .limit(5);

    const [topF] = standaloneFiscal;
    if (topF) {
      const orderIds = standaloneFiscal
        .map((f) => f.orderId)
        .filter((id): id is string => Boolean(id));
      const enrichMap = await fetchOrderEnrichmentMap(
        tx,
        workspaceId,
        orderIds,
        canReadPayments,
      );
      const topEnrich = topF.orderId ? enrichMap.get(topF.orderId) : undefined;

      const details: CopilotDetailField[] = [
        {
          label: "Factura fiscal SENIAT",
          value: `${topF.fiscalInvoiceNumber} · Control ${topF.controlNumber}`,
          mono: true,
          tone: "info",
        },
        {
          label: "Razón social y RIF",
          value: `${topF.buyerLegalName} (${topF.buyerRif})`,
        },
        {
          label: "Fecha y hora de emisión",
          value: formatDateTimeEs(topF.issuedAt),
        },
        {
          label: "Monto USD / Bs. BCV",
          value: `${formatUsd(Number(topF.totalUsd))} · ${formatBs(Number(topF.totalVes))} (Tasa ${roundMoney4(Number(topF.exchangeRateBcv))})`,
          mono: true,
          tone: "success",
        },
      ];
      if (topEnrich) {
        details.push({
          label: "Cómo pagó",
          value: topEnrich.paymentSummary,
          tone: topEnrich.paymentCount > 0 ? "success" : "warning",
        });
        details.push({
          label: "Ítems facturados",
          value: topEnrich.itemsSummary,
        });
      }

      const quickActions: CopilotQuickAction[] = [];
      if (topF.orderId) {
        quickActions.push({
          label: "Vista rápida de la orden",
          href: `?orderId=${topF.orderId}`,
          variant: "primary",
        });
        quickActions.push({
          label: "Abrir pedido completo",
          href: `/orders/${topF.orderId}`,
          variant: "secondary",
        });
      }
      if (env.canReadCustomers && topF.customerId) {
        quickActions.push({
          label: "Ficha del cliente",
          href: `?customerId=${topF.customerId}`,
          variant: "secondary",
        });
      }

      return {
        query: env.query,
        intent: "invoice_lookup",
        source,
        headline: `Factura fiscal ${topF.fiscalInvoiceNumber} — ${topF.buyerLegalName}`,
        summary: `La última factura fiscal registrada${rawEntity ? ` para "${rawEntity}"` : ""} es la ${topF.fiscalInvoiceNumber} (Control ${topF.controlNumber}), emitida el ${formatDateTimeEs(topF.issuedAt)} a nombre de ${topF.buyerLegalName} (${topF.buyerRif}) por ${formatUsd(Number(topF.totalUsd))} (${formatBs(Number(topF.totalVes))})${topEnrich ? `. Pago: ${topEnrich.paymentSummary}` : ""}.`,
        details,
        quickActions,
        kpis: [
          {
            label: "Total factura",
            value: formatUsd(Number(topF.totalUsd)),
            tone: "success",
          },
          {
            label: "Equivalente fiscal",
            value: formatBs(Number(topF.totalVes)),
            tone: "info",
          },
        ],
        items: standaloneFiscal.map((f) => ({
          id: f.id,
          title: `Factura Fiscal ${f.fiscalInvoiceNumber} · ${f.buyerLegalName}`,
          subtitle: `Control ${f.controlNumber} · ${formatDateTimeEs(f.issuedAt)}`,
          badgeText: formatUsd(Number(f.totalUsd)),
          badgeTone: "info",
          href: f.orderId
            ? `/orders/${f.orderId}`
            : canApproveOrders
              ? "/invoices"
              : "/orders",
        })),
        deepLink: canApproveOrders
          ? { label: "Abrir módulo de Facturas", href: "/invoices" }
          : { label: "Ver Pedidos", href: "/orders" },
        latencyMs: Date.now() - startedAt,
      };
    }
  }

  const [top] = invRows;
  if (!top) {
    const filterDesc = rawDoc ?? rawEntity ?? "los criterios indicados";
    return {
      query: env.query,
      intent: "invoice_lookup",
      source,
      headline: "Sin facturas coincidentes",
      summary: `No encontré facturas emitidas para "${filterDesc}" dentro de tu alcance en este workspace.`,
      kpis: [{ label: "Facturas", value: "0", tone: "neutral" }],
      items: [],
      deepLink: canApproveOrders
        ? { label: "Abrir módulo de Facturas", href: "/invoices" }
        : { label: "Ver Pedidos", href: "/orders" },
      latencyMs: Date.now() - startedAt,
    };
  }

  const enrichMap = await fetchOrderEnrichmentMap(
    tx,
    workspaceId,
    invRows.map((r) => r.orderId),
    canReadPayments,
  );

  const topFiscal = fiscalByInternalId.get(top.id);
  const topEnrich = enrichMap.get(top.orderId);
  const totalUsd = Number(top.total);
  const paidUsd = Number(top.totalPaid ?? topEnrich?.paymentTotalUsd ?? 0);
  const unpaidUsd = Math.max(0, subtractMoney(totalUsd, paidUsd));
  const bsAmount = topFiscal
    ? topFiscal.totalVes
    : bcv
      ? convertUsdToVes(totalUsd, bcv)
      : null;
  const custDisplay =
    top.customerName ?? top.customerLegalName ?? "Consumidor Final";
  const emittedDateStr = formatDateTimeEs(top.issuedAt ?? top.createdAt);
  const chanLabel = CHANNEL_ES[top.channel] ?? top.channel;

  const details: CopilotDetailField[] = [
    {
      label: "Número de factura",
      value: topFiscal
        ? `${top.invoiceNumber} · Fiscal ${topFiscal.fiscalInvoiceNumber} (Ctrl ${topFiscal.controlNumber})`
        : `${top.invoiceNumber} (${DOC_STATUS_ES[top.status] ?? top.status})`,
      mono: true,
      tone: top.status === "cancelled" ? "destructive" : "info",
    },
    {
      label: "Cliente / Empresa",
      value: `${custDisplay}${top.customerRif ? ` (${top.customerRif})` : ""}`,
    },
    {
      label: "Cuándo y cómo se emitió",
      value: `${emittedDateStr} · Canal ${chanLabel} · Orden ${top.orderNumber}`,
    },
    {
      label: "Cómo pagó",
      value: topEnrich?.paymentSummary ?? "Sin pagos registrados",
      tone: unpaidUsd <= 0.005 ? "success" : "warning",
    },
    {
      label: "Productos facturados",
      value: topEnrich?.itemsSummary ?? "Sin detalle de renglones",
    },
  ];

  const quickActions: CopilotQuickAction[] = [
    {
      label: "Vista rápida factura / orden",
      href: `?orderId=${top.orderId}`,
      variant: "primary",
    },
    {
      label: "Ir al pedido completo",
      href: `/orders/${top.orderId}`,
      variant: "secondary",
    },
  ];
  if (env.canReadCustomers && top.customerId) {
    quickActions.push({
      label: "Ficha del cliente",
      href: `?customerId=${top.customerId}`,
      variant: "secondary",
    });
  }

  const paymentStatusLabel =
    unpaidUsd <= 0.005
      ? `Pagada total (${formatUsd(paidUsd)})`
      : paidUsd > 0
        ? `Abonado ${formatUsd(paidUsd)} · Resta ${formatUsd(unpaidUsd)}`
        : `Pendiente de cobro (${formatUsd(totalUsd)})`;

  return {
    query: env.query,
    intent: "invoice_lookup",
    source,
    headline: `Factura ${top.invoiceNumber} — ${custDisplay}`,
    summary: `La última factura${rawEntity ? ` de ${custDisplay}` : ""} es la ${top.invoiceNumber} (Orden ${top.orderNumber}), emitida el ${emittedDateStr} por canal ${chanLabel} por ${formatUsd(totalUsd)}${bsAmount !== null ? ` (${formatBs(bsAmount)})` : ""}. Estado de cobro: ${paymentStatusLabel}. Método de pago: ${topEnrich?.paymentSummary ?? "sin registro"}.`,
    details,
    quickActions,
    kpis: [
      {
        label: "Total factura",
        value: `${formatUsd(totalUsd)}${bsAmount !== null ? ` · ${formatBs(bsAmount)}` : ""}`,
        tone: "info",
      },
      {
        label: unpaidUsd <= 0.005 ? "Cobrado" : "Saldo pendiente",
        value: unpaidUsd <= 0.005 ? formatUsd(paidUsd) : formatUsd(unpaidUsd),
        tone: unpaidUsd <= 0.005 ? "success" : "warning",
      },
    ],
    items: invRows.map((r) => {
      const rPaid = Number(r.totalPaid ?? 0);
      const rRem = Math.max(0, subtractMoney(Number(r.total), rPaid));
      return {
        id: r.id,
        title: `Factura ${r.invoiceNumber} · ${r.customerName ?? "Consumidor"}`,
        subtitle: `Orden ${r.orderNumber} · ${formatDateTimeEs(r.issuedAt ?? r.createdAt)} · ${CHANNEL_ES[r.channel] ?? r.channel}`,
        badgeText:
          rRem <= 0.005
            ? `Pagada ${formatUsd(Number(r.total))}`
            : `Resta ${formatUsd(rRem)}`,
        badgeTone: rRem <= 0.005 ? "success" : "warning",
        href: `/orders/${r.orderId}`,
      };
    }),
    deepLink: canApproveOrders
      ? { label: "Abrir módulo de Facturas", href: "/invoices" }
      : { label: "Abrir listado de Pedidos", href: "/orders" },
    latencyMs: Date.now() - startedAt,
  };
}

// ──────────────────────────────────────────────
// 2. ORDER DETAIL / LAST PURCHASE (`SalesOrder` + Invoice + DeliveryNote + Payments + Items)
// ──────────────────────────────────────────────

export async function executeOrderDetailLookup(
  env: DomainHandlerEnv,
): Promise<QuickAiQueryResponse> {
  const {
    tx,
    workspaceId,
    intent,
    source,
    startedAt,
    vendorId,
    canReadPayments,
  } = env;

  const sinceDate = buildSinceDate(intent.timeWindow);
  const rawEntity = intent.searchTerm?.trim() ?? null;
  const rawDoc = intent.documentNumber?.trim() ?? null;
  const foldedEntity = rawEntity ? foldLocal(rawEntity) : null;
  const escapedEntity = foldedEntity ? `%${escapeLike(foldedEntity)}%` : null;
  const compactEntity = foldedEntity
    ? escapeLike(foldedEntity.replace(/[^a-z0-9]/g, ""))
    : "";
  const escapedDoc = rawDoc ? `%${escapeLike(foldLocal(rawDoc))}%` : null;

  const bcv = await fetchActiveBcvRate(tx, workspaceId);

  const orders = await tx
    .select({
      id: SalesOrder.id,
      orderNumber: SalesOrder.orderNumber,
      customerId: SalesOrder.customerId,
      channel: SalesOrder.channel,
      status: SalesOrder.status,
      total: SalesOrder.total,
      totalPaid: SalesOrder.totalPaid,
      createdAt: SalesOrder.createdAt,
      customerName: Customer.name,
      customerRif: Customer.identification,
    })
    .from(SalesOrder)
    .leftJoin(
      Customer,
      and(
        eq(SalesOrder.customerId, Customer.id),
        eq(Customer.workspaceId, workspaceId),
      ),
    )
    .where(
      and(
        eq(SalesOrder.workspaceId, workspaceId),
        vendorId ? eq(SalesOrder.createdBy, vendorId) : undefined,
        intent.channel ? eq(SalesOrder.channel, intent.channel) : undefined,
        sinceDate ? gt(SalesOrder.createdAt, sinceDate) : undefined,
        escapedDoc
          ? sql`lower(${SalesOrder.orderNumber}) LIKE ${escapedDoc}`
          : undefined,
        escapedEntity
          ? or(
              sql`translate(lower(COALESCE(${Customer.name}, '')), ${SQL_ACCENT_FROM_CHARS}, ${SQL_ACCENT_TO_CHARS}) LIKE ${escapedEntity}`,
              sql`lower(${SalesOrder.orderNumber}) LIKE ${escapedEntity}`,
              compactEntity.length >= 3
                ? sql`lower(regexp_replace(COALESCE(${Customer.identification}, ''), '[^a-zA-Z0-9]', '', 'g')) LIKE ${`%${compactEntity}%`}`
                : undefined,
              foldedEntity && foldedEntity.length >= 3
                ? sql`extensions.word_similarity(${foldedEntity}, translate(lower(COALESCE(${Customer.name}, '')), ${SQL_ACCENT_FROM_CHARS}, ${SQL_ACCENT_TO_CHARS})) >= 0.38`
                : undefined,
            )
          : undefined,
      ),
    )
    .orderBy(desc(SalesOrder.createdAt))
    .limit(5);

  const [top] = orders;
  if (!top) {
    const label = rawDoc ?? rawEntity ?? "esos criterios";
    return {
      query: env.query,
      intent: "order_detail_lookup",
      source,
      headline: "Sin pedidos coincidentes",
      summary: `No encontré pedidos ni compras registradas para "${label}" dentro de tu alcance.`,
      kpis: [{ label: "Pedidos", value: "0", tone: "neutral" }],
      items: [],
      deepLink: { label: "Abrir Pedidos", href: "/orders" },
      latencyMs: Date.now() - startedAt,
    };
  }

  const orderIds = orders.map((o) => o.id);
  const enrichMap = await fetchOrderEnrichmentMap(
    tx,
    workspaceId,
    orderIds,
    canReadPayments,
  );

  const invRows = await tx
    .select({
      orderId: InternalInvoice.orderId,
      invoiceNumber: InternalInvoice.invoiceNumber,
    })
    .from(InternalInvoice)
    .where(
      and(
        eq(InternalInvoice.workspaceId, workspaceId),
        inArray(InternalInvoice.orderId, orderIds),
      ),
    );
  const invByOrder = new Map(invRows.map((i) => [i.orderId, i.invoiceNumber]));

  const topEnrich = enrichMap.get(top.id);
  const topInv = invByOrder.get(top.id);
  const totalUsd = Number(top.total);
  const paidUsd = Number(top.totalPaid ?? topEnrich?.paymentTotalUsd ?? 0);
  const unpaidUsd = Math.max(0, subtractMoney(totalUsd, paidUsd));
  const custLabel = top.customerName ?? "Consumidor Final";
  const chanLabel = CHANNEL_ES[top.channel] ?? top.channel;
  const statusLabel = ORDER_STATUS_ES[top.status] ?? top.status;

  const details: CopilotDetailField[] = [
    {
      label: "Pedido y factura",
      value: topInv
        ? `Orden ${top.orderNumber} · Factura ${topInv} (${statusLabel})`
        : `Orden ${top.orderNumber} (${statusLabel})`,
      mono: true,
      tone: "info",
    },
    {
      label: "Cliente y canal",
      value: `${custLabel}${top.customerRif ? ` (${top.customerRif})` : ""} · ${chanLabel}`,
    },
    {
      label: "Fecha y hora",
      value: formatDateTimeEs(top.createdAt),
    },
    {
      label: "Cómo pagó",
      value: topEnrich?.paymentSummary ?? "Sin pagos registrados",
      tone: unpaidUsd <= 0.005 ? "success" : "warning",
    },
    {
      label: "Qué compró",
      value: topEnrich?.itemsSummary ?? "Sin renglones",
    },
  ];

  const quickActions: CopilotQuickAction[] = [
    {
      label: "Vista rápida del pedido",
      href: `?orderId=${top.id}`,
      variant: "primary",
    },
    {
      label: "Abrir orden completa",
      href: `/orders/${top.id}`,
      variant: "secondary",
    },
  ];
  if (env.canReadCustomers && top.customerId) {
    quickActions.push({
      label: "Ficha del cliente",
      href: `?customerId=${top.customerId}`,
      variant: "secondary",
    });
  }

  return {
    query: env.query,
    intent: "order_detail_lookup",
    source,
    headline: `Orden ${top.orderNumber} — ${custLabel}`,
    summary: `El último pedido${rawEntity ? ` de ${custLabel}` : ""} es la orden ${top.orderNumber}${topInv ? ` (Factura ${topInv})` : ""} del ${formatDateTimeEs(top.createdAt)} por ${chanLabel}, con estado "${statusLabel}" por ${formatUsd(totalUsd)}${bcv ? ` (${formatBs(convertUsdToVes(totalUsd, bcv))} a BCV)` : ""}. Pago: ${topEnrich?.paymentSummary ?? "pendiente"}.`,
    details,
    quickActions,
    kpis: [
      {
        label: "Total orden",
        value: formatUsd(totalUsd),
        tone: "info",
      },
      {
        label: unpaidUsd <= 0.005 ? "Pagado" : "Por cobrar",
        value: unpaidUsd <= 0.005 ? formatUsd(paidUsd) : formatUsd(unpaidUsd),
        tone: unpaidUsd <= 0.005 ? "success" : "warning",
      },
    ],
    items: orders.map((o) => ({
      id: o.id,
      title: `Orden ${o.orderNumber} · ${o.customerName ?? "Consumidor"}`,
      subtitle: `${formatDateTimeEs(o.createdAt)} · ${CHANNEL_ES[o.channel] ?? o.channel} · ${ORDER_STATUS_ES[o.status] ?? o.status}`,
      badgeText: formatUsd(Number(o.total)),
      badgeTone: o.status === "cancelled" ? "destructive" : "info",
      href: `/orders/${o.id}`,
    })),
    deepLink: { label: "Abrir listado de Pedidos", href: "/orders" },
    latencyMs: Date.now() - startedAt,
  };
}

// ──────────────────────────────────────────────
// 3. PAYMENTS (`Payment` + `SalesOrder` + `Customer` + `InternalInvoice`)
// ──────────────────────────────────────────────

export async function executePaymentLookup(
  env: DomainHandlerEnv,
): Promise<QuickAiQueryResponse> {
  const { tx, workspaceId, intent, source, startedAt, canReadOrders } = env;

  const sinceDate = buildSinceDate(intent.timeWindow);
  const rawEntity =
    (intent.documentNumber ?? intent.searchTerm)?.trim() ?? null;
  const foldedEntity = rawEntity ? foldLocal(rawEntity) : null;
  const escapedEntity = foldedEntity ? `%${escapeLike(foldedEntity)}%` : null;
  const compactEntity = foldedEntity
    ? escapeLike(foldedEntity.replace(/[^a-z0-9]/g, ""))
    : "";
  const minAmt = intent.minAmountUsd ?? 0;

  const bcv = await fetchActiveBcvRate(tx, workspaceId);

  const paymentFilter = and(
    eq(Payment.workspaceId, workspaceId),
    intent.paymentMethod ? eq(Payment.method, intent.paymentMethod) : undefined,
    minAmt > 0 ? gt(Payment.amount, minAmt) : undefined,
    sinceDate ? gt(Payment.createdAt, sinceDate) : undefined,
    escapedEntity
      ? or(
          sql`translate(lower(COALESCE(${Customer.name}, '')), ${SQL_ACCENT_FROM_CHARS}, ${SQL_ACCENT_TO_CHARS}) LIKE ${escapedEntity}`,
          sql`translate(lower(COALESCE(${Payment.payerName}, '')), ${SQL_ACCENT_FROM_CHARS}, ${SQL_ACCENT_TO_CHARS}) LIKE ${escapedEntity}`,
          sql`lower(COALESCE(${Payment.reference}, '')) LIKE ${escapedEntity}`,
          sql`lower(COALESCE(${Payment.bankName}, '')) LIKE ${escapedEntity}`,
          sql`lower(${SalesOrder.orderNumber}) LIKE ${escapedEntity}`,
          sql`EXISTS (
            SELECT 1 FROM ${InternalInvoice}
            WHERE ${InternalInvoice.orderId} = ${SalesOrder.id}
              AND ${InternalInvoice.workspaceId} = ${workspaceId}
              AND lower(${InternalInvoice.invoiceNumber}) LIKE ${escapedEntity}
          )`,
          compactEntity.length >= 3
            ? sql`lower(regexp_replace(COALESCE(${Customer.identification}, ''), '[^a-zA-Z0-9]', '', 'g')) LIKE ${`%${compactEntity}%`}`
            : undefined,
        )
      : undefined,
  );

  const aggRows = await tx
    .select({
      payCount: sql<number>`COUNT(*)::int`,
      paySum: sql<string>`COALESCE(SUM(${Payment.amount}), 0)`,
    })
    .from(Payment)
    .innerJoin(
      SalesOrder,
      and(
        eq(Payment.orderId, SalesOrder.id),
        eq(SalesOrder.workspaceId, workspaceId),
      ),
    )
    .leftJoin(
      Customer,
      and(
        eq(SalesOrder.customerId, Customer.id),
        eq(Customer.workspaceId, workspaceId),
      ),
    )
    .where(paymentFilter);

  const rows = await tx
    .select({
      id: Payment.id,
      orderId: Payment.orderId,
      method: Payment.method,
      amount: Payment.amount,
      reference: Payment.reference,
      bankName: Payment.bankName,
      payerName: Payment.payerName,
      isValidated: Payment.isValidated,
      createdAt: Payment.createdAt,
      orderNumber: SalesOrder.orderNumber,
      customerId: SalesOrder.customerId,
      customerName: Customer.name,
      customerRif: Customer.identification,
    })
    .from(Payment)
    .innerJoin(
      SalesOrder,
      and(
        eq(Payment.orderId, SalesOrder.id),
        eq(SalesOrder.workspaceId, workspaceId),
      ),
    )
    .leftJoin(
      Customer,
      and(
        eq(SalesOrder.customerId, Customer.id),
        eq(Customer.workspaceId, workspaceId),
      ),
    )
    .where(paymentFilter)
    .orderBy(desc(Payment.createdAt))
    .limit(5);

  const totalCount = Number(aggRows[0]?.payCount ?? rows.length);
  const totalUsd = roundMoney2(Number(aggRows[0]?.paySum ?? 0));

  const [top] = rows;
  if (!top) {
    return {
      query: env.query,
      intent: "payment_lookup",
      source,
      headline: "Sin pagos registrados con esos filtros",
      summary:
        "No encontré cobros o referencias que coincidan con tu búsqueda.",
      kpis: [{ label: "Pagos", value: "0", tone: "neutral" }],
      items: [],
      deepLink: { label: "Abrir módulo de Pagos", href: "/payments" },
      latencyMs: Date.now() - startedAt,
    };
  }

  // Load latest invoice number per order without 1:N JOIN fan-out (`MED-01`)
  const uniqueOrderIds = [...new Set(rows.map((r) => r.orderId))];
  const invRows = await tx
    .select({
      orderId: InternalInvoice.orderId,
      invoiceNumber: InternalInvoice.invoiceNumber,
    })
    .from(InternalInvoice)
    .where(
      and(
        eq(InternalInvoice.workspaceId, workspaceId),
        inArray(InternalInvoice.orderId, uniqueOrderIds),
      ),
    )
    .orderBy(desc(InternalInvoice.createdAt));

  const invByOrder = new Map<string, string>();
  for (const inv of invRows) {
    if (!invByOrder.has(inv.orderId)) {
      invByOrder.set(inv.orderId, inv.invoiceNumber);
    }
  }

  const topInvoiceNumber = invByOrder.get(top.orderId) ?? null;
  const methodLabel = PAYMENT_METHOD_ES[top.method] ?? top.method;
  const custLabel = top.customerName ?? top.payerName ?? "Consumidor";

  const details: CopilotDetailField[] = [
    {
      label: "Último cobro",
      value: `${methodLabel} · ${formatUsd(Number(top.amount))}${bcv ? ` (${formatBs(convertUsdToVes(Number(top.amount), bcv))})` : ""}`,
      mono: true,
      tone: "success",
    },
    {
      label: "Referencia y banco",
      value: `${top.reference ? `Ref. ${top.reference}` : "Sin referencia"}${top.bankName ? ` · ${top.bankName}` : ""} · ${top.isValidated ? "Validado" : "Por conciliar"}`,
      mono: true,
    },
    {
      label: "Cliente / Pagador",
      value: `${custLabel}${top.customerRif ? ` (${top.customerRif})` : ""}`,
    },
    {
      label: "Documento asociado",
      value: `Orden ${top.orderNumber}${topInvoiceNumber ? ` · Factura ${topInvoiceNumber}` : ""} · ${formatDateTimeEs(top.createdAt)}`,
    },
  ];

  const quickActions: CopilotQuickAction[] = [];
  if (canReadOrders) {
    quickActions.push({
      label: "Ver orden asociada",
      href: `?orderId=${top.orderId}`,
      variant: "primary",
    });
  }
  quickActions.push({
    label: "Módulo de Pagos",
    href: "/payments",
    variant: canReadOrders ? "secondary" : "primary",
  });

  return {
    query: env.query,
    intent: "payment_lookup",
    source,
    headline: `Cobros y pagos${intent.paymentMethod ? ` (${methodLabel})` : ""}`,
    summary: `Encontré ${totalCount} pago${totalCount === 1 ? "" : "s"} por ${formatUsd(totalUsd)}. El más reciente fue de ${custLabel} el ${formatDateTimeEs(top.createdAt)} por ${formatUsd(Number(top.amount))} vía ${methodLabel}${top.reference ? ` (Ref. ${top.reference})` : ""}${topInvoiceNumber ? `, asociado a la factura ${topInvoiceNumber}` : ` en la orden ${top.orderNumber}`}.`,
    details,
    quickActions,
    kpis: [
      {
        label: "Total recaudado",
        value: formatUsd(totalUsd),
        tone: "success",
      },
      {
        label: "Transacciones",
        value: String(totalCount),
        tone: "info",
      },
    ],
    items: rows.map((r) => {
      const invNum = invByOrder.get(r.orderId);
      return {
        id: r.id,
        title: `${PAYMENT_METHOD_ES[r.method] ?? r.method} · ${r.customerName ?? r.payerName ?? "Consumidor"}`,
        subtitle: `${r.reference ? `Ref. ${r.reference} · ` : ""}Orden ${r.orderNumber}${invNum ? ` (${invNum})` : ""} · ${formatDateTimeEs(r.createdAt)}`,
        badgeText: formatUsd(Number(r.amount)),
        badgeTone: r.isValidated ? "success" : "warning",
        href: canReadOrders ? `/orders/${r.orderId}` : "/payments",
      };
    }),
    deepLink: { label: "Abrir Pagos", href: "/payments" },
    latencyMs: Date.now() - startedAt,
  };
}

// ──────────────────────────────────────────────
// 4. DELIVERY NOTES (`DeliveryNote` + `DeliveryNoteItem` + `SalesOrder` + `Customer`)
// ──────────────────────────────────────────────

export async function executeDeliveryNoteLookup(
  env: DomainHandlerEnv,
): Promise<QuickAiQueryResponse> {
  const {
    tx,
    workspaceId,
    intent,
    source,
    startedAt,
    vendorId,
    canApproveOrders,
  } = env;

  const rawEntity =
    (intent.documentNumber ?? intent.searchTerm)?.trim() ?? null;
  const foldedEntity = rawEntity ? foldLocal(rawEntity) : null;
  const escapedEntity = foldedEntity ? `%${escapeLike(foldedEntity)}%` : null;

  const rows = await tx
    .select({
      id: DeliveryNote.id,
      noteNumber: DeliveryNote.noteNumber,
      orderId: DeliveryNote.orderId,
      status: DeliveryNote.status,
      recipientName: DeliveryNote.recipientName,
      recipientIdDoc: DeliveryNote.recipientIdDoc,
      deliveryAddress: DeliveryNote.deliveryAddress,
      dispatchedAt: DeliveryNote.dispatchedAt,
      deliveredAt: DeliveryNote.deliveredAt,
      createdAt: DeliveryNote.createdAt,
      orderNumber: SalesOrder.orderNumber,
      customerName: Customer.name,
    })
    .from(DeliveryNote)
    .innerJoin(
      SalesOrder,
      and(
        eq(DeliveryNote.orderId, SalesOrder.id),
        eq(SalesOrder.workspaceId, workspaceId),
      ),
    )
    .leftJoin(
      Customer,
      and(
        eq(SalesOrder.customerId, Customer.id),
        eq(Customer.workspaceId, workspaceId),
      ),
    )
    .where(
      and(
        eq(DeliveryNote.workspaceId, workspaceId),
        vendorId ? createdByVendor(DeliveryNote.orderId, vendorId) : undefined,
        escapedEntity
          ? or(
              sql`lower(${DeliveryNote.noteNumber}) LIKE ${escapedEntity}`,
              sql`lower(${SalesOrder.orderNumber}) LIKE ${escapedEntity}`,
              sql`translate(lower(COALESCE(${Customer.name}, '')), ${SQL_ACCENT_FROM_CHARS}, ${SQL_ACCENT_TO_CHARS}) LIKE ${escapedEntity}`,
            )
          : undefined,
      ),
    )
    .orderBy(desc(DeliveryNote.createdAt))
    .limit(5);

  const [top] = rows;
  if (!top) {
    return {
      query: env.query,
      intent: "delivery_note_lookup",
      source,
      headline: "Sin notas de entrega coincidentes",
      summary: "No se encontraron notas de entrega con los datos indicados.",
      kpis: [{ label: "Notas de entrega", value: "0", tone: "neutral" }],
      items: [],
      deepLink: canApproveOrders
        ? { label: "Abrir Notas de Entrega", href: "/delivery-notes" }
        : { label: "Abrir Pedidos", href: "/orders" },
      latencyMs: Date.now() - startedAt,
    };
  }

  const dnItems = await tx
    .select({
      quantityDispatched: DeliveryNoteItem.quantityDispatched,
      productName: Product.name,
    })
    .from(DeliveryNoteItem)
    .innerJoin(
      Product,
      and(
        eq(DeliveryNoteItem.productId, Product.id),
        eq(Product.workspaceId, workspaceId),
      ),
    )
    .where(
      and(
        eq(DeliveryNoteItem.workspaceId, workspaceId),
        eq(DeliveryNoteItem.deliveryNoteId, top.id),
      ),
    )
    .limit(5);

  const itemsText =
    dnItems.length > 0
      ? dnItems
          .map((i) => `${i.quantityDispatched}× ${i.productName}`)
          .join(", ")
      : "Sin renglones registrados";

  const details: CopilotDetailField[] = [
    {
      label: "Nota de entrega",
      value: `${top.noteNumber} · Orden ${top.orderNumber}`,
      mono: true,
      tone: "info",
    },
    {
      label: "Cliente / Receptor",
      value: `${top.customerName ?? "Consumidor"}${top.recipientName ? ` · Recibe: ${top.recipientName}` : ""}${top.recipientIdDoc ? ` (${top.recipientIdDoc})` : ""}`,
    },
    {
      label: "Despacho / Entrega",
      value: top.deliveredAt
        ? `Entregada el ${formatDateTimeEs(top.deliveredAt)}`
        : top.dispatchedAt
          ? `Despachada el ${formatDateTimeEs(top.dispatchedAt)}`
          : `Creada el ${formatDateTimeEs(top.createdAt)}`,
    },
    {
      label: "Mercancía despachada",
      value: itemsText,
    },
  ];

  return {
    query: env.query,
    intent: "delivery_note_lookup",
    source,
    headline: `Nota de Entrega ${top.noteNumber}`,
    summary: `La nota de entrega más reciente es la ${top.noteNumber} (Orden ${top.orderNumber}) para ${top.customerName ?? "Consumidor"}, registrada el ${formatDateTimeEs(top.createdAt)}.`,
    details,
    quickActions: [
      {
        label: "Vista rápida de la orden",
        href: `?orderId=${top.orderId}`,
        variant: "primary",
      },
    ],
    kpis: [
      {
        label: "Coincidencias",
        value: String(rows.length),
        tone: "info",
      },
    ],
    items: rows.map((r) => ({
      id: r.id,
      title: `Nota ${r.noteNumber} · ${r.customerName ?? "Consumidor"}`,
      subtitle: `Orden ${r.orderNumber} · ${formatDateTimeEs(r.createdAt)}`,
      badgeText: DOC_STATUS_ES[r.status] ?? r.status,
      badgeTone: r.status === "issued" ? "success" : "neutral",
      href: `/orders/${r.orderId}`,
    })),
    deepLink: canApproveOrders
      ? { label: "Abrir Notas de Entrega", href: "/delivery-notes" }
      : { label: "Abrir Pedidos", href: "/orders" },
    latencyMs: Date.now() - startedAt,
  };
}

// ──────────────────────────────────────────────
// 5. CREDIT NOTES (`CreditNote` + `SalesOrder` + `InternalInvoice` + `Customer`)
// ──────────────────────────────────────────────

export async function executeCreditNoteLookup(
  env: DomainHandlerEnv,
): Promise<QuickAiQueryResponse> {
  const {
    tx,
    workspaceId,
    intent,
    source,
    startedAt,
    vendorId,
    canApproveOrders,
  } = env;

  const rawEntity =
    (intent.documentNumber ?? intent.searchTerm)?.trim() ?? null;
  const foldedEntity = rawEntity ? foldLocal(rawEntity) : null;
  const escapedEntity = foldedEntity ? `%${escapeLike(foldedEntity)}%` : null;

  const rows = await tx
    .select({
      id: CreditNote.id,
      creditNoteNumber: CreditNote.creditNoteNumber,
      orderId: CreditNote.orderId,
      status: CreditNote.status,
      reason: CreditNote.reason,
      returnToStock: CreditNote.returnToStock,
      totalUsd: CreditNote.totalUsd,
      totalVes: CreditNote.totalVes,
      refundMethod: CreditNote.refundMethod,
      createdAt: CreditNote.createdAt,
      orderNumber: SalesOrder.orderNumber,
      invoiceNumber: InternalInvoice.invoiceNumber,
      customerName: Customer.name,
    })
    .from(CreditNote)
    .innerJoin(
      SalesOrder,
      and(
        eq(CreditNote.orderId, SalesOrder.id),
        eq(SalesOrder.workspaceId, workspaceId),
      ),
    )
    .leftJoin(
      InternalInvoice,
      and(
        eq(CreditNote.internalInvoiceId, InternalInvoice.id),
        eq(InternalInvoice.workspaceId, workspaceId),
      ),
    )
    .leftJoin(
      Customer,
      and(
        eq(
          Customer.id,
          sql`COALESCE(${CreditNote.customerId}, ${SalesOrder.customerId})`,
        ),
        eq(Customer.workspaceId, workspaceId),
      ),
    )
    .where(
      and(
        eq(CreditNote.workspaceId, workspaceId),
        vendorId ? createdByVendor(CreditNote.orderId, vendorId) : undefined,
        escapedEntity
          ? or(
              sql`lower(${CreditNote.creditNoteNumber}) LIKE ${escapedEntity}`,
              sql`lower(${SalesOrder.orderNumber}) LIKE ${escapedEntity}`,
              sql`translate(lower(COALESCE(${Customer.name}, '')), ${SQL_ACCENT_FROM_CHARS}, ${SQL_ACCENT_TO_CHARS}) LIKE ${escapedEntity}`,
            )
          : undefined,
      ),
    )
    .orderBy(desc(CreditNote.createdAt))
    .limit(5);

  const [top] = rows;
  if (!top) {
    return {
      query: env.query,
      intent: "credit_note_lookup",
      source,
      headline: "Sin notas de crédito registradas",
      summary:
        "No se encontraron notas de crédito o devoluciones con esos criterios.",
      kpis: [{ label: "Notas de crédito", value: "0", tone: "neutral" }],
      items: [],
      deepLink: canApproveOrders
        ? { label: "Abrir Facturación y NC", href: "/invoices" }
        : { label: "Abrir Pedidos", href: "/orders" },
      latencyMs: Date.now() - startedAt,
    };
  }

  const totalSum = addMoney(...rows.map((r) => Number(r.totalUsd)));

  return {
    query: env.query,
    intent: "credit_note_lookup",
    source,
    headline: `Nota de Crédito ${top.creditNoteNumber}`,
    summary: `La última nota de crédito es la ${top.creditNoteNumber} (${CREDIT_NOTE_STATUS_ES[top.status] ?? top.status}) por ${formatUsd(Number(top.totalUsd))} para ${top.customerName ?? "Consumidor"} sobre la orden ${top.orderNumber}${top.invoiceNumber ? ` / factura ${top.invoiceNumber}` : ""}. Motivo: ${top.reason}.`,
    details: [
      {
        label: "Documento",
        value: `${top.creditNoteNumber} · Orden ${top.orderNumber}${top.invoiceNumber ? ` · Factura ${top.invoiceNumber}` : ""}`,
        mono: true,
      },
      {
        label: "Motivo y stock",
        value: `${top.reason} (${top.returnToStock ? "Reingresa a inventario" : "Sin reingreso de stock"})`,
      },
      {
        label: "Monto y reintegro",
        value: `${formatUsd(Number(top.totalUsd))} (${formatBs(Number(top.totalVes))})${top.refundMethod ? ` · ${PAYMENT_METHOD_ES[top.refundMethod] ?? top.refundMethod}` : ""}`,
        mono: true,
      },
    ],
    quickActions: [
      {
        label: "Vista rápida del pedido",
        href: `?orderId=${top.orderId}`,
        variant: "primary",
      },
    ],
    kpis: [
      {
        label: "Total en muestra",
        value: formatUsd(totalSum),
        tone: "warning",
      },
      {
        label: "Notas",
        value: String(rows.length),
        tone: "neutral",
      },
    ],
    items: rows.map((r) => ({
      id: r.id,
      title: `${r.creditNoteNumber} · ${r.customerName ?? "Consumidor"}`,
      subtitle: `Orden ${r.orderNumber} · ${formatDateTimeEs(r.createdAt)}`,
      badgeText: `${CREDIT_NOTE_STATUS_ES[r.status] ?? r.status} · ${formatUsd(Number(r.totalUsd))}`,
      badgeTone: r.status === "applied" ? "success" : "warning",
      href: `/orders/${r.orderId}`,
    })),
    deepLink: canApproveOrders
      ? { label: "Abrir Facturación y Notas de Crédito", href: "/invoices" }
      : { label: "Abrir Pedidos", href: "/orders" },
    latencyMs: Date.now() - startedAt,
  };
}

// ──────────────────────────────────────────────
// 6. CASH CLOSURES (`CashClosure`)
// ──────────────────────────────────────────────

export async function executeCashClosureStatus(
  env: DomainHandlerEnv,
): Promise<QuickAiQueryResponse> {
  const { tx, workspaceId, source, startedAt } = env;

  const rows = await tx
    .select({
      id: CashClosure.id,
      closureDate: CashClosure.closureDate,
      status: CashClosure.status,
      totalSales: CashClosure.totalSales,
      totalCash: CashClosure.totalCash,
      totalDigital: CashClosure.totalDigital,
      expectedTotal: CashClosure.expectedTotal,
      actualTotal: CashClosure.actualTotal,
      discrepancy: CashClosure.discrepancy,
      notes: CashClosure.notes,
    })
    .from(CashClosure)
    .where(eq(CashClosure.workspaceId, workspaceId))
    .orderBy(desc(CashClosure.closureDate))
    .limit(5);

  const [top] = rows;
  if (!top) {
    return {
      query: env.query,
      intent: "cash_closure_status",
      source,
      headline: "Sin cierres de caja registrados",
      summary:
        "Aún no se han registrado arqueos o cierres de caja en este workspace.",
      kpis: [],
      items: [],
      deepLink: { label: "Abrir Cierre de Caja", href: "/cash-closure" },
      latencyMs: Date.now() - startedAt,
    };
  }

  const diff = roundMoney2(Number(top.discrepancy ?? 0));

  return {
    query: env.query,
    intent: "cash_closure_status",
    source,
    headline: `Último cierre de caja (${CLOSURE_STATUS_ES[top.status] ?? top.status})`,
    summary: `El cierre más reciente corresponde al ${formatDateTimeEs(top.closureDate)} con ventas totales de ${formatUsd(Number(top.totalSales ?? 0))}, contado real de ${formatUsd(Number(top.actualTotal ?? 0))} frente a ${formatUsd(Number(top.expectedTotal ?? 0))} esperado (${Math.abs(diff) <= 0.005 ? "cuadre exacto $0.00" : `diferencia de ${formatUsd(diff)}`}).`,
    details: [
      {
        label: "Efectivo vs Digital",
        value: `Efectivo ${formatUsd(Number(top.totalCash ?? 0))} · Digital ${formatUsd(Number(top.totalDigital ?? 0))}`,
        mono: true,
      },
      {
        label: "Esperado vs Contado",
        value: `Esperado ${formatUsd(Number(top.expectedTotal ?? 0))} · Contado ${formatUsd(Number(top.actualTotal ?? 0))}`,
        mono: true,
      },
      {
        label: "Resultado del arqueo",
        value:
          Math.abs(diff) <= 0.005
            ? "Cuadre exacto ($0.00)"
            : `Diferencia registrada: ${formatUsd(diff)}`,
        tone: Math.abs(diff) <= 0.005 ? "success" : "warning",
      },
    ],
    kpis: [
      {
        label: "Ventas del turno",
        value: formatUsd(Number(top.totalSales ?? 0)),
        tone: "success",
      },
      {
        label: "Diferencia",
        value: formatUsd(diff),
        tone: Math.abs(diff) <= 0.005 ? "success" : "destructive",
      },
    ],
    items: rows.map((c) => {
      const d = roundMoney2(Number(c.discrepancy ?? 0));
      return {
        id: c.id,
        title: `Cierre ${formatDateTimeEs(c.closureDate)}`,
        subtitle: `Efectivo ${formatUsd(Number(c.totalCash ?? 0))} · Digital ${formatUsd(Number(c.totalDigital ?? 0))}`,
        badgeText:
          Math.abs(d) <= 0.005
            ? `${CLOSURE_STATUS_ES[c.status] ?? c.status} · OK`
            : `Dif. ${formatUsd(d)}`,
        badgeTone: Math.abs(d) <= 0.005 ? "success" : "warning",
        href: "/cash-closure",
      };
    }),
    deepLink: { label: "Abrir Cierre de Caja", href: "/cash-closure" },
    latencyMs: Date.now() - startedAt,
  };
}

// ──────────────────────────────────────────────
// 7. CUSTOMER 360° DOSSIER (`Customer` + Orders + Last Invoice + Last Payment + CxC)
// ──────────────────────────────────────────────

export async function executeCustomerDossierLookup(
  env: DomainHandlerEnv,
): Promise<QuickAiQueryResponse> {
  const {
    tx,
    workspaceId,
    intent,
    sanitized,
    source,
    startedAt,
    vendorId,
    canReadOrders,
    canReadPayments,
    canReadReceivables,
  } = env;

  const rawTerm = (intent.searchTerm ?? sanitized).trim();
  const foldedTerm = foldLocal(rawTerm);
  const escapedCustPattern = `%${escapeLike(foldedTerm)}%`;
  const compactCode = escapeLike(foldedTerm.replace(/[^a-z0-9]/g, ""));

  const custRows = await tx
    .select({
      id: Customer.id,
      name: Customer.name,
      legalName: Customer.legalName,
      identification: Customer.identification,
      phone: Customer.phone,
      email: Customer.email,
      customerType: Customer.customerType,
      creditLimit: Customer.creditLimit,
      balance: Customer.balance,
    })
    .from(Customer)
    .where(
      and(
        eq(Customer.workspaceId, workspaceId),
        vendorId ? eq(Customer.assignedVendorId, vendorId) : undefined,
        or(
          sql`translate(lower(${Customer.name}), ${SQL_ACCENT_FROM_CHARS}, ${SQL_ACCENT_TO_CHARS}) LIKE ${escapedCustPattern}`,
          sql`translate(lower(COALESCE(${Customer.legalName}, '')), ${SQL_ACCENT_FROM_CHARS}, ${SQL_ACCENT_TO_CHARS}) LIKE ${escapedCustPattern}`,
          compactCode.length >= 3
            ? sql`lower(regexp_replace(COALESCE(${Customer.identification}, ''), '[^a-zA-Z0-9]', '', 'g')) LIKE ${`%${compactCode}%`}`
            : undefined,
          foldedTerm.length >= 3
            ? sql`extensions.word_similarity(${foldedTerm}, translate(lower(${Customer.name}), ${SQL_ACCENT_FROM_CHARS}, ${SQL_ACCENT_TO_CHARS})) >= 0.38`
            : undefined,
        ),
      ),
    )
    .orderBy(asc(Customer.name))
    .limit(5);

  const [top] = custRows;
  if (!top) {
    return {
      query: env.query,
      intent: "customer_lookup",
      source,
      headline: `Sin coincidencias para "${rawTerm}"`,
      summary: `No encontré clientes o empresas que coincidan con "${rawTerm}" dentro de tu alcance.`,
      kpis: [{ label: "Coincidencias", value: "0", tone: "neutral" }],
      items: [],
      deepLink: {
        label: "Abrir Directorio de Clientes",
        href: `/customers?search=${encodeURIComponent(rawTerm.slice(0, 64))}`,
      },
      latencyMs: Date.now() - startedAt,
    };
  }

  const details: CopilotDetailField[] = [
    {
      label: "Cliente / Empresa",
      value: `${top.name}${top.identification ? ` (${top.identification})` : ""} · ${CUST_TYPE_ES[top.customerType] ?? top.customerType}`,
    },
  ];
  if (top.phone || top.email) {
    details.push({
      label: "Contacto directo",
      value: [top.phone, top.email].filter(Boolean).join(" · "),
    });
  }

  let lastOrderId: string | null = null;
  let totalOrdersCount = 0;
  let lifetimeUsd = 0;

  if (canReadOrders) {
    const orderAgg = await tx
      .select({
        orderCount: sql<number>`COUNT(*)::int`,
        totalSum: sql<string>`COALESCE(SUM(${SalesOrder.total}), 0)`,
      })
      .from(SalesOrder)
      .where(
        and(
          eq(SalesOrder.workspaceId, workspaceId),
          eq(SalesOrder.customerId, top.id),
          vendorId ? eq(SalesOrder.createdBy, vendorId) : undefined,
          sql`${SalesOrder.status} NOT IN ('cancelled', 'returned')`,
        ),
      );
    totalOrdersCount = Number(orderAgg[0]?.orderCount ?? 0);
    lifetimeUsd = roundMoney2(Number(orderAgg[0]?.totalSum ?? 0));

    const recentOrders = await tx
      .select({
        id: SalesOrder.id,
        orderNumber: SalesOrder.orderNumber,
        total: SalesOrder.total,
        channel: SalesOrder.channel,
        createdAt: SalesOrder.createdAt,
      })
      .from(SalesOrder)
      .where(
        and(
          eq(SalesOrder.workspaceId, workspaceId),
          eq(SalesOrder.customerId, top.id),
          vendorId ? eq(SalesOrder.createdBy, vendorId) : undefined,
        ),
      )
      .orderBy(desc(SalesOrder.createdAt))
      .limit(1);

    const lastOrd = recentOrders[0];
    if (lastOrd) {
      lastOrderId = lastOrd.id;
      const lastInvRows = await tx
        .select({
          invoiceNumber: InternalInvoice.invoiceNumber,
          issuedAt: InternalInvoice.issuedAt,
        })
        .from(InternalInvoice)
        .where(
          and(
            eq(InternalInvoice.workspaceId, workspaceId),
            eq(InternalInvoice.orderId, lastOrd.id),
          ),
        )
        .limit(1);
      const lastInv = lastInvRows[0];

      details.push({
        label: "Última compra / factura",
        value: `${lastInv ? `Factura ${lastInv.invoiceNumber} · ` : ""}Orden ${lastOrd.orderNumber} · ${formatUsd(Number(lastOrd.total))} (${formatDateTimeEs(lastInv?.issuedAt ?? lastOrd.createdAt)})`,
        mono: true,
        tone: "info",
      });

      if (canReadPayments) {
        const lastPayRows = await tx
          .select({
            method: Payment.method,
            amount: Payment.amount,
            reference: Payment.reference,
          })
          .from(Payment)
          .where(
            and(
              eq(Payment.workspaceId, workspaceId),
              eq(Payment.orderId, lastOrd.id),
            ),
          )
          .orderBy(desc(Payment.createdAt))
          .limit(2);
        if (lastPayRows.length > 0) {
          details.push({
            label: "Último método de pago",
            value: lastPayRows
              .map(
                (p) =>
                  `${PAYMENT_METHOD_ES[p.method] ?? p.method} ${formatUsd(Number(p.amount))}${p.reference ? ` (Ref. ${p.reference})` : ""}`,
              )
              .join(" + "),
            tone: "success",
          });
        }
      }
    }
  }

  if (canReadReceivables) {
    const bal = Number(top.balance ?? 0);
    const limit = Number(top.creditLimit ?? 0);
    details.push({
      label: "Estado de cuenta (CxC)",
      value: `${bal > 0 ? `Saldo pendiente ${formatUsd(bal)}` : "Al día ($0.00)"}${limit > 0 ? ` · Límite crédito ${formatUsd(limit)}` : ""}`,
      mono: true,
      tone: bal > 0 ? "warning" : "success",
    });
  }

  const quickActions: CopilotQuickAction[] = [
    {
      label: "Ficha rápida del cliente",
      href: `?customerId=${top.id}`,
      variant: "primary",
    },
    {
      label: "Abrir perfil completo",
      href: `/customers/${top.id}`,
      variant: "secondary",
    },
  ];
  if (lastOrderId) {
    quickActions.push({
      label: "Ver última orden / factura",
      href: `?orderId=${lastOrderId}`,
      variant: "secondary",
    });
  }

  const kpis: QuickQueryKpi[] = [
    {
      label: "Coincidencias",
      value: String(custRows.length),
      tone: "info",
    },
  ];
  if (canReadOrders && totalOrdersCount > 0) {
    kpis.push({
      label: `Compras (${totalOrdersCount})`,
      value: formatUsd(lifetimeUsd),
      tone: "success",
    });
  } else if (canReadReceivables) {
    const topBal = Number(top.balance ?? 0);
    kpis.push({
      label: "Saldo actual",
      value: formatUsd(topBal),
      tone: topBal > 0 ? "warning" : "success",
    });
  }

  return {
    query: env.query,
    intent: "customer_lookup",
    source,
    headline: `Ficha 360°: ${top.name}`,
    summary: `Encontré ${custRows.length} cliente${custRows.length === 1 ? "" : "s"} para "${rawTerm}". Principal: ${top.name}${top.identification ? ` (${top.identification})` : ""}${canReadOrders && totalOrdersCount > 0 ? `, con ${totalOrdersCount} compras históricas por ${formatUsd(lifetimeUsd)}` : ""}${canReadReceivables ? ` y saldo actual de ${formatUsd(Number(top.balance ?? 0))}` : ""}.`,
    details,
    quickActions,
    kpis,
    items: custRows.map((c) => {
      const bal = Number(c.balance ?? 0);
      return {
        id: c.id,
        title: c.name,
        subtitle: `${c.identification ?? "Sin documento"}${c.phone ? ` · ${c.phone}` : ""} · ${CUST_TYPE_ES[c.customerType] ?? c.customerType}`,
        badgeText: canReadReceivables
          ? bal > 0
            ? `Saldo ${formatUsd(bal)}`
            : "Al día ($0.00)"
          : (CUST_TYPE_ES[c.customerType] ?? "Cliente"),
        badgeTone: canReadReceivables && bal > 0 ? "warning" : "success",
        href: `/customers/${c.id}`,
      };
    }),
    deepLink: {
      label: "Abrir Directorio de Clientes",
      href: `/customers?search=${encodeURIComponent(rawTerm.slice(0, 64))}`,
    },
    latencyMs: Date.now() - startedAt,
  };
}

// ──────────────────────────────────────────────
// 8. PRODUCT 360° DOSSIER (`Product` + Multi-Tier Prices + Per-Warehouse Stock)
// ──────────────────────────────────────────────

export async function executeProductDossierLookup(
  env: DomainHandlerEnv,
): Promise<QuickAiQueryResponse> {
  // Strictly omits `Product.costAvg` & `ProductSupplier.cost` for ALL roles
  const {
    tx,
    workspaceId,
    intent,
    sanitized,
    source,
    startedAt,
    canReadInventoryStock,
  } = env;

  const rawTerm = (intent.searchTerm ?? sanitized).trim();
  const foldedTerm = foldLocal(rawTerm);
  const escapedLookupPattern = `%${escapeLike(foldedTerm)}%`;
  const skuPrefixLookupPattern = `${escapeLike(foldedTerm)}%`;

  const prodRows = await tx
    .select({
      id: Product.id,
      sku: Product.sku,
      name: Product.name,
      status: Product.status,
      brandName: Brand.name,
      categoryName: Category.name,
      supplierName: Supplier.name,
    })
    .from(Product)
    .leftJoin(
      Brand,
      and(eq(Product.brandId, Brand.id), eq(Brand.workspaceId, workspaceId)),
    )
    .leftJoin(
      Category,
      and(
        eq(Product.categoryId, Category.id),
        eq(Category.workspaceId, workspaceId),
      ),
    )
    .leftJoin(
      Supplier,
      and(
        eq(Product.supplierId, Supplier.id),
        eq(Supplier.workspaceId, workspaceId),
      ),
    )
    .where(
      and(
        eq(Product.workspaceId, workspaceId),
        or(
          sql`translate(lower(${Product.name}), ${SQL_ACCENT_FROM_CHARS}, ${SQL_ACCENT_TO_CHARS}) LIKE ${escapedLookupPattern}`,
          sql`lower(${Product.sku}) LIKE ${escapedLookupPattern}`,
          sql`extensions.word_similarity(${foldedTerm}, translate(lower(${Product.name}), ${SQL_ACCENT_FROM_CHARS}, ${SQL_ACCENT_TO_CHARS})) >= 0.35`,
        ),
      ),
    )
    .orderBy(
      sql`CASE
        WHEN lower(${Product.sku}) = ${foldedTerm} THEN 0
        WHEN lower(${Product.sku}) LIKE ${skuPrefixLookupPattern} THEN 1
        WHEN translate(lower(${Product.name}), ${SQL_ACCENT_FROM_CHARS}, ${SQL_ACCENT_TO_CHARS}) LIKE ${escapedLookupPattern} THEN 2
        ELSE 3
      END`,
      asc(Product.name),
    )
    .limit(5);

  const prodIds = prodRows.map((p) => p.id);
  const pricesByProd = new Map<
    string,
    { priceType: string; amountUsd: number }[]
  >();
  const stockByProd = new Map<string, number>();
  const whBreakdownTop: string[] = [];

  if (prodIds.length > 0) {
    const priceRows = await tx
      .select({
        productId: ProductPrice.productId,
        priceType: ProductPrice.priceType,
        amountUsd: ProductPrice.amountUsd,
      })
      .from(ProductPrice)
      .where(
        and(
          eq(ProductPrice.workspaceId, workspaceId),
          inArray(ProductPrice.productId, prodIds),
        ),
      );
    for (const pr of priceRows) {
      const list = pricesByProd.get(pr.productId) ?? [];
      list.push({ priceType: pr.priceType, amountUsd: Number(pr.amountUsd) });
      pricesByProd.set(pr.productId, list);
    }

    if (canReadInventoryStock) {
      const stockRows = await tx
        .select({
          productId: StockLedger.productId,
          qty: sql<number>`COALESCE(SUM(${StockLedger.quantity}), 0)::int`,
        })
        .from(StockLedger)
        .where(
          and(
            eq(StockLedger.workspaceId, workspaceId),
            inArray(StockLedger.productId, prodIds),
          ),
        )
        .groupBy(StockLedger.productId);
      for (const sr of stockRows) {
        stockMapSet(stockByProd, sr.productId, Number(sr.qty));
      }

      const topId = prodRows[0]?.id;
      if (topId) {
        const whRows = await tx
          .select({
            whName: Warehouse.name,
            qty: StockLedger.quantity,
          })
          .from(StockLedger)
          .innerJoin(
            Warehouse,
            and(
              eq(StockLedger.warehouseId, Warehouse.id),
              eq(Warehouse.workspaceId, workspaceId),
            ),
          )
          .where(
            and(
              eq(StockLedger.workspaceId, workspaceId),
              eq(StockLedger.productId, topId),
            ),
          );
        for (const w of whRows) {
          whBreakdownTop.push(`${w.whName}: ${Number(w.qty)} unid.`);
        }
      }
    }
  }

  const activeBcv = await fetchActiveBcvRate(tx, workspaceId);
  const topProd = prodRows[0];
  const details: CopilotDetailField[] = [];
  const quickActions: CopilotQuickAction[] = [];

  if (topProd) {
    const topPrices = pricesByProd.get(topProd.id) ?? [];
    const storeTier = topPrices.find((t) => t.priceType === "store");
    const wholesaleTier = topPrices.find((t) => t.priceType === "wholesale");

    details.push({
      label: "Producto y SKU",
      value: `${topProd.name} (${topProd.sku})${topProd.brandName ? ` · ${topProd.brandName}` : ""}${topProd.categoryName ? ` · ${topProd.categoryName}` : ""}`,
    });

    if (topPrices.length > 0) {
      const priceSummary = [storeTier, wholesaleTier]
        .filter((t): t is { priceType: string; amountUsd: number } =>
          Boolean(t),
        )
        .map(
          (t) =>
            `${PRICE_TYPE_ES[t.priceType] ?? t.priceType}: ${formatUsd(t.amountUsd)}${activeBcv ? ` (${formatBs(convertUsdToVes(t.amountUsd, activeBcv))})` : ""}`,
        )
        .join(" · ");
      if (priceSummary) {
        details.push({
          label: "Precios vigentes",
          value: priceSummary,
          mono: true,
          tone: "success",
        });
      }
    }

    if (canReadInventoryStock) {
      const totalStock = stockByProd.get(topProd.id) ?? 0;
      details.push({
        label: "Disponibilidad en almacén",
        value:
          whBreakdownTop.length > 0
            ? `Total ${totalStock} unid. (${whBreakdownTop.join(" · ")})`
            : `${totalStock} unidades disponibles`,
        tone: totalStock > 0 ? "info" : "destructive",
      });
    }

    quickActions.push(
      {
        label: "Ficha rápida del producto",
        href: `?productId=${topProd.id}`,
        variant: "primary",
      },
      {
        label: "Abrir en Catálogo",
        href: `/catalog/${topProd.id}`,
        variant: "secondary",
      },
    );
  }

  const PRODUCT_STATUS_ES: Record<string, string> = {
    active: "Activo",
    inactive: "Inactivo",
    draft: "Borrador",
    blocked: "Bloqueado",
    discontinued: "Descontinuado",
  };

  const items: QuickQueryResultRow[] = prodRows.map((p) => {
    const tiers = pricesByProd.get(p.id) ?? [];
    const storeUsd = tiers.find((t) => t.priceType === "store")?.amountUsd;
    const stockQty = stockByProd.get(p.id);
    const stockSuffix =
      canReadInventoryStock && stockQty !== undefined
        ? ` · Stock: ${stockQty}`
        : "";
    const bsSuffix =
      storeUsd !== undefined && activeBcv
        ? ` · ${formatBs(convertUsdToVes(storeUsd, activeBcv))}`
        : "";
    return {
      id: p.id,
      title: p.name,
      subtitle: `SKU ${p.sku}${stockSuffix}${bsSuffix}`,
      badgeText:
        storeUsd !== undefined
          ? formatUsd(storeUsd)
          : (PRODUCT_STATUS_ES[p.status] ?? p.status),
      badgeTone:
        canReadInventoryStock && (stockQty ?? 1) <= 0 ? "destructive" : "info",
      href: `/catalog/${p.id}`,
    };
  });

  const topStoreUsd = topProd
    ? pricesByProd.get(topProd.id)?.find((t) => t.priceType === "store")
        ?.amountUsd
    : undefined;
  const topStock = topProd ? stockByProd.get(topProd.id) : undefined;

  return {
    query: env.query,
    intent: "catalog_lookup",
    source,
    headline: `Consulta de catálogo: "${rawTerm}"`,
    summary:
      items.length === 0
        ? `No hubo coincidencias literales para "${rawTerm}" en el catálogo.`
        : topProd && topStoreUsd !== undefined
          ? `Encontré ${items.length} producto${items.length === 1 ? "" : "s"}. Principal: ${topProd.name} (${topProd.sku}) en ${formatUsd(topStoreUsd)}${activeBcv ? ` (${formatBs(convertUsdToVes(topStoreUsd, activeBcv))} a BCV)` : ""}${canReadInventoryStock && topStock !== undefined ? `, con ${topStock} unidades en stock` : ""}.`
          : `Mostrando ${items.length} productos del catálogo${canReadInventoryStock ? " con existencias actuales" : ""}.`,
    details: details.length > 0 ? details : undefined,
    quickActions: quickActions.length > 0 ? quickActions : undefined,
    kpis: [
      {
        label: "Resultados",
        value: String(items.length),
        tone: items.length > 0 ? "info" : "neutral",
      },
      ...(activeBcv
        ? [
            {
              label: "Tasa BCV aplicada",
              value: `Bs. ${roundMoney4(activeBcv)}`,
              tone: "neutral" as const,
            },
          ]
        : []),
    ],
    items,
    deepLink: {
      label: "Buscar en catálogo",
      href: `/catalog?search=${encodeURIComponent(rawTerm)}`,
    },
    latencyMs: Date.now() - startedAt,
  };
}

function stockMapSet(map: Map<string, number>, k: string, v: number): void {
  map.set(k, v);
}

// ──────────────────────────────────────────────
// 9. SUPPLIERS (`Supplier`)
// ──────────────────────────────────────────────

export async function executeSupplierLookup(
  env: DomainHandlerEnv,
): Promise<QuickAiQueryResponse> {
  const { tx, workspaceId, intent, source, startedAt, canReadPricing } = env;
  const rawTerm = intent.searchTerm?.trim() ?? null;
  const foldedTerm = rawTerm ? foldLocal(rawTerm) : null;
  const escaped = foldedTerm ? `%${escapeLike(foldedTerm)}%` : null;

  const rows = await tx
    .select({
      id: Supplier.id,
      name: Supplier.name,
      rif: Supplier.rif,
      country: Supplier.country,
      contactName: Supplier.contactName,
      contactPhone: Supplier.contactPhone,
    })
    .from(Supplier)
    .where(
      and(
        eq(Supplier.workspaceId, workspaceId),
        escaped
          ? or(
              sql`translate(lower(${Supplier.name}), ${SQL_ACCENT_FROM_CHARS}, ${SQL_ACCENT_TO_CHARS}) LIKE ${escaped}`,
              canReadPricing ? ilike(Supplier.rif, escaped) : undefined,
            )
          : undefined,
      ),
    )
    .orderBy(asc(Supplier.name))
    .limit(5);

  return {
    query: env.query,
    intent: "supplier_lookup",
    source,
    headline: rawTerm ? `Proveedores: "${rawTerm}"` : "Proveedores activos",
    summary:
      rows.length === 0
        ? "No se encontraron proveedores registrados con ese criterio."
        : `Mostrando ${rows.length} proveedor${rows.length === 1 ? "" : "es"} del directorio comercial.`,
    kpis: [{ label: "Proveedores", value: String(rows.length), tone: "info" }],
    items: rows.map((s) => ({
      id: s.id,
      title: s.name,
      subtitle: [
        `País ${s.country}`,
        canReadPricing ? s.rif : null,
        canReadPricing ? s.contactName : null,
        canReadPricing ? s.contactPhone : null,
      ]
        .filter(Boolean)
        .join(" · "),
      badgeText: "Ver productos",
      badgeTone: "neutral",
      href: `/catalog?supplierIds=${s.id}`,
    })),
    deepLink: {
      label: "Abrir Directorio de Proveedores",
      href: "/catalog/suppliers",
    },
    latencyMs: Date.now() - startedAt,
  };
}

// ──────────────────────────────────────────────
// 10. WAREHOUSES & KARDEX MOVEMENTS (`Warehouse` + `StockLedger` + `StockMovement`)
// ──────────────────────────────────────────────

export async function executeWarehouseStockLookup(
  env: DomainHandlerEnv,
): Promise<QuickAiQueryResponse> {
  const { tx, workspaceId, source, startedAt, canNavigateInventoryPage } = env;

  const whRows = await tx
    .select({
      id: Warehouse.id,
      name: Warehouse.name,
      type: Warehouse.type,
      totalUnits: sql<number>`COALESCE(SUM(${StockLedger.quantity}), 0)::int`,
    })
    .from(Warehouse)
    .leftJoin(
      StockLedger,
      and(
        eq(StockLedger.warehouseId, Warehouse.id),
        eq(StockLedger.workspaceId, workspaceId),
      ),
    )
    .where(
      and(eq(Warehouse.workspaceId, workspaceId), eq(Warehouse.isActive, true)),
    )
    .groupBy(Warehouse.id, Warehouse.name, Warehouse.type)
    .orderBy(asc(Warehouse.name))
    .limit(6);

  const movRows = await tx
    .select({
      id: StockMovement.id,
      movementType: StockMovement.movementType,
      quantity: StockMovement.quantity,
      createdAt: StockMovement.createdAt,
      productName: Product.name,
      productId: Product.id,
    })
    .from(StockMovement)
    .innerJoin(
      Product,
      and(
        eq(StockMovement.productId, Product.id),
        eq(Product.workspaceId, workspaceId),
      ),
    )
    .where(eq(StockMovement.workspaceId, workspaceId))
    .orderBy(desc(StockMovement.createdAt))
    .limit(4);

  const totalUnitsAll = whRows.reduce(
    (acc, w) => acc + Number(w.totalUnits),
    0,
  );

  const details: CopilotDetailField[] = whRows.slice(0, 4).map((w) => ({
    label: w.name,
    value: `${Number(w.totalUnits)} unidades disponibles`,
    mono: true,
    tone: Number(w.totalUnits) > 0 ? "info" : "neutral",
  }));

  return {
    query: env.query,
    intent: "warehouse_stock_lookup",
    source,
    headline: "Almacenes y últimos movimientos de kardex",
    summary: `Operan ${whRows.length} almacenes activos con ${totalUnitsAll.toLocaleString("es-VE")} unidades totales en existencia.`,
    details: details.length > 0 ? details : undefined,
    kpis: [
      {
        label: "Almacenes activos",
        value: String(whRows.length),
        tone: "info",
      },
      {
        label: "Unidades totales",
        value: String(totalUnitsAll),
        tone: "success",
      },
    ],
    items: movRows.map((m) => ({
      id: m.id,
      title: `${MOVEMENT_TYPE_ES[m.movementType] ?? m.movementType} · ${m.productName}`,
      subtitle: formatDateTimeEs(m.createdAt),
      badgeText: `${m.quantity > 0 ? "+" : ""}${m.quantity} unid.`,
      badgeTone: m.quantity >= 0 ? "success" : "warning",
      href: canNavigateInventoryPage ? "/inventory" : `/catalog/${m.productId}`,
    })),
    deepLink: canNavigateInventoryPage
      ? { label: "Abrir Inventario y Almacenes", href: "/inventory" }
      : { label: "Abrir Catálogo", href: "/catalog" },
    latencyMs: Date.now() - startedAt,
  };
}

// ──────────────────────────────────────────────
// 11. VENDOR COMMISSIONS (`VendorCommission` + `UserProfile` + `SalesOrder`)
// ──────────────────────────────────────────────

export async function executeVendorCommissionsLookup(
  env: DomainHandlerEnv,
): Promise<QuickAiQueryResponse> {
  const {
    tx,
    workspaceId,
    source,
    startedAt,
    vendorId,
    canApproveVendors,
    canReadOrders,
  } = env;

  const commWhere = and(
    eq(VendorCommission.workspaceId, workspaceId),
    vendorId ? eq(VendorCommission.vendorId, vendorId) : undefined,
  );

  const rows = await tx
    .select({
      id: VendorCommission.id,
      orderId: VendorCommission.orderId,
      commissionAmount: VendorCommission.commissionAmount,
      commissionPct: VendorCommission.commissionPct,
      isPaid: VendorCommission.isPaid,
      createdAt: VendorCommission.createdAt,
      orderNumber: SalesOrder.orderNumber,
      vendorName: UserProfile.fullName,
    })
    .from(VendorCommission)
    .innerJoin(
      SalesOrder,
      and(
        eq(VendorCommission.orderId, SalesOrder.id),
        eq(SalesOrder.workspaceId, workspaceId),
      ),
    )
    .leftJoin(UserProfile, eq(VendorCommission.vendorId, UserProfile.id))
    .where(commWhere)
    .orderBy(desc(VendorCommission.createdAt))
    .limit(20);

  let unpaidSum = 0;
  let paidSum = 0;
  for (const r of rows) {
    if (r.isPaid) paidSum = addMoney(paidSum, Number(r.commissionAmount));
    else unpaidSum = addMoney(unpaidSum, Number(r.commissionAmount));
  }

  return {
    query: env.query,
    intent: "vendor_commissions_lookup",
    source,
    headline: "Estado de comisiones de venta",
    summary:
      rows.length === 0
        ? "No hay comisiones registradas en el período consultado."
        : `Comisiones recientes: ${formatUsd(unpaidSum)} pendientes de liquidación y ${formatUsd(paidSum)} pagadas.`,
    kpis: [
      {
        label: "Por liquidar",
        value: formatUsd(unpaidSum),
        tone: unpaidSum > 0 ? "warning" : "success",
      },
      {
        label: "Liquidadas",
        value: formatUsd(paidSum),
        tone: "success",
      },
    ],
    items: rows.slice(0, 5).map((r) => ({
      id: r.id,
      title: `${r.vendorName ?? "Vendedor"} · Orden ${r.orderNumber}`,
      subtitle: `${roundMoney2(Number(r.commissionPct))}% · ${formatDateTimeEs(r.createdAt)}`,
      badgeText: `${r.isPaid ? "Pagada" : "Pendiente"} ${formatUsd(Number(r.commissionAmount))}`,
      badgeTone: r.isPaid ? "success" : "warning",
      href: canReadOrders
        ? `/orders/${r.orderId}`
        : canApproveVendors
          ? "/vendors"
          : "/dashboard",
    })),
    deepLink: canApproveVendors
      ? { label: "Abrir Portal de Vendedores", href: "/vendors" }
      : canReadOrders
        ? { label: "Ver Mis Pedidos", href: "/orders" }
        : null,
    latencyMs: Date.now() - startedAt,
  };
}

// ──────────────────────────────────────────────
// 12. APPROVALS & SYSTEM ALERTS (`Approval` + `SystemAlert`)
// ──────────────────────────────────────────────

export async function executeApprovalsAlertsLookup(
  env: DomainHandlerEnv,
): Promise<QuickAiQueryResponse> {
  const { tx, workspaceId, source, startedAt } = env;

  const approvals = await tx
    .select({
      id: Approval.id,
      approvalType: Approval.approvalType,
      reason: Approval.reason,
      requestedAt: Approval.requestedAt,
      requesterName: UserProfile.fullName,
    })
    .from(Approval)
    .leftJoin(UserProfile, eq(Approval.requestedBy, UserProfile.id))
    .where(
      and(
        eq(Approval.workspaceId, workspaceId),
        eq(Approval.status, "pending"),
      ),
    )
    .orderBy(desc(Approval.requestedAt))
    .limit(5);

  const alerts = await tx
    .select({
      id: SystemAlert.id,
      title: SystemAlert.title,
      severity: SystemAlert.severity,
      createdAt: SystemAlert.createdAt,
    })
    .from(SystemAlert)
    .where(
      and(
        eq(SystemAlert.workspaceId, workspaceId),
        eq(SystemAlert.isDismissed, false),
      ),
    )
    .orderBy(desc(SystemAlert.createdAt))
    .limit(5);

  const items: QuickQueryResultRow[] = [
    ...approvals.map((a) => ({
      id: a.id,
      title: `Aprobación: ${APPROVAL_TYPE_ES[a.approvalType] ?? a.approvalType}`,
      subtitle: `${a.requesterName ?? "Usuario"} · ${formatDateTimeEs(a.requestedAt)}${a.reason ? ` · ${a.reason}` : ""}`,
      badgeText: "Por aprobar",
      badgeTone: "warning" as const,
      href: "/alerts",
    })),
    ...alerts.map((al) => ({
      id: al.id,
      title: al.title,
      subtitle: formatDateTimeEs(al.createdAt),
      badgeText: al.severity === "high" ? "Alta prioridad" : "Alerta activa",
      badgeTone:
        al.severity === "high" ? ("destructive" as const) : ("info" as const),
      href: "/alerts",
    })),
  ].slice(0, 6);

  return {
    query: env.query,
    intent: "approvals_alerts_lookup",
    source,
    headline: "Aprobaciones pendientes y alertas operativas",
    summary:
      approvals.length === 0 && alerts.length === 0
        ? "No hay solicitudes pendientes de aprobación ni alertas activas."
        : `Hay ${approvals.length} solicitud${approvals.length === 1 ? "" : "es"} esperando firma/aprobación y ${alerts.length} alerta${alerts.length === 1 ? "" : "s"} activa${alerts.length === 1 ? "" : "s"}.`,
    kpis: [
      {
        label: "Por aprobar",
        value: String(approvals.length),
        tone: approvals.length > 0 ? "warning" : "success",
      },
      {
        label: "Alertas activas",
        value: String(alerts.length),
        tone: alerts.length > 0 ? "info" : "neutral",
      },
    ],
    items,
    deepLink: {
      label: "Abrir Centro de Alertas y Aprobaciones",
      href: "/alerts",
    },
    latencyMs: Date.now() - startedAt,
  };
}

// ──────────────────────────────────────────────
// 13. TOP SELLING PRODUCTS (`OrderItem` + `SalesOrder` + `Product`)
// ──────────────────────────────────────────────

export async function executeTopProductsLookup(
  env: DomainHandlerEnv,
): Promise<QuickAiQueryResponse> {
  const { tx, workspaceId, intent, source, startedAt, vendorId } = env;

  const sinceDate = buildSinceDate(intent.timeWindow ?? "30d");
  const unitsExpr = sql<number>`COALESCE(SUM(${OrderItem.quantity}), 0)::int`;
  const revExpr = sql<string>`COALESCE(SUM(${OrderItem.lineTotal}), 0)`;

  const rows = await tx
    .select({
      productId: Product.id,
      sku: Product.sku,
      name: Product.name,
      unitsSold: unitsExpr,
      revenueUsd: revExpr,
    })
    .from(OrderItem)
    .innerJoin(
      SalesOrder,
      and(
        eq(OrderItem.orderId, SalesOrder.id),
        eq(SalesOrder.workspaceId, workspaceId),
      ),
    )
    .innerJoin(
      Product,
      and(
        eq(OrderItem.productId, Product.id),
        eq(Product.workspaceId, workspaceId),
      ),
    )
    .where(
      and(
        eq(OrderItem.workspaceId, workspaceId),
        vendorId ? eq(SalesOrder.createdBy, vendorId) : undefined,
        sinceDate ? gt(SalesOrder.createdAt, sinceDate) : undefined,
        sql`${SalesOrder.status} NOT IN ('cancelled', 'returned')`,
      ),
    )
    .groupBy(Product.id, Product.sku, Product.name)
    .orderBy(desc(revExpr))
    .limit(5);

  const topRevenue = addMoney(...rows.map((r) => Number(r.revenueUsd)));

  return {
    query: env.query,
    intent: "top_products",
    source,
    headline: "Productos más vendidos por facturación",
    summary:
      rows.length === 0
        ? "Aún no hay renglones vendidos en el período seleccionado."
        : `El producto líder es ${rows[0]?.name} (${rows[0]?.unitsSold} unid. · ${formatUsd(Number(rows[0]?.revenueUsd ?? 0))}).`,
    kpis: [
      {
        label: "Top 5 facturación",
        value: formatUsd(topRevenue),
        tone: "success",
      },
      {
        label: "SKUs líderes",
        value: String(rows.length),
        tone: "info",
      },
    ],
    items: rows.map((r, idx) => ({
      id: r.productId,
      title: `#${idx + 1} ${r.name}`,
      subtitle: `SKU ${r.sku} · ${Number(r.unitsSold)} unidades vendidas`,
      badgeText: formatUsd(Number(r.revenueUsd)),
      badgeTone: "success",
      href: `/catalog/${r.productId}`,
    })),
    deepLink: { label: "Abrir Catálogo", href: "/catalog" },
    latencyMs: Date.now() - startedAt,
  };
}
