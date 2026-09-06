"use client";

import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useTRPC } from "~/trpc/client";

// ── Types ─────────────────────────────────────

export interface RateInfo {
  /** Exchange rate VES per 1 USD (or USDT for paralelo) */
  rate: number;
  /** Date of the rate (YYYY-MM-DD) */
  date: string;
  /** Official readable date text (e.g. "Lunes, 07 Septiembre 2026") */
  dateText?: string;
  /** Where the rate came from */
  source: string;
  /** Whether the rate is loading */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
}

export interface VesRatesResult {
  /** Official BCV rate (Bs per 1 USD) */
  oficial: RateInfo;
  /** Official BCV euro rate if available */
  euro?: RateInfo | null;
  /** Parallel/USDT rate (Bs per 1 USDT) */
  paralelo: RateInfo;
  /** Spread between parallel and official */
  spread: {
    absolute: number;
    percentage: number;
  };
  /** Trigger manual live refresh */
  syncRate: () => Promise<void>;
  /** Whether manual sync is in progress */
  isSyncing: boolean;
}

/** Shape returned by the /api/bcv-rate proxy */
interface ProxyResponse {
  oficial: { rate: number; date: string; dateText?: string; source: string };
  euro?: { rate: number; date: string; source: string } | null;
  paralelo: { rate: number; date: string; source: string };
  spread?: { absolute: number; percentage: number };
}

// ── Backwards-compatible type (used by existing consumers) ──

export interface BcvRateResult {
  /** Exchange rate VES per 1 USD */
  rate: number;
  /** Date of the rate (YYYY-MM-DD) */
  date: string;
  /** Official readable date text (e.g. "Lunes, 07 Septiembre 2026") */
  dateText?: string;
  /** Where the rate came from */
  source: string;
  /** Whether the rate is loading */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Manual sync trigger */
  syncRate: () => Promise<void>;
  /** Whether manual sync is in progress */
  isSyncing: boolean;
}

// ── Fetch from server proxy ───────────────────

async function fetchFromProxy(
  forceRefresh = false,
): Promise<ProxyResponse | null> {
  try {
    const url = forceRefresh ? "/api/bcv-rate?refresh=true" : "/api/bcv-rate";
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      cache: forceRefresh ? "no-store" : "default",
    });
    if (res.ok) {
      const data = (await res.json()) as ProxyResponse;
      if (data.oficial.rate) {
        return data;
      }
    }
  } catch {
    // Proxy failed
  }
  return null;
}

// ── Primary hook: both rates + spread + sync ─────────

/**
 * Hook that fetches both official (BCV) and parallel (USDT) exchange rates
 * directly from BCV and DolarAPI via our server proxy.
 *
 * Fallback chain:
 *   1. Direct BCV portal scraper (bcv.org.ve)
 *   2. DolarAPI (ve.dolarapi.com)
 *   3. Database (pricing.latestRates)
 */
export function useVesRates(): VesRatesResult {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);

  // DB fallback: latest rates from ExchangeRate table
  const { data: dbRates } = useQuery(trpc.pricing.latestRates.queryOptions());

  const {
    data: apiResult,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["ves-rates-proxy"],
    queryFn: () => fetchFromProxy(false),
    staleTime: 15 * 60 * 1000, // 15 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
    retry: 1,
  });

  const syncRate = useCallback(async () => {
    setIsSyncing(true);
    try {
      const fresh = await fetchFromProxy(true);
      if (fresh) {
        qc.setQueryData(["ves-rates-proxy"], fresh);
      } else {
        await refetch();
      }
    } finally {
      setIsSyncing(false);
    }
  }, [qc, refetch]);

  // ── Build oficial rate ──────────────────────

  let oficial: RateInfo;

  if (apiResult?.oficial) {
    oficial = {
      rate: apiResult.oficial.rate,
      date: apiResult.oficial.date,
      dateText: apiResult.oficial.dateText,
      source: apiResult.oficial.source,
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

  // ── Build euro rate ─────────────────────────
  const euro: RateInfo | null = apiResult?.euro
    ? {
        rate: apiResult.euro.rate,
        date: apiResult.euro.date,
        source: apiResult.euro.source,
        isLoading: false,
        error: null,
      }
    : null;

  // ── Build paralelo rate ─────────────────────

  let paralelo: RateInfo;

  if (apiResult?.paralelo) {
    paralelo = {
      rate: apiResult.paralelo.rate,
      date: apiResult.paralelo.date,
      source: apiResult.paralelo.source,
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
      apiResult?.spread?.absolute ??
      (oficial.rate > 0 && paralelo.rate > 0
        ? paralelo.rate - oficial.rate
        : 0),
    percentage:
      apiResult?.spread?.percentage ??
      (oficial.rate > 0 && paralelo.rate > 0
        ? ((paralelo.rate - oficial.rate) / oficial.rate) * 100
        : 0),
  };

  return { oficial, euro, paralelo, spread, syncRate, isSyncing };
}

// ── Backwards-compatible hook ─────────────────

/**
 * Backwards-compatible hook that returns the official BCV rate
 * along with sync trigger and readable date text.
 */
export function useBcvRate(): BcvRateResult {
  const { oficial, syncRate, isSyncing } = useVesRates();
  return {
    ...oficial,
    syncRate,
    isSyncing,
  };
}
