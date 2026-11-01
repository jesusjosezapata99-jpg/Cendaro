import { describe, expect, it, vi } from "vitest";

import { buildContentSecurityPolicy } from "../../csp.mjs";

/**
 * internal plan F9.1 (hardening item) — regression guard.
 *
 * A nonce/`strict-dynamic` policy was tried first and rejected: with Partial
 * Prerendering the static shell has no nonce, so every script on `/` and
 * `/login` was blocked. The policy below is the compatible one; these tests
 * stop it from drifting back to either extreme.
 */
function directive(csp: string, name: string): string {
  return (
    csp
      .split("; ")
      .find((part) => part.startsWith(`${name} `))
      ?.slice(name.length + 1) ?? ""
  );
}

const SUPABASE_URL = "https://project.supabase.co";

describe("Content-Security-Policy (F9.1, M3)", () => {
  it("production script-src forbids eval", () => {
    const scriptSrc = directive(
      buildContentSecurityPolicy(false, SUPABASE_URL),
      "script-src",
    );

    expect(scriptSrc).not.toContain("'unsafe-eval'");
  });

  it("does not use nonce/strict-dynamic, which would block PPR static shells", () => {
    const scriptSrc = directive(
      buildContentSecurityPolicy(false, SUPABASE_URL),
      "script-src",
    );

    expect(scriptSrc).toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'strict-dynamic'");
    expect(scriptSrc).not.toContain("'nonce-");
  });

  it("allows eval and websockets only in development", () => {
    const dev = buildContentSecurityPolicy(true, SUPABASE_URL);
    const prod = buildContentSecurityPolicy(false, SUPABASE_URL);

    expect(directive(dev, "script-src")).toContain("'unsafe-eval'");
    expect(directive(dev, "connect-src")).toContain("ws:");
    expect(directive(prod, "connect-src")).not.toContain("ws:");
  });

  it("keeps the non-script directives strict", () => {
    const prod = buildContentSecurityPolicy(false, SUPABASE_URL);

    expect(directive(prod, "default-src")).toBe("'self'");
    expect(directive(prod, "object-src")).toBe("'none'");
    expect(directive(prod, "frame-ancestors")).toBe("'none'");
    expect(directive(prod, "frame-src")).toContain(
      "https://challenges.cloudflare.com",
    );
    expect(directive(prod, "script-src")).toContain(
      "https://challenges.cloudflare.com",
    );
    expect(directive(prod, "base-uri")).toBe("'self'");
    expect(directive(prod, "form-action")).toBe("'self'");
    expect(directive(prod, "connect-src")).not.toContain(
      "https://*.supabase.co",
    );
    expect(directive(prod, "img-src")).not.toContain("https://*.supabase.co");
    expect(prod).toContain("upgrade-insecure-requests");
  });

  it("takes the Supabase origin from configuration and refuses to guess it", () => {
    expect(buildContentSecurityPolicy(false, SUPABASE_URL)).toContain(
      "connect-src 'self' https://project.supabase.co",
    );
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    expect(() => buildContentSecurityPolicy(false)).toThrow();
    vi.unstubAllEnvs();
  });
});
