/**
 * Client address for rate limiting. Vercel sets x-forwarded-for with the client
 * first; a missing or empty header counts as one shared "unknown" client.
 */
export function getClientIp(headers: Headers): string {
  const first = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return first !== undefined && first !== "" ? first : "unknown";
}
