/**
 * Same-origin guard for cookie-authenticated state-changing route handlers
 * (CSRF defense in depth on top of SameSite=Lax session cookies).
 *
 * Accepts the request when its `Origin` (or, failing that, `Referer`) host
 * equals the host the request was served on. Local development hosts are
 * always accepted.
 */
const LOCAL_HOST_PREFIXES = ["localhost", "127.0.0.1", "0.0.0.0"] as const;

function hostOf(value: string): string | null {
  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}

export function isTrustedOrigin(
  requestHeaders: Headers,
  requestUrl: string,
): boolean {
  const appHost = hostOf(requestUrl);
  if (!appHost) return false;

  if (LOCAL_HOST_PREFIXES.some((prefix) => appHost.startsWith(prefix))) {
    return true;
  }

  const origin = requestHeaders.get("origin");
  if (origin) return hostOf(origin) === appHost;

  const referer = requestHeaders.get("referer");
  if (referer) return hostOf(referer) === appHost;

  return false;
}
