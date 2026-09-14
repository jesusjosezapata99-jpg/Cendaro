import { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { ListPageSkeleton } from "~/components/skeleton";
import { getQueryClient } from "~/trpc/query-client";
import { trpc } from "~/trpc/server";
import DeliveryNotesClient from "./client";

export const instant = false;

/**
 * Delivery Notes — Server Component with SSR Prefetch
 * PRD §16: Notas de entrega para despacho
 */
export default function DeliveryNotesPage() {
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <DeliveryNotesPrefetch />
    </Suspense>
  );
}

async function DeliveryNotesPrefetch() {
  const queryClient = getQueryClient();

  try {
    await Promise.all([
      queryClient.prefetchQuery(
        trpc.sales.listOrders.queryOptions({ limit: 100 }),
      ),
      queryClient.prefetchQuery(
        trpc.sales.listCustomers.queryOptions({ limit: 100 }),
      ),
    ]);
  } catch {
    // Prefetch failure is non-critical — client will fetch on hydration
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DeliveryNotesClient />
    </HydrationBoundary>
  );
}
