/**
 * Cendaro — tRPC Server-Side Caller
 *
 * Creates a tRPC caller for use in React Server Components
 * and Server Actions. No HTTP round-trip — calls procedures directly.
 */
import { cookies, headers } from "next/headers";
import { cache } from "react";

import type { AppRouter } from "@cendaro/api";
import { createCaller, createTRPCContext } from "@cendaro/api";
import { createSupabaseServerClient } from "@cendaro/auth/server";

/**
 * Create a cached tRPC context for the current request.
 * React `cache()` ensures we reuse the same context within
 * a single server render.
 */
const createContext = cache(async () => {
  /* eslint-disable no-restricted-properties */
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  /* eslint-enable no-restricted-properties */

  const heads = new Headers(await headers());
  heads.set("x-trpc-source", "rsc");

  let user = null;
  if (supabaseUrl && supabaseKey) {
    const cookieStore = await cookies();
    const supabase = createSupabaseServerClient(cookieStore, supabaseUrl, supabaseKey);
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
