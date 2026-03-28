/**
 * Cendaro — tRPC API Route Handler
 *
 * Exposes the appRouter via Next.js App Router API route.
 * POST /api/trpc/[...trpc]
 *
 * Features:
 *   • Structured logging (JSON in prod, pretty in dev)
 *   • Request-ID correlation via x-request-id header
 *   • Full error context in production logs
 */
import { cookies } from "next/headers";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { appRouter, createTRPCContext } from "@cendaro/api";
import { createSupabaseServerClient } from "@cendaro/auth/server";

import { env } from "~/env";

const handler = async (req: Request) => {
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let user = null;
  if (supabaseUrl && supabaseKey) {
    const cookieStore = await cookies();
    const supabase = createSupabaseServerClient(
      cookieStore,
      supabaseUrl,
      supabaseKey,
    );
    const { data } = await supabase.auth.getUser();
    user = data.user;
  }

  const response = await fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () =>
      createTRPCContext({
        headers: new Headers(req.headers),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
        user: user as any,
      }),
    // Error logging is handled by the loggingMiddleware in trpc.ts
    // No need for onError here — all procedure errors are already logged
    // with full structured context (requestId, userId, path, duration)
  });

  return response;
};

export { handler as GET, handler as POST };
