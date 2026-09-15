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
import { cache } from "react";
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

export const STALE_TIMES = {
  /** 30s — Transactional lists (orders, quotes, payments, inventory, audit) */
  LISTS: 30 * 1000,
  /** 60s — Live exchange rates & financial rates */
  RATES: 60 * 1000,
  /** 5 min — Static catalogs (brands, categories, suppliers, workspaces, users.me) */
  CATALOGS: 5 * 60 * 1000,
} as const;

export function makeQueryClient() {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: STALE_TIMES.LISTS, // default: 30s for transactional lists
        gcTime: 10 * 60 * 1000, // 10 min — keep inactive cache longer
        refetchOnWindowFocus: false, // prevent noisy refetches
        refetchOnReconnect: true, // refetch when connection restores
        retry: shouldRetry,
      },
      mutations: {
        retry: false,
      },
    },
  });

  // T8.2: Differentiated cache policies
  // Catalogs (5 min): Brands, Categories, Suppliers, Workspaces, Users
  client.setQueryDefaults([["catalog", "listBrands"]], {
    staleTime: STALE_TIMES.CATALOGS,
  });
  client.setQueryDefaults([["catalog", "listCategories"]], {
    staleTime: STALE_TIMES.CATALOGS,
  });
  client.setQueryDefaults([["catalog", "listSuppliers"]], {
    staleTime: STALE_TIMES.CATALOGS,
  });
  client.setQueryDefaults([["workspace", "list"]], {
    staleTime: STALE_TIMES.CATALOGS,
  });
  client.setQueryDefaults([["workspace", "current"]], {
    staleTime: STALE_TIMES.CATALOGS,
  });
  client.setQueryDefaults([["users", "me"]], {
    staleTime: STALE_TIMES.CATALOGS,
  });

  // Rates (60s): Central Bank of Venezuela & Parallel rates
  client.setQueryDefaults([["pricing", "latestRates"]], {
    staleTime: STALE_TIMES.RATES,
  });
  client.setQueryDefaults([["pricing", "listRateHistory"]], {
    staleTime: STALE_TIMES.RATES,
  });

  return client;
}

let browserQueryClient: QueryClient | undefined;

/**
 * Get or create a QueryClient.
 * - Server: always creates a new instance (per-request isolation)
 * - Client: reuses a singleton across renders
 */
/**
 * Request-stable server QueryClient (official tRPC options-proxy pattern):
 * React `cache()` returns the SAME instance for every call within a single
 * server render, so the options proxy, prefetch and dehydrate all share one
 * client. Without this, each call would create a new instance and the
 * prefetched data would never reach the HydrationBoundary.
 */
const requestQueryClient = cache(() => makeQueryClient());

export function getQueryClient() {
  if (typeof window === "undefined") {
    // Server: one client per request (prevents data leakage between users)
    return requestQueryClient();
  }
  // Client: singleton across all renders
  return (browserQueryClient ??= makeQueryClient());
}
