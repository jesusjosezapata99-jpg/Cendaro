import { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { ListPageSkeleton } from "~/components/skeleton";
import { getQueryClient } from "~/trpc/query-client";
import { trpc } from "~/trpc/server";
import SecurityClient from "./client";

/**
 * Opt out of Next's dev-only instant-navigation validation: this segment's
 * prefetch is auth-gated (Supabase session + DB), so the synthetic validation
 * pass can never render it and reports E1286 (instant-unrendered-segment).
 */
export const instant = false;

export default function SecuritySettingsPage() {
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <SecurityPrefetch />
    </Suspense>
  );
}

async function SecurityPrefetch() {
  const queryClient = getQueryClient();

  try {
    await queryClient.prefetchQuery(trpc.users.mfaStatus.queryOptions());
  } catch {
    // Prefetch failure is non-critical — client will fetch on hydration
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <SecurityClient />
    </HydrationBoundary>
  );
}
