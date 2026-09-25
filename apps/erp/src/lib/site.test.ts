import { describe, expect, it } from "vitest";

import {
  accessRequestMessage,
  buildAccessRequestLinks,
  DEFAULT_SITE_URL,
  isIndexableDeployment,
  resolveSiteUrl,
} from "~/lib/site";

describe("resolveSiteUrl", () => {
  it("falls back to the Vercel production URL when unset", () => {
    expect(resolveSiteUrl(undefined).href).toBe(`${DEFAULT_SITE_URL}/`);
    expect(resolveSiteUrl("   ").href).toBe(`${DEFAULT_SITE_URL}/`);
  });

  it("keeps only the origin of a configured URL", () => {
    expect(resolveSiteUrl("https://cendaro.io/path?x=1").href).toBe(
      "https://cendaro.io/",
    );
  });

  it("rejects invalid values and non-http protocols", () => {
    expect(resolveSiteUrl("not a url").origin).toBe(DEFAULT_SITE_URL);
    expect(resolveSiteUrl("javascript:alert(1)").origin).toBe(DEFAULT_SITE_URL);
  });
});

describe("buildAccessRequestLinks", () => {
  it("builds a wa.me link with the encoded prefilled message", () => {
    const { whatsapp } = buildAccessRequestLinks({
      whatsappNumber: "584141234567",
      email: undefined,
      context: "Importaciones",
    });
    expect(whatsapp).toBe(
      `https://wa.me/584141234567?text=${encodeURIComponent(
        "Hola, quiero solicitar acceso a Cendaro (desde: Importaciones).",
      )}`,
    );
  });

  it("returns null for a number with symbols or the wrong length", () => {
    for (const bad of [
      "+584141234567",
      "0414-123",
      "1234567",
      "1".repeat(16),
    ]) {
      expect(
        buildAccessRequestLinks({ whatsappNumber: bad, email: undefined })
          .whatsapp,
      ).toBeNull();
    }
  });

  it("builds a mailto link with subject and body", () => {
    const { email } = buildAccessRequestLinks({
      whatsappNumber: undefined,
      email: "hola@cendaro.io",
    });
    expect(email).toBe(
      `mailto:hola@cendaro.io?subject=${encodeURIComponent(
        "Solicitud de acceso a Cendaro",
      )}&body=${encodeURIComponent("Hola, quiero solicitar acceso a Cendaro.")}`,
    );
  });

  it("returns nulls when nothing is configured, so the CTA can degrade", () => {
    expect(
      buildAccessRequestLinks({ whatsappNumber: "", email: "not-an-email" }),
    ).toEqual({ whatsapp: null, email: null });
  });

  it("trims the context in the prefilled message", () => {
    expect(accessRequestMessage(" Tasas y cobranzas ")).toBe(
      "Hola, quiero solicitar acceso a Cendaro (desde: Tasas y cobranzas).",
    );
  });
});

describe("isIndexableDeployment", () => {
  it("indexes only the production deployment", () => {
    expect(isIndexableDeployment("production")).toBe(true);
    expect(isIndexableDeployment("preview")).toBe(false);
    expect(isIndexableDeployment("development")).toBe(false);
    expect(isIndexableDeployment(undefined)).toBe(false);
  });
});
