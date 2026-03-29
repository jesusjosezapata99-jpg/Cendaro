/**
 * Cendaro — tRPC Server-Side Caller
 *
 * Creates a tRPC caller for use in React Server Components
 * and Server Actions. No HTTP round-trip — calls procedures directly.
 */
import { cache } from "react";
import { cookies, headers } from "next/headers";

import type { AppRouter } from "@cendaro/api";
import { createCaller, createTRPCContext } from "@cendaro/api";
import { createSupabaseServerClient } from "@cendaro/auth/server";

import { env } from "~/env";

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

  let user = null;
  if (supabaseUrl && supabaseKey) {
    const supabase = createSupabaseServerClient(
      cookieStore,
      supabaseUrl,
      supabaseKey,
    );
    const { data } = await supabase.auth.getUser();
    user = data.user;
  }

  return createTRPCContext({
    headers: heads,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
    user: user as any,
  });
});

const caller = createCaller(createContext);
export { caller as api };
export type { AppRouter };
