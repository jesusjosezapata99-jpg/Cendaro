import { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { getQueryClient } from "~/trpc/query-client";
import { api } from "~/trpc/server";
import AppLoading from "../loading";
import CustomersClient from "./client";

/**
 * Opt out of Next's dev-only instant-navigation validation: this segment's
 * prefetch is auth-gated (Supabase session + DB), so the synthetic validation
 * pass can never render it and reports E1286 (instant-unrendered-segment).
 * The Suspense fallback below already provides the instant shell.
 */
export const instant = false;

/**
 * Customers — Server Component with SSR Prefetch
 *
 * Prefetch lives below a Suspense boundary (required by `cacheComponents`
 * so the segment shell renders instantly — instant-unrendered-segment).
 */
export default function CustomersPage() {
  return (
    <Suspense fallback={<AppLoading />}>
      <CustomersPrefetch />
    </Suspense>
  );
}

async function CustomersPrefetch() {
  const queryClient = getQueryClient();

  try {
    await queryClient.prefetchQuery({
      queryKey: [
        ["sales", "listCustomers"],
        { input: { limit: 50 }, type: "query" },
      ],
      queryFn: () => api.sales.listCustomers({ limit: 50 }),
    });
  } catch {
    // Prefetch failure is non-critical — client will fetch on hydration
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CustomersClient />
    </HydrationBoundary>
  );
}
