/**
 * Commercial rules shared by the API and the UI: how far a price may drop, how
 * an order is paid and which order status can follow which.
 */

/** Tolerance for comparing USD amounts computed in floating point. */
export const MONEY_EPSILON = 0.005;

export const PRICING_POLICY = {
  /** Largest discount below the catalog price without pricing authority. */
  staffMaxDiscountRatio: 0.1,
  /** With pricing authority and no known cost, the floor that replaces it. */
  managerMaxDiscountRatioWithoutCost: 0.5,
} as const;

export const PAYMENT_TERMS = ["cash", "credit"] as const;
export type PaymentTerms = (typeof PAYMENT_TERMS)[number];

/**
 * Status changes a person may request. `pending_confirmation` waits for an
 * approval, whose resolution moves the order; `cancelled` and `returned` are
 * final, and an invoiced order is reversed with a credit note, never cancelled.
 */
export const ORDER_STATUS_TRANSITIONS = {
  draft: ["pending", "cancelled"],
  pending: ["confirmed", "cancelled"],
  pending_confirmation: [],
  confirmed: ["prepared", "dispatched", "invoiced", "cancelled"],
  prepared: ["dispatched", "invoiced", "cancelled"],
  dispatched: ["delivered", "invoiced", "returned"],
  delivered: ["invoiced", "returned"],
  invoiced: ["dispatched", "delivered", "returned"],
  cancelled: [],
  returned: [],
} as const satisfies Record<string, readonly string[]>;

export type OrderStatus = keyof typeof ORDER_STATUS_TRANSITIONS;

export function allowedOrderTransitions(from: string): readonly string[] {
  return from in ORDER_STATUS_TRANSITIONS
    ? ORDER_STATUS_TRANSITIONS[from as OrderStatus]
    : [];
}

export function canTransitionOrder(from: string, to: string): boolean {
  return allowedOrderTransitions(from).includes(to);
}
