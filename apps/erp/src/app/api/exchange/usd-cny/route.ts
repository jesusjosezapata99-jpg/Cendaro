import { NextResponse } from "next/server";

import { env } from "~/env";

/**
 * Server-side proxy for USD/CNY exchange rate.
 *
 * Primary:  Frankfurter API (ECB-sourced, free, no key required)
 * Fallback: ExchangeRate-API (free tier, requires EXCHANGE_RATE_API_KEY)
 *
 * Caching: ISR 15-minute revalidation on the server side.
 * Rate sanity check: CNY/USD must be between 5.0 and 10.0.
 */

const FRANKFURTER_URL = "https://api.frankfurter.dev/v1/latest?from=USD&to=CNY";

const CNY_MIN = 5.0;
const CNY_MAX = 10.0;

function isSaneRate(rate: number): boolean {
  return rate >= CNY_MIN && rate <= CNY_MAX;
}

export async function GET() {
  const cachedAt = new Date().toISOString();

  // ── Primary: Frankfurter API ──────────────────
  try {
    const res = await fetch(FRANKFURTER_URL, {
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 900 }, // ISR cache 15 min
    });
    if (res.ok) {
      const data = (await res.json()) as {
        amount: number;
        base: string;
        date: string;
        rates: { CNY?: number };
      };
      const rate = data.rates.CNY;
      if (rate && isSaneRate(rate)) {
        return NextResponse.json(
          { rate, date: data.date, source: "frankfurter", cachedAt },
          {
            headers: {
              "Cache-Control":
                "public, s-maxage=900, stale-while-revalidate=3600",
            },
          },
        );
      }
    }
  } catch {
    // Fall through to backup
  }

  // ── Fallback: ExchangeRate-API ────────────────
  const apiKey = env.EXCHANGE_RATE_API_KEY;
  if (apiKey) {
    try {
      const res = await fetch(
        `https://v6.exchangerate-api.com/v6/${apiKey}/pair/USD/CNY`,
        {
          signal: AbortSignal.timeout(8000),
          next: { revalidate: 900 },
        },
      );
      if (res.ok) {
        const data = (await res.json()) as {
          result: string;
          conversion_rate?: number;
          time_last_update_utc?: string;
        };
        const rate = data.conversion_rate;
        if (rate && isSaneRate(rate)) {
          const date =
            data.time_last_update_utc?.split(",")[0] ??
            new Date().toISOString().slice(0, 10);
          return NextResponse.json(
            { rate, date, source: "exchangerate-api", cachedAt },
            {
              headers: {
                "Cache-Control":
                  "public, s-maxage=900, stale-while-revalidate=3600",
              },
            },
          );
        }
      }
    } catch {
      // Both APIs failed
    }
  }

  return NextResponse.json(
    { error: "All USD/CNY APIs unavailable" },
    { status: 502 },
  );
}
