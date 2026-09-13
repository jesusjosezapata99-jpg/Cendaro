import type { StatusTone } from "@cendaro/ui/status-pill";

export type { StatusTone };

/**
 * Single source of truth for status → {label, tone} across the ERP
 * (PLAN-2026-09-MIDDAY-REDESIGN §5.3, T1.9). Replaces the ~12 duplicated
 * `STATUS_CONFIG` maps that used to live inline in each page — labels are
 * preserved verbatim from those maps, only the tone assignment changed to
 * match Midday's 7-tone status vocabulary.
 */

interface StatusEntry {
  label: string;
  tone: StatusTone;
}

const ORDER_STATUS: Record<string, StatusEntry> = {
  draft: { label: "Borrador", tone: "neutral" },
  pending: { label: "Pendiente", tone: "warning" },
  pending_confirmation: { label: "Por Confirmar", tone: "warning" },
  confirmed: { label: "Confirmado", tone: "default" },
  prepared: { label: "Preparado", tone: "default" },
  dispatched: { label: "Despachado", tone: "info" },
  delivered: { label: "Entregado", tone: "success" },
  invoiced: { label: "Facturado", tone: "success" },
  cancelled: { label: "Anulado", tone: "destructive" },
  returned: { label: "Devuelto", tone: "orange" },
};

/** Delivery notes reuse the order enum's tones (§5.3: "mismo tono que
 * pedido") with their own labels (delivery-notes/client.tsx). */
const DELIVERY_NOTE_STATUS: Record<string, StatusEntry> = {
  draft: { label: "Borrador", tone: "neutral" },
  pending: { label: "Pendiente", tone: "warning" },
  pending_confirmation: { label: "Por Confirmar", tone: "warning" },
  confirmed: { label: "Por Preparar", tone: "default" },
  prepared: { label: "Listo p/ Despacho", tone: "default" },
  dispatched: { label: "En Tránsito", tone: "info" },
  delivered: { label: "Entregado", tone: "success" },
  invoiced: { label: "Completado", tone: "success" },
  cancelled: { label: "Anulado", tone: "destructive" },
  returned: { label: "Devuelto", tone: "orange" },
};

const QUOTE_STATUS: Record<string, StatusEntry> = {
  draft: { label: "Borrador", tone: "neutral" },
  sent: { label: "Enviada", tone: "info" },
  accepted: { label: "Aceptada", tone: "success" },
  rejected: { label: "Rechazada", tone: "destructive" },
  expired: { label: "Expirada", tone: "warning" },
  converted: { label: "Convertida", tone: "default" },
};

const AR_STATUS: Record<string, StatusEntry> = {
  pending: { label: "Pendiente", tone: "default" },
  partial: { label: "Abono Parcial", tone: "info" },
  paid: { label: "Pagada", tone: "success" },
  overdue: { label: "Vencida", tone: "warning" },
  written_off: { label: "Castigada", tone: "neutral" },
};

const PRODUCT_STATUS: Record<string, StatusEntry> = {
  active: { label: "Activo", tone: "success" },
  draft: { label: "Borrador", tone: "neutral" },
  discontinued: { label: "Descontinuado", tone: "neutral" },
  inactive: { label: "Inactivo", tone: "neutral" },
  inventory_locked: { label: "Inventario Bloqueado", tone: "warning" },
};

const STOCK_STATUS: Record<string, StatusEntry> = {
  in_stock: { label: "En Stock", tone: "success" },
  low_stock: { label: "Stock Bajo", tone: "warning" },
  out_of_stock: { label: "Sin Stock", tone: "destructive" },
};

const USER_STATUS: Record<string, StatusEntry> = {
  active: { label: "Activo", tone: "success" },
  inactive: { label: "Inactivo", tone: "neutral" },
  suspended: { label: "Suspendido", tone: "destructive" },
};

const CONTAINER_STATUS: Record<string, StatusEntry> = {
  created: { label: "Creado", tone: "neutral" },
  in_transit: { label: "En Tránsito", tone: "info" },
  received: { label: "Recibido", tone: "success" },
  closed: { label: "Cerrado", tone: "default" },
};

const CASH_CLOSURE_STATUS: Record<string, StatusEntry> = {
  open: { label: "Abierta", tone: "warning" },
  closed: { label: "Cerrada", tone: "default" },
  reviewed: { label: "Revisada", tone: "success" },
};

const DOMAINS = {
  order: ORDER_STATUS,
  deliveryNote: DELIVERY_NOTE_STATUS,
  quote: QUOTE_STATUS,
  accountsReceivable: AR_STATUS,
  product: PRODUCT_STATUS,
  stock: STOCK_STATUS,
  user: USER_STATUS,
  container: CONTAINER_STATUS,
  cashClosure: CASH_CLOSURE_STATUS,
} as const;

export type StatusDomain = keyof typeof DOMAINS;

/** Looks up {label, tone} for a status value within a domain. Unknown
 * values fall back to the raw value as the label and a neutral tone. */
export function getStatus(domain: StatusDomain, value: string): StatusEntry {
  return DOMAINS[domain][value] ?? { label: value, tone: "neutral" };
}
