import { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { getQueryClient } from "~/trpc/query-client";
import { trpc } from "~/trpc/server";
import AppLoading from "../loading";
import QuotesClient from "./client";

/**
 * Opt out of Next's dev-only instant-navigation validation: this segment's
 * prefetch is auth-gated (Supabase session + DB), so the synthetic validation
 * pass can never render it and reports E1286 (instant-unrendered-segment).
 * The Suspense fallback below already provides the instant shell.
 */
export const instant = false;

/**
 * Quotes — Server Component with SSR Prefetch
 * PRD §15: Cotizaciones pre-order obligatorias para wholesale
 *
 * Prefetch lives below a Suspense boundary (required by `cacheComponents`
 * so the segment shell renders instantly — instant-unrendered-segment).
 */
export default function QuotesPage() {
  return (
    <Suspense fallback={<AppLoading />}>
      <QuotesPrefetch />
    </Suspense>
  );
}

async function QuotesPrefetch() {
  const queryClient = getQueryClient();

  try {
    await queryClient.prefetchQuery(
      trpc.quotes.list.queryOptions({ limit: 50 }),
    );
  } catch {
    // Prefetch failure is non-critical
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <QuotesClient />
    </HydrationBoundary>
  );
}
