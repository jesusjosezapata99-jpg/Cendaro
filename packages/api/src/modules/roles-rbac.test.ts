import { describe, expect, it } from "vitest";

import { NAV_ROLE_RULES, USER_ROLES } from "@cendaro/validators";

describe("RBAC Role Security and Invariants (C4)", () => {
  it("defines all 6 canonical user roles without unexpected additions", () => {
    expect(USER_ROLES).toEqual([
      "owner",
      "admin",
      "supervisor",
      "employee",
      "vendor",
      "marketing",
    ]);
  });

  it("strictly restricts settings, users, and audit to owner and admin only", () => {
    expect(NAV_ROLE_RULES.settings).toEqual(["owner", "admin"]);
    expect(NAV_ROLE_RULES.users).toEqual(["owner", "admin"]);
    expect(NAV_ROLE_RULES.audit).toEqual(["owner", "admin"]);
  });

  it("prohibits vendor and marketing from accessing point of sale or finance closures", () => {
    expect(NAV_ROLE_RULES.pos).not.toContain("vendor");
    expect(NAV_ROLE_RULES.pos).not.toContain("marketing");

    expect(NAV_ROLE_RULES.cashClosure).not.toContain("vendor");
    expect(NAV_ROLE_RULES.cashClosure).not.toContain("marketing");
    expect(NAV_ROLE_RULES.cashClosure).not.toContain("employee");
  });

  it("prohibits employee, vendor and marketing from managing rates or inventory", () => {
    expect(NAV_ROLE_RULES.rates).toEqual(["owner", "admin", "supervisor"]);
    expect(NAV_ROLE_RULES.inventory).toEqual(["owner", "admin", "supervisor"]);
    expect(NAV_ROLE_RULES.containers).toEqual(["owner", "admin", "supervisor"]);
    expect(NAV_ROLE_RULES.pricing).toEqual(["owner", "admin", "supervisor"]);
  });

  it("allows marketing access exclusively to marketplace and public/catalog modules", () => {
    expect(NAV_ROLE_RULES.marketplace).toContain("marketing");
    expect(NAV_ROLE_RULES.settings).not.toContain("marketing");
    expect(NAV_ROLE_RULES.payments).not.toContain("marketing");
    expect(NAV_ROLE_RULES.users).not.toContain("marketing");
  });
});
