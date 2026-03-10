/**
 * Cendaro — Shared Query Client Factory
 *
 * Creates a QueryClient instance that can be used on both
 * server (for prefetching) and client (singleton).
 * Keeps cache configuration in one place for consistency.
 *
 * This is the SINGLE SOURCE OF TRUTH for QueryClient configuration.
 * All consumers (client.tsx, server.tsx, etc.) should import from here.
 */
import { QueryClient } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";

/**
 * Determines whether a failed query should be retried.
 * Auth errors (UNAUTHORIZED/FORBIDDEN) should never retry — the user needs to re-login.
 */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof TRPCClientError) {
    const data = error.data as { code?: string } | undefined;
    const code = data?.code;
    if (code === "UNAUTHORIZED" || code === "FORBIDDEN") return false;
  }
  return failureCount < 2;
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,        // 5 min — ERP data rarely changes every second
        gcTime: 10 * 60 * 1000,           // 10 min — keep inactive cache longer
        refetchOnWindowFocus: false,       // prevent noisy refetches
        refetchOnReconnect: true,          // refetch when connection restores
        retry: shouldRetry,
      },
      mutations: {
        retry: false,
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
