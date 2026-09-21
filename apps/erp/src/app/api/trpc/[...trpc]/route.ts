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
 *   • Unexpected failures (INTERNAL_SERVER_ERROR) reported to Sentry
 */
import { cookies } from "next/headers";
import * as Sentry from "@sentry/nextjs";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import type { AuthenticatedUser } from "@cendaro/api";
import { appRouter, createTRPCContext, mapClaimsToUser } from "@cendaro/api";
import { createSupabaseServerClient } from "@cendaro/auth/server";

import { env } from "~/env";
import { readBodyWithByteLimit } from "~/lib/request-body-limit";

const MAX_BATCH_SIZE = 15;
const MAX_PAYLOAD_BYTES = 10 * 1024 * 1024; // 10MB

const handler = async (incoming: Request) => {
  let req = incoming;

  // ── DoS Guard: Batch Query Amplification Limit ──
  try {
    const url = new URL(req.url);
    const trpcPath = url.pathname.replace(/^\/api\/trpc\/?/, "");
    if (trpcPath) {
      const batchCount = trpcPath.split(",").filter(Boolean).length;
      if (batchCount > MAX_BATCH_SIZE) {
        return new Response(
          JSON.stringify({
            error: {
              message: `El tamaño del lote excede el límite máximo de ${MAX_BATCH_SIZE} procedimientos`,
              code: -32600,
            },
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
    }
  } catch {
    // URL parsing fallback
  }

  // ── DoS Guard: Payload Size Limit ──
  const contentLength = req.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_PAYLOAD_BYTES) {
    return new Response(
      JSON.stringify({
        error: {
          message: "Cuerpo de solicitud demasiado grande (máx 10MB)",
          code: -32600,
        },
      }),
      {
        status: 413,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  // ── DoS Guard: streamed bodies (no content-length header) ──
  // F9.4: a chunked POST bypasses the header check above by definition.
  // Read it once with the same hard cap; on breach answer 413 without
  // buffering the rest.
  if (!contentLength) {
    const limited = await readBodyWithByteLimit(req, MAX_PAYLOAD_BYTES);
    if (!limited.ok) {
      return new Response(
        JSON.stringify({
          error: {
            message: "Cuerpo de solicitud demasiado grande (máx 10MB)",
            code: -32600,
          },
        }),
        {
          status: 413,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
    req = limited.request;
  }

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let user: AuthenticatedUser | null = null;
  if (supabaseUrl && supabaseKey) {
    const cookieStore = await cookies();
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

  const response = await fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () =>
      createTRPCContext({
        headers: new Headers(req.headers),
        user,
      }),
    // Structured logging of every procedure error stays in the
    // loggingMiddleware (trpc.ts). Sentry only receives unexpected failures:
    // tRPC turns thrown errors into 500 responses itself, so onRequestError
    // in instrumentation.ts never sees them. Expected errors (UNAUTHORIZED,
    // FORBIDDEN, BAD_REQUEST, NOT_FOUND…) are not reported.
    onError: ({ error, path }) => {
      if (error.code === "INTERNAL_SERVER_ERROR") {
        Sentry.captureException(error.cause ?? error, {
          tags: { trpcPath: path ?? "unknown" },
        });
      }
    },
  });

  return response;
};

export { handler as GET, handler as POST };
