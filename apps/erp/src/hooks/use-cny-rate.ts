"use client";

import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "~/trpc/client";

interface CnyRateResult {
  /** Exchange rate: CNY per 1 USD */
  rate: number;
  /** Date of the rate (YYYY-MM-DD) */
  date: string;
  /** Where the rate came from */
  source: "frankfurter" | "exchangerate-api" | "database" | "manual";
  /** Whether the rate is loading */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
}

/**
 * Fetch USD/CNY rate via our server-side proxy.
 * This avoids CORS issues and caches on the server (ISR 15 min).
 */
async function fetchFromProxy(): Promise<{
  rate: number;
  date: string;
  source: "frankfurter" | "exchangerate-api";
} | null> {
  try {
    const res = await fetch("/api/exchange/usd-cny", {
      signal: AbortSignal.timeout(12000),
    });
    if (res.ok) {
      const data = (await res.json()) as {
        rate: number;
        date: string;
        source: "frankfurter" | "exchangerate-api";
      };
      if (data.rate && data.date) {
        return data;
      }
    }
  } catch {
    // Proxy failed
  }
  return null;
}

/**
 * Hook that fetches the current USD/CNY exchange rate with dual fallback:
 * 1. Server-side proxy → Frankfurter API (primary)
 * 2. Server-side proxy → ExchangeRate-API (secondary)
 * 3. Database fallback (pricing.latestRates → rmb_usd)
 *
 * Cached for 15 minutes via React Query.
 */
export function useCnyRate(): CnyRateResult {
  const trpc = useTRPC();

  // DB fallback: latest rates from ExchangeRate table
  const { data: dbRates } = useQuery(trpc.pricing.latestRates.queryOptions());

  const {
    data: apiResult,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["cny-rate-proxy"],
    queryFn: fetchFromProxy,
    staleTime: 15 * 60 * 1000, // 15 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: 1,
  });

  // If proxy returned data, use it
  if (apiResult) {
    return {
      rate: apiResult.rate,
      date: apiResult.date,
      source: apiResult.source,
      isLoading: false,
      error: null,
    };
  }

  // Fallback to DB
  const rmbFromDb = dbRates?.find((r) => r.rateType === "rmb_usd");
  if (rmbFromDb) {
    return {
      rate: rmbFromDb.rate,
      date: new Date(rmbFromDb.createdAt).toISOString().slice(0, 10),
      source: "database",
      isLoading: false,
      error: null,
    };
  }

  return {
    rate: 0,
    date: new Date().toISOString().slice(0, 10),
    source: "manual",
    isLoading,
    error: error ? "No se pudo obtener la tasa USD/CNY" : null,
  };
}
