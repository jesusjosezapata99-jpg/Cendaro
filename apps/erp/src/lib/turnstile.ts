/**
 * Cloudflare Turnstile server-side token verifier (F9.1).
 *
 * Validates CAPTCHA tokens issued by the Turnstile widget against
 * `https://challenges.cloudflare.com/turnstile/v0/siteverify`.
 *
 * Behavior:
 *  - When `secretKey` is unset/empty (local dev / CI without Turnstile keys),
 *    verification passes with `{ success: true, bypassed: true }`.
 *  - When `secretKey` is configured, a non-empty `token` is mandatory and
 *    verified against Cloudflare's `siteverify` endpoint (with a 5s timeout).
 *  - Official Cloudflare test secret (`1x0000000000000000000000000000000AA`)
 *    and test fail secret (`2x0000000000000000000000000000000AA`) are handled
 *    deterministically in test environments without network dependency.
 */

export const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export const CLOUDFLARE_TEST_SECRET_PASS =
  "1x0000000000000000000000000000000AA";
export const CLOUDFLARE_TEST_SECRET_FAIL =
  "2x0000000000000000000000000000000AA";

export interface TurnstileVerifyResult {
  success: boolean;
  bypassed?: boolean;
  errorCodes: string[];
  hostname?: string;
}

interface SiteverifyPayload {
  success?: boolean;
  "error-codes"?: string[];
  hostname?: string;
}

export async function verifyTurnstileToken(
  token: string | null | undefined,
  remoteIp?: string | null,
  secretKey?: string | null,
): Promise<TurnstileVerifyResult> {
  const cleanSecret = secretKey?.trim();
  if (!cleanSecret) {
    return {
      success: true,
      bypassed: true,
      errorCodes: [],
    };
  }

  const cleanToken = token?.trim();
  if (!cleanToken) {
    return {
      success: false,
      errorCodes: ["missing-input-response"],
    };
  }

  if (cleanToken.length > 2048) {
    return {
      success: false,
      errorCodes: ["invalid-input-response"],
    };
  }

  // Deterministic handling for official Cloudflare dummy test keys
  if (cleanSecret === CLOUDFLARE_TEST_SECRET_PASS) {
    return {
      success: true,
      errorCodes: [],
      hostname: "localhost",
    };
  }
  if (cleanSecret === CLOUDFLARE_TEST_SECRET_FAIL) {
    return {
      success: false,
      errorCodes: ["invalid-input-response"],
    };
  }

  try {
    const form = new URLSearchParams();
    form.set("secret", cleanSecret);
    form.set("response", cleanToken);
    if (remoteIp && remoteIp !== "unknown") {
      form.set("remoteip", remoteIp);
    }

    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
      signal: AbortSignal.timeout(5_000),
    });

    if (!res.ok) {
      return {
        success: false,
        errorCodes: [`http-${res.status}`],
      };
    }

    const payload = (await res.json()) as SiteverifyPayload;
    return {
      success: payload.success === true,
      errorCodes: payload["error-codes"] ?? [],
      hostname: payload.hostname,
    };
  } catch {
    return {
      success: false,
      errorCodes: ["network-or-timeout-error"],
    };
  }
}
