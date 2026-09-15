import { describe, expect, it } from "vitest";

import type { UserRole } from "@cendaro/validators";
import { USER_ROLES } from "@cendaro/validators";

import { REDIRECT_ALLOWLIST_PREFIX } from "~/lib/redirect-allowlist";
import {
  getVisibleNav,
  isChildActive,
  isParentActive,
  NAV_ITEMS,
} from "./navigation";

/** Every navigable href in NAV_ITEMS (parents + children), query string stripped. */
function allNavHrefs(): string[] {
  const hrefs: string[] = [];
  for (const parent of NAV_ITEMS) {
    if (parent.href) hrefs.push(parent.href);
    for (const child of parent.children ?? []) {
      hrefs.push(child.href.split("?", 1)[0] ?? child.href);
    }
  }
  return hrefs;
}

describe("NAV_ITEMS ↔ REDIRECT_ALLOWLIST_PREFIX", () => {
  it("every nav href is covered by the redirect allowlist", () => {
    for (const href of allNavHrefs()) {
      const covered = REDIRECT_ALLOWLIST_PREFIX.some((prefix) =>
        href.startsWith(prefix),
      );
      expect(
        covered,
        `${href} is not covered by REDIRECT_ALLOWLIST_PREFIX`,
      ).toBe(true);
    }
  });
});

/**
 * Truth table: exact set of resolved child hrefs each role should see.
 * Mirrors the roles read from `role_permission` (T2.1) and the plan's
 * §5.8.3 table — any drift here means either the table or NAV_ITEMS is wrong.
 */
const EXPECTED_CHILD_HREFS: Record<UserRole, string[]> = {
  owner: [
    "/orders",
    "/quotes",
    "/delivery-notes",
    "/invoices",
    "/vendors",
    "/orders?createOrder=true",
    "/customers",
    "/customers?createCustomer=true",
    "/catalog",
    "/catalog/categories",
    "/catalog/brands",
    "/catalog/suppliers",
    "/pricing",
    "/catalog/import",
    "/catalog?createProduct=true",
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
  ],
  admin: [
    "/orders",
    "/quotes",
    "/delivery-notes",
    "/invoices",
    "/vendors",
    "/orders?createOrder=true",
    "/customers",
    "/customers?createCustomer=true",
    "/catalog",
    "/catalog/categories",
    "/catalog/brands",
    "/catalog/suppliers",
    "/pricing",
    "/catalog/import",
    "/catalog?createProduct=true",
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
  ],
  supervisor: [
    "/orders",
    "/quotes",
    "/delivery-notes",
    "/invoices",
    "/vendors",
    "/orders?createOrder=true",
    "/customers",
    "/customers?createCustomer=true",
    "/catalog",
    "/catalog/categories",
    "/catalog/brands",
    "/catalog/suppliers",
    "/pricing",
    "/catalog/import",
    "/catalog?createProduct=true",
    "/inventory",
    "/containers",
    "/payments",
    "/accounts-receivable",
    "/cash-closure",
    "/rates",
    "/marketplace",
    "/whatsapp",
    "/alerts",
  ],
  employee: [
    "/orders",
    "/quotes",
    "/orders?createOrder=true",
    "/customers",
    "/catalog",
    "/catalog/categories",
    "/catalog/brands",
    "/catalog/suppliers",
    "/payments",
    "/whatsapp",
  ],
  vendor: [
    "/orders",
    "/quotes",
    "/customers",
    "/catalog",
    "/catalog/categories",
    "/catalog/brands",
    "/catalog/suppliers",
  ],
  marketing: [
    "/orders",
    "/quotes",
    "/customers",
    "/catalog",
    "/catalog/categories",
    "/catalog/brands",
    "/catalog/suppliers",
    "/marketplace",
  ],
};

describe("getVisibleNav — per-role truth table", () => {
  for (const role of USER_ROLES) {
    it(`${role} sees exactly its expected children`, () => {
      const visible = getVisibleNav(role);
      const childHrefs = visible.flatMap(
        (parent) => parent.children?.map((c) => c.href) ?? [],
      );
      expect(childHrefs.sort()).toEqual([...EXPECTED_CHILD_HREFS[role]].sort());
    });
  }

  it("null role (profile still loading) sees only role-agnostic parents/children — matches legacy hasRole() semantics", () => {
    const visible = getVisibleNav(null);
    expect(visible.map((p) => p.id)).toEqual([
      "overview",
      "sales",
      "customers",
      "catalog",
    ]);
    const childHrefs = visible.flatMap(
      (parent) => parent.children?.map((c) => c.href) ?? [],
    );
    expect(childHrefs.sort()).toEqual(
      [
        "/orders",
        "/quotes",
        "/customers",
        "/catalog",
        "/catalog/categories",
        "/catalog/brands",
        "/catalog/suppliers",
      ].sort(),
    );
  });
});

describe("isParentActive / isChildActive", () => {
  it("matches exact and nested paths, ignoring query strings", () => {
    expect(isChildActive({ href: "/orders?createOrder=true" }, "/orders")).toBe(
      true,
    );
    expect(isChildActive({ href: "/customers" }, "/customers/123")).toBe(true);
    expect(isChildActive({ href: "/customers" }, "/customersextra")).toBe(
      false,
    );
  });

  it("parent is active when any child matches", () => {
    const salesParent = NAV_ITEMS.find((p) => p.id === "sales");
    if (!salesParent) throw new Error("expected NAV_ITEMS to contain 'sales'");
    expect(isParentActive(salesParent, "/quotes/abc")).toBe(true);
    expect(isParentActive(salesParent, "/pos")).toBe(false);
  });
});
