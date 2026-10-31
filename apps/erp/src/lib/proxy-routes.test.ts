import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { MARKETING_ROUTES } from "~/app/_components/landing/routes";
import { PUBLIC_ROUTES_EXACT, PUBLIC_ROUTES_PREFIX } from "~/lib/public-routes";
import { REDIRECT_ALLOWLIST_PREFIX } from "~/lib/redirect-allowlist";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const APP_ROUTE_GROUP_DIR = resolve(HERE, "../app/(app)");

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
    expect(PUBLIC_ROUTES_EXACT).toEqual([
      "/",
      "/opengraph-image",
      "/funciones",
      "/sitemap.xml",
      "/feed.xml",
      "/robots.txt",
      "/llms.txt",
      "/llms-full.txt",
    ]);
  });

  it("ensures PUBLIC_ROUTES_PREFIX contains only login, auth endpoints, the Sentry tunnel and feature pages", () => {
    expect(PUBLIC_ROUTES_PREFIX).toEqual([
      "/login",
      "/api/auth",
      "/monitoring",
      "/funciones/",
    ]);
  });

  it("makes the marketing feature pages public, and nothing that only looks like them", () => {
    const isPublic = (path: string): boolean =>
      PUBLIC_ROUTES_EXACT.includes(path) ||
      PUBLIC_ROUTES_PREFIX.some((prefix) => path.startsWith(prefix));

    for (const path of [
      "/funciones",
      "/funciones/inventario",
      "/funciones/importaciones",
      "/funciones/finanzas",
      "/funciones/ventas-y-pos",
      "/funciones/canales",
      "/funciones/seguridad-y-control",
      "/funciones/inventario/opengraph-image",
      "/llms.txt",
      "/llms-full.txt",
    ]) {
      expect(isPublic(path)).toBe(true);
    }
    for (const path of ["/funcionesx", "/funciones-admin", "/dashboard"]) {
      expect(isPublic(path)).toBe(false);
    }
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

  it("future-proof guard: every route in MARKETING_ROUTES is allowed by PUBLIC_ROUTES_EXACT or PUBLIC_ROUTES_PREFIX", () => {
    for (const route of MARKETING_ROUTES) {
      const isAllowed =
        PUBLIC_ROUTES_EXACT.includes(route.path) ||
        PUBLIC_ROUTES_PREFIX.some((prefix) => route.path.startsWith(prefix));
      expect(
        isAllowed,
        `Marketing route "${route.path}" in routes.ts must be added to PUBLIC_ROUTES_EXACT or PUBLIC_ROUTES_PREFIX in public-routes.ts`,
      ).toBe(true);
    }
  });

  it("future-proof guard: every route folder in src/app/(app) is in REDIRECT_ALLOWLIST_PREFIX", () => {
    const appDirs = readdirSync(APP_ROUTE_GROUP_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => `/${entry.name}`);

    for (const dirPath of appDirs) {
      expect(
        REDIRECT_ALLOWLIST_PREFIX,
        `Protected app directory "${dirPath}" in src/app/(app) must be listed in REDIRECT_ALLOWLIST_PREFIX (src/lib/redirect-allowlist.ts)`,
      ).toContain(dirPath);
    }
  });
});
