/**
 * The extra trust anchor for bcv.org.ve (bcv-ca.ts) must be exactly the
 * public Sectigo intermediate, still valid, and chain to a root Node already
 * trusts — so adding it never widens trust beyond Node's own store.
 */
import { X509Certificate } from "node:crypto";
import { rootCertificates } from "node:tls";
import { describe, expect, it } from "vitest";

import { BCV_TRUSTED_CA, SECTIGO_DV_R36_PEM } from "./bcv-ca";

const EXPECTED_SHA256 =
  "8C:54:C3:34:B6:6B:A4:E4:26:77:2A:F4:A3:F9:13:6C:19:A1:AE:C7:29:FD:B2:8C:53:5C:07:A5:A4:EF:22:E0";

describe("BCV trust anchors", () => {
  const intermediate = new X509Certificate(SECTIGO_DV_R36_PEM);

  it("pins the Sectigo DV R36 intermediate by fingerprint", () => {
    expect(intermediate.fingerprint256).toBe(EXPECTED_SHA256);
    expect(intermediate.subject).toContain(
      "CN=Sectigo Public Server Authentication CA DV R36",
    );
    expect(intermediate.ca).toBe(true);
  });

  it("is still within its validity window", () => {
    const now = Date.now();
    expect(new Date(intermediate.validFrom).getTime()).toBeLessThan(now);
    expect(new Date(intermediate.validTo).getTime()).toBeGreaterThan(now);
  });

  it("is signed by a root that Node already trusts", () => {
    const issuer = rootCertificates
      .map((pem) => new X509Certificate(pem))
      .find((root) => intermediate.checkIssued(root));
    expect(issuer?.subject).toContain(
      "CN=Sectigo Public Server Authentication Root R46",
    );
    expect(issuer && intermediate.verify(issuer.publicKey)).toBe(true);
  });

  it("keeps every default root (passing `ca` replaces Node's defaults)", () => {
    expect(BCV_TRUSTED_CA).toHaveLength(rootCertificates.length + 1);
    expect(BCV_TRUSTED_CA).toEqual(
      expect.arrayContaining([...rootCertificates]),
    );
  });
});
