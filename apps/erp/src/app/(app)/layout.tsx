import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { dehydrate } from "@tanstack/react-query";

import { createSupabaseServerClient } from "@cendaro/auth/server";

import { ShellSkeleton } from "~/components/skeleton";
import { env } from "~/env";
import { WORKSPACE_COOKIE } from "~/hooks/use-workspace";
import { getQueryClient } from "~/trpc/query-client";
import { trpc } from "~/trpc/server";
import { AppShell } from "./app-shell";
import { Providers } from "./providers";

async function WorkspaceLoader({ children }: { children: React.ReactNode }) {
  await connection();
  const cookieStore = await cookies();
  const workspaceId = cookieStore.get(WORKSPACE_COOKIE)?.value;

  // SEC-FE-01: Defense-in-depth server-side session verification before
  // rendering the authenticated AppShell (independent of proxy.ts).
  if (env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const supabase = createSupabaseServerClient(
      cookieStore,
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    );
    const { data } = await supabase.auth.getClaims();
    if (!data?.claims.sub) {
      redirect("/login");
    }
  }

  // SSR prefetch shell data so the rail + header + rates render instantly
  // Shared queryOptions — same queryKey as the client hooks (options proxy)
  const queryClient = getQueryClient();
  try {
    await Promise.all([
      queryClient.prefetchQuery(trpc.users.me.queryOptions()),
      queryClient.prefetchQuery(trpc.workspace.list.queryOptions()),
      queryClient.prefetchQuery(trpc.pricing.latestRates.queryOptions()),
    ]);
  } catch {
    // Prefetch failure is non-critical — client will fetch on hydration
  }

  return (
    <Providers
      initialWorkspaceId={workspaceId}
      dehydratedState={dehydrate(queryClient)}
    >
      <AppShell>{children}</AppShell>
    </Providers>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <WorkspaceLoader>{children}</WorkspaceLoader>
    </Suspense>
  );
}
