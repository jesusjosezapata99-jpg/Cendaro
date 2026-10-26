import { describe, expect, it } from "vitest";

import {
  REDIRECT_ALLOWLIST_PREFIX,
  sanitizeRedirectPath,
} from "./redirect-allowlist";

describe("sanitizeRedirectPath (F9.2 open-redirect guard)", () => {
  it("allows every allowlisted prefix and nested subpaths with query params", () => {
    for (const prefix of REDIRECT_ALLOWLIST_PREFIX) {
      expect(sanitizeRedirectPath(prefix)).toBe(prefix);
      expect(sanitizeRedirectPath(`${prefix}/123?tab=details`)).toBe(
        `${prefix}/123?tab=details`,
      );
    }
  });

  it("blocks external URLs, protocol-relative URLs, backslash tricks, and unlisted paths", () => {
    const maliciousInputs = [
      null,
      undefined,
      "",
      "   ",
      "https://evil.com",
      "http://evil.com/dashboard",
      "//evil.com",
      "//evil.com/dashboard",
      "/\\evil.com",
      "javascript:alert(1)",
      "/dashboard\\..\\evil",
      "/login",
      "/api/trpc",
      "/dashboard-evil",
    ];

    for (const input of maliciousInputs) {
      expect(sanitizeRedirectPath(input)).toBe("/dashboard");
    }
  });
});
