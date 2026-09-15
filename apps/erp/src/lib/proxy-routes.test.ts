import { describe, expect, it } from "vitest";

import { PUBLIC_ROUTES_EXACT, PUBLIC_ROUTES_PREFIX } from "~/lib/public-routes";

describe("Proxy Route Allowlist Security Invariants (C4)", () => {
  const PROTECTED_ROUTES = [
    "/dashboard",
    "/pos",
    "/orders",
    "/quotes",
    "/delivery-notes",
    "/invoices",
    "/vendors",
    "/customers",
    "/catalog",
    "/catalog/categories",
    "/catalog/brands",
    "/catalog/suppliers",
    "/pricing",
    "/catalog/import",
    "/inventory",
    "/containers",
    "/payments",
    "/accounts-receivable",
    "/cash-closure",
    "/rates",
    "/marketplace",
    "/whatsapp",
    "/settings",
    "/users",
    "/audit",
    "/alerts",
  ];

  it("ensures PUBLIC_ROUTES_EXACT contains only intended static public routes", () => {
    expect(PUBLIC_ROUTES_EXACT).toEqual(["/", "/opengraph-image"]);
  });

  it("ensures PUBLIC_ROUTES_PREFIX contains only login and auth endpoints", () => {
    expect(PUBLIC_ROUTES_PREFIX).toEqual(["/login", "/api/auth"]);
  });

  it("regression guard: ensures /en is strictly NOT in any public allowlist", () => {
    expect(PUBLIC_ROUTES_EXACT).not.toContain("/en");
    expect(PUBLIC_ROUTES_EXACT).not.toContain("/en/");
    expect(PUBLIC_ROUTES_PREFIX).not.toContain("/en");
    expect(PUBLIC_ROUTES_PREFIX).not.toContain("/en/");
  });

  it("ensures none of the 26 protected routes match public route allowlists", () => {
    for (const route of PROTECTED_ROUTES) {
      const isExactMatch = PUBLIC_ROUTES_EXACT.includes(route);
      const isPrefixMatch = PUBLIC_ROUTES_PREFIX.some((prefix) =>
        route.startsWith(prefix),
      );

      expect(isExactMatch).toBe(false);
      expect(isPrefixMatch).toBe(false);
    }
  });
});
