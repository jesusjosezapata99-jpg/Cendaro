import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { logger, runScheduledRateSync } from "@cendaro/api";

import { env } from "~/env";

/**
 * Daily exchange-rate sync (Vercel Cron, see vercel.json;
 * PLAN-2026-09-SECURITY-REMEDIATION F4.1).
 *
 * Vercel calls this with `Authorization: Bearer $CRON_SECRET`. It fails
 * closed: without a CRON_SECRET of at least 32 characters nothing runs
 * (503), any other header is 401.
 * /api/* skips the session proxy, so this secret is the only gate.
 *
 * No `export const dynamic = "force-dynamic"`: with cacheComponents Next 16
 * forbids segment-config dynamic markers. A route handler that reads
 * request headers is dynamic by usage — nothing to declare.
 */

/** Shorter secrets are guessable; `openssl rand -hex 32` gives 64. */
const MIN_SECRET_LENGTH = 32;

/** Constant-time comparison; hashing first makes the lengths equal. */
function hasValidSecret(header: string | null, secret: string): boolean {
  if (!header) return false;
  const expected = createHash("sha256").update(`Bearer ${secret}`).digest();
  const received = createHash("sha256").update(header).digest();
  return timingSafeEqual(expected, received);
}

export async function GET(request: Request) {
  // Read the header before anything else: this request access is what makes
  // the route dynamic, so the build-time prerender probe stops here instead
  // of running the missing-secret branch (and logging it) with no secret.
  const authorization = request.headers.get("authorization");
  const secret = env.CRON_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    logger.error(
      "CRON_SECRET is missing or shorter than 32 characters: scheduled rate sync refused",
    );
    return NextResponse.json(
      { error: "Tarea programada no configurada" },
      { status: 503 },
    );
  }
  if (!hasValidSecret(authorization, secret)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const summary = await runScheduledRateSync();
    return NextResponse.json(summary, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    logger.error("scheduled rate sync crashed", {}, error);
    return NextResponse.json(
      { error: "La sincronización de tasas falló" },
      { status: 500 },
    );
  }
}
