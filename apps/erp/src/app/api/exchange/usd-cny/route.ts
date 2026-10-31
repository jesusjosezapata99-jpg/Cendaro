import { connection, NextResponse } from "next/server";

import { getUsdCnyRate } from "@cendaro/api";

import { rateLimit } from "~/lib/rate-limit";

/**
 * Public USD → CNY rate for display (Frankfurter, ExchangeRate-API fallback).
 *
 * Upstream fetching, validation and caching live in @cendaro/api
 * (services/exchange-rate-sources, PLAN-2026-09-SECURITY-REMEDIATION F4.1).
 */
export async function GET(request?: Request) {
  // Dynamic per request; see /api/bcv-rate (keeps the build from running
  // and aborting the upstream fetch).
  await connection();

  // SEC-FE-08: Per-IP rate limiting on public exchange rate route
  if (request) {
    const rawIp = request.headers.get("x-forwarded-for") ?? "";
    const ip = rawIp.split(",")[0]?.trim() ?? "unknown";
    const { success: allowed } = await rateLimit(`usd-cny:ip:${ip}`, {
      window: 60_000,
      max: 60,
    });
    if (!allowed) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes. Intente nuevamente en un minuto." },
        { status: 429 },
      );
    }
  }
  const rate = await getUsdCnyRate();
  if (!rate) {
    return NextResponse.json(
      { error: "All USD/CNY APIs unavailable" },
      { status: 502 },
    );
  }
  return NextResponse.json(
    { ...rate, cachedAt: new Date().toISOString() },
    {
      headers: {
        "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600",
      },
    },
  );
}
