import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { getQueryClient } from "~/trpc/query-client";
import { api } from "~/trpc/server";
import QuotesClient from "./client";

/**
 * Quotes — Server Component with SSR Prefetch
 * PRD §15: Cotizaciones pre-order obligatorias para wholesale
 */
export default async function QuotesPage() {
  const queryClient = getQueryClient();

  try {
    await queryClient.prefetchQuery({
      queryKey: [["quotes", "list"], { input: { limit: 50 }, type: "query" }],
      queryFn: () => api.quotes.list({ limit: 50 }),
    });
  } catch {
    // Prefetch failure is non-critical
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <QuotesClient />
    </HydrationBoundary>
  );
}
