/**
 * Cendaro — tRPC Server-Side Proxy
 *
 * Official tRPC v11 pattern (`createTRPCOptionsProxy`) for React Server
 * Components: `trpc.<procedure>.queryOptions(input)` generates the SAME
 * queryKey the client hooks use, so an SSR prefetch always hits the client
 * cache on hydration — no hand-written queryKey duplication (a single
 * typo'd key today = cache miss + double fetch).
 *
 * The proxy calls the router directly (no HTTP round-trip). A direct
 * caller (`api`) is also kept for server actions / non-hook call sites.
 */
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";

import type { AppRouter, AuthenticatedUser } from "@cendaro/api";
import {
  appRouter,
  createCaller,
  createTRPCContext,
  mapClaimsToUser,
} from "@cendaro/api";
import { createSupabaseServerClient } from "@cendaro/auth/server";

import { env } from "~/env";
import { getQueryClient } from "./query-client";

/**
 * Create a cached tRPC context for the current request.
 * React `cache()` ensures we reuse the same context within
 * a single server render.
 */
const createContext = cache(async () => {
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const heads = new Headers(await headers());
  heads.set("x-trpc-source", "rsc");

  // Inject workspace ID from cookie for RSC/Server Actions
  const cookieStore = await cookies();
  const wsId = cookieStore.get("cendaro-workspace-id")?.value;
  if (wsId && !heads.has("x-workspace-id")) {
    heads.set("x-workspace-id", wsId);
  }

  let user: AuthenticatedUser | null = null;
  if (supabaseUrl && supabaseKey) {
    const supabase = createSupabaseServerClient(
      cookieStore,
      supabaseUrl,
      supabaseKey,
    );
    // getClaims() verifies the JWT locally via cached JWKS (asymmetric
    // signing keys) — no network round-trip to Supabase Auth per request.
    const { data } = await supabase.auth.getClaims();
    user = mapClaimsToUser(data?.claims);
  }

  return createTRPCContext({
    headers: heads,
    user,
  });
});

export const trpc = createTRPCOptionsProxy({
  router: appRouter,
  ctx: () => createContext(),
  queryClient: getQueryClient,
});

// Direct caller kept for server actions / non-hook call sites
const caller = createCaller(createContext);
export { caller as api };
export type { AppRouter };
