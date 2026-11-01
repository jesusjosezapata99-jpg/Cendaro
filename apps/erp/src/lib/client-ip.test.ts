import { describe, expect, it } from "vitest";

import { getClientIp } from "./client-ip";

const headersWith = (forwardedFor?: string): Headers =>
  new Headers(
    forwardedFor === undefined ? {} : { "x-forwarded-for": forwardedFor },
  );

describe("getClientIp", () => {
  it("takes the first address of the chain", () => {
    expect(getClientIp(headersWith("203.0.113.7, 10.0.0.1"))).toBe(
      "203.0.113.7",
    );
  });

  it("treats a missing or empty header as unknown", () => {
    expect(getClientIp(headersWith())).toBe("unknown");
    expect(getClientIp(headersWith(""))).toBe("unknown");
    expect(getClientIp(headersWith("  , 10.0.0.1"))).toBe("unknown");
  });
});
