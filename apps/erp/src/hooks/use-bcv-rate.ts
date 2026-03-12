"use client";

import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "~/trpc/client";

// ── Types ─────────────────────────────────────

interface RateInfo {
  /** Exchange rate VES per 1 USD (or USDT for paralelo) */
  rate: number;
  /** Date of the rate (YYYY-MM-DD) */
  date: string;
  /** Where the rate came from */
  source: "dolarapi-oficial" | "dolarapi-paralelo" | "database" | "manual";
  /** Whether the rate is loading */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
}

interface VesRatesResult {
  /** Official BCV rate (Bs per 1 USD) */
  oficial: RateInfo;
  /** Parallel/USDT rate (Bs per 1 USDT) */
  paralelo: RateInfo;
  /** Spread between parallel and official */
  spread: {
    absolute: number;
    percentage: number;
  };
}

/** Shape returned by the /api/bcv-rate proxy */
interface ProxyResponse {
  oficial: { rate: number; date: string; source: string };
  paralelo: { rate: number; date: string; source: string };
}

// ── Backwards-compatible type (used by existing consumers) ──

interface BcvRateResult {
  /** Exchange rate VES per 1 USD */
  rate: number;
  /** Date of the rate (YYYY-MM-DD) */
  date: string;
  /** Where the rate came from */
  source: "dolarapi-oficial" | "dolarapi-paralelo" | "database" | "manual";
  /** Whether the rate is loading */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
}

// ── Fetch from server proxy ───────────────────

async function fetchFromProxy(): Promise<ProxyResponse | null> {
  try {
    const res = await fetch("/api/bcv-rate", {
      signal: AbortSignal.timeout(12000),
    });
    if (res.ok) {
      const data = (await res.json()) as ProxyResponse;
      if (data.oficial.rate && data.paralelo.rate) {
        return data;
      }
    }
  } catch {
    // Proxy failed
  }
  return null;
}

// ── Primary hook: both rates + spread ─────────

/**
 * Hook that fetches both official (BCV) and parallel (USDT) exchange rates
 * from DolarAPI.com via our server proxy.
 *
 * Fallback chain:
 *   1. Server proxy → DolarAPI.com (/v1/dolares)
 *   2. Database (pricing.latestRates)
 *
 * Cached for 1 hour via React Query.
 */
export function useVesRates(): VesRatesResult {
  const trpc = useTRPC();

  // DB fallback: latest rates from ExchangeRate table
  const { data: dbRates } = useQuery(trpc.pricing.latestRates.queryOptions());

  const {
    data: apiResult,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["ves-rates-proxy"],
    queryFn: fetchFromProxy,
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 2 * 60 * 60 * 1000, // 2 hours
    retry: 1,
  });

  // ── Build oficial rate ──────────────────────

  let oficial: RateInfo;

  if (apiResult?.oficial) {
    oficial = {
      rate: apiResult.oficial.rate,
      date: apiResult.oficial.date,
      source: "dolarapi-oficial",
      isLoading: false,
      error: null,
    };
  } else {
    const bcvFromDb = dbRates?.find((r) => r.rateType === "bcv");
    if (bcvFromDb) {
      oficial = {
        rate: bcvFromDb.rate,
        date: new Date(bcvFromDb.createdAt).toISOString().slice(0, 10),
        source: "database",
        isLoading: false,
        error: null,
      };
    } else {
      oficial = {
        rate: 0,
        date: new Date().toISOString().slice(0, 10),
        source: "manual",
        isLoading,
        error: error ? "No se pudo obtener la tasa oficial" : null,
      };
    }
  }

  // ── Build paralelo rate ─────────────────────

  let paralelo: RateInfo;

  if (apiResult?.paralelo) {
    paralelo = {
      rate: apiResult.paralelo.rate,
      date: apiResult.paralelo.date,
      source: "dolarapi-paralelo",
      isLoading: false,
      error: null,
    };
  } else {
    const paraleloFromDb = dbRates?.find((r) => r.rateType === "parallel");
    if (paraleloFromDb) {
      paralelo = {
        rate: paraleloFromDb.rate,
        date: new Date(paraleloFromDb.createdAt).toISOString().slice(0, 10),
        source: "database",
        isLoading: false,
        error: null,
      };
    } else {
      paralelo = {
        rate: 0,
        date: new Date().toISOString().slice(0, 10),
        source: "manual",
        isLoading,
        error: error ? "No se pudo obtener la tasa paralela" : null,
      };
    }
  }

  // ── Spread calculation ──────────────────────

  const spread = {
    absolute:
      oficial.rate > 0 && paralelo.rate > 0 ? paralelo.rate - oficial.rate : 0,
    percentage:
      oficial.rate > 0 && paralelo.rate > 0
        ? ((paralelo.rate - oficial.rate) / oficial.rate) * 100
        : 0,
  };

  return { oficial, paralelo, spread };
}

// ── Backwards-compatible hook ─────────────────

/**
 * Backwards-compatible hook that returns only the official BCV rate.
 * Existing consumers (dashboard, orders, quotes, payments, etc.)
 * continue working with zero changes.
 */
export function useBcvRate(): BcvRateResult {
  const { oficial } = useVesRates();
  return oficial;
}
