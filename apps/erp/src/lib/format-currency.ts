/**
 * Format a USD amount with its BCV-converted Bs equivalent.
 * Used across all ERP pages for dual-currency display.
 */
export function formatDualCurrency(
  amountUsd: number,
  bcvRate: number,
): { usd: string; bs: string } {
  return {
    usd: `$${amountUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    bs:
      bcvRate > 0
        ? `Bs ${(amountUsd * bcvRate).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : "",
  };
}

/**
 * Format a USD amount with its CNY (RMB) equivalent.
 * Used for Chinese Yuan conversion display.
 */
export function formatCnyCurrency(
  amountUsd: number,
  cnyRate: number,
): { usd: string; cny: string } {
  return {
    usd: `$${amountUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    cny:
      cnyRate > 0
        ? `¥${(amountUsd * cnyRate).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : "",
  };
}
