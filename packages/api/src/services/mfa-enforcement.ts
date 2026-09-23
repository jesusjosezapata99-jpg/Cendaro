/**
 * MFA enforcement for privileged roles (PLAN-2026-09-SECURITY-REMEDIATION
 * F7.2, finding M8: "MFA obligatorio para roles privilegiados").
 *
 * `packages/api/src/modules/users.ts` already exposed `mfaStatus` (F1.3),
 * reading the session's `aal` claim — but nothing enforced it. This module is
 * the single source of truth both the enforcement gate (trpc.ts) and the
 * `mfaStatus` display read, so the banner the UI shows and the block the
 * server applies can never disagree with each other.
 *
 * Rollout: the cutover comes from the `MFA_ENFORCEMENT_DATE` environment
 * variable (`YYYY-MM-DD`, midnight UTC), not from a literal in code, so it
 * can be scheduled per environment without a code change. A fixed calendar
 * date (rather than "N days after first login") is what lets every
 * owner/admin see the same banner and deadline, and lets an operator
 * announce it in advance. Set it at least 7 days ahead of the deploy so the
 * grace banner is actually shown before calls start failing.
 *
 * Unset means enforcement is not scheduled: nothing is blocked and no banner
 * is shown (TOTP stays available at /settings/security). A malformed value
 * throws at module load — a typo must never silently disable, or silently
 * trigger, a security control.
 */
import type { UserRole } from "@cendaro/validators";

/** Supabase authenticator assurance level (`aal2` = a factor was verified this session). */
export type AuthAssuranceLevel = "aal1" | "aal2";

/** Roles that must carry `aal2` once the grace period ends. */
export const MFA_ENFORCED_ROLES: readonly UserRole[] = ["owner", "admin"];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parses the `MFA_ENFORCEMENT_DATE` environment value. Empty or missing →
 * `null` (not scheduled). Anything other than a real `YYYY-MM-DD` calendar
 * date throws.
 */
export function parseMfaEnforcementDate(raw: string | undefined): Date | null {
  const value = raw?.trim();
  if (!value) return null;

  const date = ISO_DATE.test(value) ? new Date(`${value}T00:00:00Z`) : null;
  // Rejects impossible dates such as 2026-02-30, which Date rolls over.
  if (
    !date ||
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new Error(
      `MFA_ENFORCEMENT_DATE must be a YYYY-MM-DD date (UTC); got "${value}"`,
    );
  }
  return date;
}

/**
 * Enforcement cutover (UTC), or `null` when not scheduled. Before it (or
 * while null): `mfaComplianceFor` never blocks, regardless of role or `aal`.
 * From it onward: an enforced role without `aal2` is blocked.
 */
export const MFA_ENFORCEMENT_DATE: Date | null = parseMfaEnforcementDate(
  process.env.MFA_ENFORCEMENT_DATE,
);

export interface MfaCompliance {
  /** Whether this role must carry aal2 once the grace period ends. */
  required: boolean;
  /** Whether this session already carries aal2. */
  enrolled: boolean;
  /** Whether this call should be refused right now. */
  blocked: boolean;
  /** When enforcement starts (or started); `null` when not scheduled. */
  gracePeriodEndsAt: Date | null;
}

/**
 * Decides whether a call from `role` with assurance level `aal` should be
 * blocked for missing MFA, as of `now`.
 */
export function mfaComplianceFor(
  role: UserRole,
  aal: AuthAssuranceLevel | null | undefined,
  now: Date = new Date(),
  enforcementDate: Date | null = MFA_ENFORCEMENT_DATE,
): MfaCompliance {
  const required = MFA_ENFORCED_ROLES.includes(role);
  const enrolled = aal === "aal2";
  const gracePeriodOver =
    enforcementDate !== null && now.getTime() >= enforcementDate.getTime();
  return {
    required,
    enrolled,
    blocked: required && !enrolled && gracePeriodOver,
    gracePeriodEndsAt: enforcementDate,
  };
}
