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
 * Deploy plan (per the remediation plan): 7 days of a dismissible banner,
 * then owner/admin calls start failing until the account enrolls TOTP.
 * `MFA_ENFORCEMENT_DATE` is the cutover; it is a literal date rather than a
 * runtime-computed "N days after first login" because a fixed calendar date
 * is what lets every owner/admin see the same banner and the same deadline,
 * and what lets an operator announce it in advance. Move this date before
 * deploying if the 7-day window from writing this code has already passed.
 */
import type { UserRole } from "@cendaro/validators";

/** Supabase authenticator assurance level (`aal2` = a factor was verified this session). */
export type AuthAssuranceLevel = "aal1" | "aal2";

/** Roles that must carry `aal2` once the grace period ends. */
export const MFA_ENFORCED_ROLES: readonly UserRole[] = ["owner", "admin"];

/**
 * Enforcement cutover (UTC). Before it: `mfaComplianceFor` never blocks,
 * regardless of role or `aal`. From it onward: an enforced role without
 * `aal2` is blocked.
 */
export const MFA_ENFORCEMENT_DATE = new Date("2026-09-27T00:00:00Z");

export interface MfaCompliance {
  /** Whether this role must carry aal2 once the grace period ends. */
  required: boolean;
  /** Whether this session already carries aal2. */
  enrolled: boolean;
  /** Whether this call should be refused right now. */
  blocked: boolean;
  /** When enforcement starts (or started). */
  gracePeriodEndsAt: Date;
}

/**
 * Decides whether a call from `role` with assurance level `aal` should be
 * blocked for missing MFA, as of `now`.
 */
export function mfaComplianceFor(
  role: UserRole,
  aal: AuthAssuranceLevel | null | undefined,
  now: Date = new Date(),
): MfaCompliance {
  const required = MFA_ENFORCED_ROLES.includes(role);
  const enrolled = aal === "aal2";
  const gracePeriodOver = now.getTime() >= MFA_ENFORCEMENT_DATE.getTime();
  return {
    required,
    enrolled,
    blocked: required && !enrolled && gracePeriodOver,
    gracePeriodEndsAt: MFA_ENFORCEMENT_DATE,
  };
}
