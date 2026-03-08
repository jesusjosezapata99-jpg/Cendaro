/**
 * Cendaro — tRPC Shared Config
 *
 * Shared transformer and link configuration used by both
 * the server-side caller and the React client.
 */
import superjson from "superjson";

export const transformer = superjson;

export function getBaseUrl() {
  if (typeof window !== "undefined") return window.location.origin;
  // eslint-disable-next-line no-restricted-properties
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  // eslint-disable-next-line no-restricted-properties
  return `http://localhost:${String(process.env.PORT ?? 3000)}`;
}

export function getUrl() {
  return `${getBaseUrl()}/api/trpc`;
}
