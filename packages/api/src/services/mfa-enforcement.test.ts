/**
 * MFA enforcement for privileged roles (PLAN-2026-09-SECURITY-REMEDIATION
 * F7.2, finding M8).
 *
 * owner/admin sessions must carry `aal2` (a verified TOTP factor) once the
 * grace period ends; `mfaComplianceFor` is the one place that decides this,
 * shared by the server-side gate (trpc.ts) and the `users.mfaStatus` display
 * the UI reads to show the banner — so the two can never disagree. The
 * cutover comes from the `MFA_ENFORCEMENT_DATE` env var; unset = not
 * scheduled, so nothing is blocked.
 */
import { describe, expect, it } from "vitest";

import {
  MFA_ENFORCED_ROLES,
  mfaComplianceFor,
  parseMfaEnforcementDate,
} from "./mfa-enforcement";

const CUTOVER = new Date("2026-10-01T00:00:00Z");
const BEFORE = new Date(CUTOVER.getTime() - 1);
const AFTER = new Date(CUTOVER.getTime() + 1);

describe("mfaComplianceFor", () => {
  it("does not require MFA for roles outside owner/admin", () => {
    for (const role of ["employee", "supervisor", "marketing"] as const) {
      const result = mfaComplianceFor(role, null, AFTER, CUTOVER);
      expect(result).toMatchObject({ required: false, blocked: false });
    }
  });

  it("requires MFA for every enforced role", () => {
    for (const role of MFA_ENFORCED_ROLES) {
      expect(mfaComplianceFor(role, null, AFTER, CUTOVER).required).toBe(true);
    }
  });

  it("does not block during the grace period, even without aal2", () => {
    const result = mfaComplianceFor("owner", null, BEFORE, CUTOVER);
    expect(result).toMatchObject({
      required: true,
      enrolled: false,
      blocked: false,
    });
  });

  it("blocks after the grace period ends without aal2", () => {
    const result = mfaComplianceFor("admin", "aal1", AFTER, CUTOVER);
    expect(result).toMatchObject({
      required: true,
      enrolled: false,
      blocked: true,
    });
  });

  it("never blocks a session already verified with aal2", () => {
    expect(mfaComplianceFor("owner", "aal2", AFTER, CUTOVER)).toMatchObject({
      enrolled: true,
      blocked: false,
    });
    expect(mfaComplianceFor("owner", "aal2", BEFORE, CUTOVER)).toMatchObject({
      enrolled: true,
      blocked: false,
    });
  });

  it("exposes the grace period end so the UI can show a countdown", () => {
    expect(
      mfaComplianceFor("owner", null, BEFORE, CUTOVER).gracePeriodEndsAt,
    ).toEqual(CUTOVER);
  });

  it("never blocks while enforcement is not scheduled", () => {
    const farFuture = new Date("2099-01-01T00:00:00Z");
    expect(mfaComplianceFor("owner", null, farFuture, null)).toMatchObject({
      required: true,
      enrolled: false,
      blocked: false,
      gracePeriodEndsAt: null,
    });
  });
});

describe("parseMfaEnforcementDate", () => {
  it("returns null when the variable is unset or blank", () => {
    expect(parseMfaEnforcementDate(undefined)).toBeNull();
    expect(parseMfaEnforcementDate("")).toBeNull();
    expect(parseMfaEnforcementDate("   ")).toBeNull();
  });

  it("parses YYYY-MM-DD as midnight UTC", () => {
    expect(parseMfaEnforcementDate("2026-10-01")).toEqual(CUTOVER);
    expect(parseMfaEnforcementDate(" 2026-10-01 ")).toEqual(CUTOVER);
  });

  it("throws on a malformed or impossible date instead of guessing", () => {
    for (const bad of [
      "2026-02-30",
      "2026-13-01",
      "01/10/2026",
      "2026-10-01T00:00:00Z",
      "tomorrow",
    ]) {
      expect(() => parseMfaEnforcementDate(bad)).toThrow(
        /MFA_ENFORCEMENT_DATE/,
      );
    }
  });
});
