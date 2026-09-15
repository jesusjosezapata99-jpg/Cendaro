import { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { ListPageSkeleton } from "~/components/skeleton";
import { getQueryClient } from "~/trpc/query-client";
import { trpc } from "~/trpc/server";
import InvoicesClient from "./client";

export const instant = false;

/**
 * Invoices — Server Component with SSR Prefetch
 * PRD §16: Facturas internas
 */
export default function InvoicesPage() {
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <InvoicesPrefetch />
    </Suspense>
  );
}

async function InvoicesPrefetch() {
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
      <InvoicesClient />
    </HydrationBoundary>
  );
}
