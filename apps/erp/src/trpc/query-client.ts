/**
 * Cendaro — Shared Query Client Factory
 *
 * Creates a QueryClient instance that can be used on both
 * server (for prefetching) and client (singleton).
 * Keeps cache configuration in one place for consistency.
 */
import { QueryClient } from "@tanstack/react-query";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // SSR: prevent client from immediately refetching server-prefetched data
        staleTime: 5 * 60 * 1000,  // 5 min — ERP data rarely changes every second
        gcTime: 10 * 60 * 1000,    // 10 min — keep inactive cache longer
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

/**
 * Get or create a QueryClient.
 * - Server: always creates a new instance (per-request isolation)
 * - Client: reuses a singleton across renders
 */
export function getQueryClient() {
  if (typeof window === "undefined") {
    // Server: new client per request to prevent data leakage between users
    return makeQueryClient();
  }
  // Client: singleton across all renders
  return (browserQueryClient ??= makeQueryClient());
}
