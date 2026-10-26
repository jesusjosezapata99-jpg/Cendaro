/**
 * Cendaro — Deterministic Monetary & Decimal Arithmetic
 *
 * Prevents IEEE-754 floating-point drift (e.g. 0.1 + 0.2 = 0.30000000000000004)
 * across USD/VES dual-currency calculations, BCV conversions, IVA/IGTF taxes,
 * accounts receivable balances, cash closures, and weighted-average costing.
 */

const SCALE_2 = 100;
const SCALE_4 = 10_000;

/**
 * Rounds a number to 2 decimal places (cents / céntimos) using half-away-from-zero
 * epsilon-stabilized integer scaling.
 */
export function roundMoney2(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const sign = value < 0 ? -1 : 1;
  return (
    (sign * Math.round((Math.abs(value) + Number.EPSILON) * SCALE_2)) / SCALE_2
  );
}

/**
 * Rounds a number to 4 decimal places (exchange rates, unit costs, weighted averages).
 */
export function roundMoney4(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const sign = value < 0 ? -1 : 1;
  return (
    (sign * Math.round((Math.abs(value) + Number.EPSILON) * SCALE_4)) / SCALE_4
  );
}

/**
 * Rounds a number to 2 or 4 decimal places.
 */
export function roundMoney(value: number, decimals: 2 | 4 = 2): number {
  return decimals === 4 ? roundMoney4(value) : roundMoney2(value);
}

/**
 * Adds two or more monetary amounts at 2-decimal precision without float drift.
 */
export function addMoney(...amounts: number[]): number {
  let scaledSum = 0;
  for (const amount of amounts) {
    if (!Number.isFinite(amount)) continue;
    const sign = amount < 0 ? -1 : 1;
    scaledSum +=
      sign * Math.round((Math.abs(amount) + Number.EPSILON) * SCALE_4);
  }
  return roundMoney2(scaledSum / SCALE_4);
}

/**
 * Subtracts `b` from `a` at 2-decimal precision.
 */
export function subtractMoney(a: number, b: number): number {
  return addMoney(a, -b);
}

/**
 * Multiplies quantity × unitPrice (or amount × factor) and rounds to 2 decimals.
 */
export function multiplyMoney(quantity: number, unitPrice: number): number {
  if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice)) return 0;
  return roundMoney2(quantity * unitPrice);
}

/**
 * Converts a USD amount to VES (Bolívares) using a 4-decimal BCV rate,
 * returning a 2-decimal VES amount.
 */
export function convertUsdToVes(amountUsd: number, bcvRate: number): number {
  if (
    !Number.isFinite(amountUsd) ||
    !Number.isFinite(bcvRate) ||
    bcvRate <= 0
  ) {
    return 0;
  }
  return roundMoney2(roundMoney4(amountUsd) * roundMoney4(bcvRate));
}

/**
 * Converts a VES amount to USD using a 4-decimal BCV rate,
 * returning a 2-decimal USD amount.
 */
export function convertVesToUsd(amountVes: number, bcvRate: number): number {
  if (
    !Number.isFinite(amountVes) ||
    !Number.isFinite(bcvRate) ||
    bcvRate <= 0
  ) {
    return 0;
  }
  return roundMoney2(roundMoney4(amountVes) / roundMoney4(bcvRate));
}

/**
 * Computes `amount * (pct / 100)` rounded to 2 decimal places.
 */
export function calculatePercentage(amount: number, pct: number): number {
  if (!Number.isFinite(amount) || !Number.isFinite(pct)) return 0;
  return roundMoney2((amount * pct) / 100);
}

/**
 * Computes the weighted average unit cost when receiving new inventory:
 * ((currentQty * currentCostAvg) + (receivedQty * receivedUnitCost)) / (currentQty + receivedQty)
 */
export function computeWeightedAverageCost(
  currentQty: number,
  currentCostAvg: number,
  receivedQty: number,
  receivedUnitCost: number,
): number {
  if (receivedQty <= 0) return roundMoney4(Math.max(0, currentCostAvg));
  const safeCurrentQty = Math.max(0, currentQty);
  const safeCurrentCost = Math.max(0, currentCostAvg);
  const totalQty = safeCurrentQty + receivedQty;
  if (totalQty <= 0) return roundMoney4(receivedUnitCost);
  const totalValue =
    safeCurrentQty * safeCurrentCost + receivedQty * receivedUnitCost;
  return roundMoney4(totalValue / totalQty);
}
