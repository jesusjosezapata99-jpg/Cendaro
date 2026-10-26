import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CLOUDFLARE_TEST_SECRET_FAIL,
  CLOUDFLARE_TEST_SECRET_PASS,
  verifyTurnstileToken,
} from "./turnstile";

describe("verifyTurnstileToken (F9.1)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("bypasses verification when secretKey is unset or blank", async () => {
    await expect(
      verifyTurnstileToken(undefined, "1.2.3.4", ""),
    ).resolves.toEqual({
      success: true,
      bypassed: true,
      errorCodes: [],
    });
    await expect(
      verifyTurnstileToken(null, "1.2.3.4", undefined),
    ).resolves.toEqual({
      success: true,
      bypassed: true,
      errorCodes: [],
    });
  });

  it("rejects missing or empty token when secretKey is configured", async () => {
    const res = await verifyTurnstileToken("", "1.2.3.4", "real-secret-key");
    expect(res).toEqual({
      success: false,
      errorCodes: ["missing-input-response"],
    });
  });

  it("handles official Cloudflare pass and fail test secrets deterministically", async () => {
    const passRes = await verifyTurnstileToken(
      "dummy-token",
      "1.2.3.4",
      CLOUDFLARE_TEST_SECRET_PASS,
    );
    expect(passRes.success).toBe(true);

    const failRes = await verifyTurnstileToken(
      "dummy-token",
      "1.2.3.4",
      CLOUDFLARE_TEST_SECRET_FAIL,
    );
    expect(failRes.success).toBe(false);
    expect(failRes.errorCodes).toContain("invalid-input-response");
  });

  it("calls Cloudflare siteverify endpoint and parses response when real secret is used", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          hostname: "app.cendaro.com",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const res = await verifyTurnstileToken(
      "valid-client-token",
      "203.0.113.10",
      "prod-secret-key",
    );

    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(res).toEqual({
      success: true,
      errorCodes: [],
      hostname: "app.cendaro.com",
    });
  });
});
