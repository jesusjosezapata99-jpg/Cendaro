import { Suspense } from "react";
import { connection } from "next/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { DashboardSkeleton } from "~/components/skeleton";
import { getQueryClient } from "~/trpc/query-client";
import { trpc } from "~/trpc/server";
import DashboardClient from "./client";

/**
 * Opt out of Next's dev-only instant-navigation validation: this segment's
 * prefetch is auth-gated (Supabase session + DB), so the synthetic validation
 * pass can never render it and reports E1286 (instant-unrendered-segment).
 * The Suspense fallback below already provides the instant shell.
 */
export const instant = false;

/**
 * Dashboard — Server Component with SSR Prefetch (PLAN-2026-09-DESIGN-
 * SYSTEM §T3.3). Prefetches the default period ("30d", matching
 * `useDashboardParams`'s own default) — same pattern `orders/page.tsx` uses
 * for its own nuqs-backed filters: warm the common cold-start case, let the
 * client refetch under a different query key if the URL already specifies
 * something else.
 */
export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardPrefetch />
    </Suspense>
  );
}

async function DashboardPrefetch() {
  await connection();
  const queryClient = getQueryClient();

  try {
    await Promise.all([
      queryClient.prefetchQuery(
        trpc.dashboard.overview.queryOptions({ period: "30d" }),
      ),
      queryClient.prefetchQuery(trpc.users.uiPreferences.queryOptions()),
    ]);
  } catch {
    // Prefetch failure is non-critical — client will fetch on hydration
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DashboardClient />
    </HydrationBoundary>
  );
}
