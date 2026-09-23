"use client";

import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { pickTrustedRate } from "@cendaro/validators";

import { useSyncRates } from "~/hooks/use-sync-rates";
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
    // The route serves the server's 15-min cache; a forced upstream refresh
    // is pricing.syncRates (rates.update), not a public query flag.
    const res = await fetch("/api/bcv-rate", {
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

// ── Live vs stored ────────────────────────────

interface LiveRate {
  rate: number;
  date: string;
  dateText?: string;
  source: string;
}

interface StoredRate {
  rate: number;
  createdAt: Date | string;
}

/**
 * The live rate unless it moved beyond the automatic limit from the stored
 * one: the server holds such a rate for an owner/admin, so screens keep
 * pricing with the stored rate until it is accepted (F4.1, decision 6).
 */
function resolveRate(
  live: LiveRate | null | undefined,
  stored: StoredRate | undefined,
  pending: { isLoading: boolean; error: string | null },
): RateInfo {
  const origin = pickTrustedRate(live?.rate, stored?.rate);
  if (origin === "live" && live) {
    return {
      rate: live.rate,
      date: live.date,
      dateText: live.dateText,
      source: live.source,
      isLoading: false,
      error: null,
    };
  }
  if (origin === "stored" && stored) {
    return {
      rate: stored.rate,
      date: new Date(stored.createdAt).toISOString().slice(0, 10),
      source: "database",
      isLoading: false,
      error: null,
    };
  }
  return {
    rate: 0,
    date: new Date().toISOString().slice(0, 10),
    source: "manual",
    isLoading: pending.isLoading,
    error: pending.error,
  };
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
 *
 * A live rate more than 15 % away from the stored one is not used: the
 * server holds it for approval and the stored rate stays in force.
 */
export function useVesRates(): VesRatesResult {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);
  const { canSync, sync } = useSyncRates({ auto: false });

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
      // Roles with rates.update ask the server to fetch and store fresh
      // rates (its onSuccess seeds the caches); others re-read the proxy.
      if (canSync) {
        try {
          await sync(true);
          return;
        } catch {
          // Fall through to a plain re-read; the page keeps working.
        }
      }
      const fresh = await fetchFromProxy(true);
      if (fresh) {
        qc.setQueryData(["ves-rates-proxy"], fresh);
      } else {
        await refetch();
      }
    } finally {
      setIsSyncing(false);
    }
  }, [canSync, sync, qc, refetch]);

  // ── Oficial and paralelo: live unless held ──

  const oficial = resolveRate(
    apiResult?.oficial,
    dbRates?.find((r) => r.rateType === "bcv"),
    {
      isLoading,
      error: error ? "No se pudo obtener la tasa oficial" : null,
    },
  );
  const paralelo = resolveRate(
    apiResult?.paralelo,
    dbRates?.find((r) => r.rateType === "parallel"),
    {
      isLoading,
      error: error ? "No se pudo obtener la tasa paralela" : null,
    },
  );

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

  // ── Spread calculation ──────────────────────
  // From the rates actually shown: the upstream spread would describe a live
  // rate that may be held.

  const hasBoth = oficial.rate > 0 && paralelo.rate > 0;
  const spread = {
    absolute: hasBoth ? paralelo.rate - oficial.rate : 0,
    percentage: hasBoth
      ? ((paralelo.rate - oficial.rate) / oficial.rate) * 100
      : 0,
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
