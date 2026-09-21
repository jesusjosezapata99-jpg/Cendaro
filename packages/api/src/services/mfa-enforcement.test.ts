/**
 * MFA enforcement for privileged roles (PLAN-2026-09-SECURITY-REMEDIATION
 * F7.2, finding M8).
 *
 * owner/admin sessions must carry `aal2` (a verified TOTP factor) once the
 * grace period ends; `mfaComplianceFor` is the one place that decides this,
 * shared by the server-side gate (trpc.ts) and the `users.mfaStatus` display
 * the UI reads to show the banner — so the two can never disagree.
 */
import { describe, expect, it } from "vitest";

import {
  MFA_ENFORCED_ROLES,
  MFA_ENFORCEMENT_DATE,
  mfaComplianceFor,
} from "./mfa-enforcement";

const BEFORE = new Date(MFA_ENFORCEMENT_DATE.getTime() - 1);
const AFTER = new Date(MFA_ENFORCEMENT_DATE.getTime() + 1);

describe("mfaComplianceFor", () => {
  it("does not require MFA for roles outside owner/admin", () => {
    for (const role of ["employee", "supervisor", "marketing"] as const) {
      const result = mfaComplianceFor(role, null, AFTER);
      expect(result).toMatchObject({ required: false, blocked: false });
    }
  });

  it("requires MFA for every enforced role", () => {
    for (const role of MFA_ENFORCED_ROLES) {
      expect(mfaComplianceFor(role, null, AFTER).required).toBe(true);
    }
  });

  it("does not block during the grace period, even without aal2", () => {
    const result = mfaComplianceFor("owner", null, BEFORE);
    expect(result).toMatchObject({
      required: true,
      enrolled: false,
      blocked: false,
    });
  });

  it("blocks after the grace period ends without aal2", () => {
    const result = mfaComplianceFor("admin", "aal1", AFTER);
    expect(result).toMatchObject({
      required: true,
      enrolled: false,
      blocked: true,
    });
  });

  it("never blocks a session already verified with aal2", () => {
    expect(mfaComplianceFor("owner", "aal2", AFTER)).toMatchObject({
      enrolled: true,
      blocked: false,
    });
    expect(mfaComplianceFor("owner", "aal2", BEFORE)).toMatchObject({
      enrolled: true,
      blocked: false,
    });
  });

  it("exposes the grace period end so the UI can show a countdown", () => {
    expect(mfaComplianceFor("owner", null, BEFORE).gracePeriodEndsAt).toEqual(
      MFA_ENFORCEMENT_DATE,
    );
  });
});
