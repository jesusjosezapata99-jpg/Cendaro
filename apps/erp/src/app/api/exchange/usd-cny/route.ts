import { connection, NextResponse } from "next/server";

import { getUsdCnyRate } from "@cendaro/api";

/**
 * Public USD → CNY rate for display (Frankfurter, ExchangeRate-API fallback).
 *
 * Upstream fetching, validation and caching live in @cendaro/api
 * (services/exchange-rate-sources, PLAN-2026-09-SECURITY-REMEDIATION F4.1).
 */
export async function GET() {
  // Dynamic per request; see /api/bcv-rate (keeps the build from running
  // and aborting the upstream fetch).
  await connection();
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
