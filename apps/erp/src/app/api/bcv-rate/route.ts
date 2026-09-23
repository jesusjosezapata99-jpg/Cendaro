import { NextResponse } from "next/server";

import { getVesRates } from "@cendaro/api";

/**
 * Public official (BCV) + parallel Bs rates for display.
 *
 * Upstream fetching, validation and caching live in @cendaro/api
 * (services/exchange-rate-sources, PLAN-2026-09-SECURITY-REMEDIATION F4.1):
 * one upstream call per 15 min per instance, shared by concurrent requests.
 * The former `?refresh=true` bypassed that cache for anyone (anonymous
 * request amplification, finding M6/F8.6); it is ignored now — a forced
 * refresh is `pricing.syncRates({ force: true })`, gated by rates.update.
 */
export async function GET() {
  const rates = await getVesRates();
  if (!rates) {
    return NextResponse.json(
      { error: "No se pudo obtener la tasa oficial del BCV" },
      { status: 502 },
    );
  }
  return NextResponse.json(rates, {
    headers: {
      "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800",
    },
  });
}
