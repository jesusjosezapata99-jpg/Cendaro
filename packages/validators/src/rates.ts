/**
 * Exchange-rate trust rules shared by the server and the browser
 * (PLAN-2026-09-SECURITY-REMEDIATION F4.1, decision 6).
 *
 * The server stores an upstream rate on its own only while it stays within
 * MAX_AUTOMATIC_RATE_DEVIATION of the last stored one; a larger move waits for
 * an owner/admin. The browser applies the same rule when it shows a live rate
 * next to the stored one, so a rate the server held never reaches prices,
 * invoices or bolívar conversions before someone accepts it.
 */

/** Largest move from the last stored rate applied without a human. */
export const MAX_AUTOMATIC_RATE_DEVIATION = 0.15;

/** True when `candidate` moved more than the automatic limit from `reference`. */
export function exceedsAutomaticRateDeviation(
  candidate: number,
  reference: number,
): boolean {
  if (!(reference > 0) || !(candidate > 0)) return false;
  return Math.abs(candidate / reference - 1) > MAX_AUTOMATIC_RATE_DEVIATION;
}

export type TrustedRateOrigin = "live" | "stored" | "none";

/**
 * Which rate a screen may use: the live one unless it moved beyond the
 * automatic limit from the stored one (then it is pending approval and the
 * stored rate stays in force). Without a live rate the stored one is used.
 */
export function pickTrustedRate(
  live: number | null | undefined,
  stored: number | null | undefined,
): TrustedRateOrigin {
  const hasLive = typeof live === "number" && live > 0;
  const hasStored = typeof stored === "number" && stored > 0;
  if (hasLive && hasStored && exceedsAutomaticRateDeviation(live, stored)) {
    return "stored";
  }
  if (hasLive) return "live";
  return hasStored ? "stored" : "none";
}
