/**
 * Cendaro — Upstream exchange-rate sources
 * (PLAN-2026-09-SECURITY-REMEDIATION F4.1, F8.6)
 *
 * Server-only. Fetches the official rate (bcv.org.ve, DolarAPI fallback), the
 * parallel rate (DolarAPI) and USD/CNY (Frankfurter, ExchangeRate-API
 * fallback), validates every payload and caches the result per instance:
 *  - concurrent callers share one in-flight upstream request,
 *  - a forced refresh reaches the upstream at most once per MIN_REFRESH_MS,
 *  - after a failure the last good value is served for up to MAX_STALE_MS,
 *    then null (so old data is never stored as a new daily rate).
 * The browser never supplies a rate: /api/bcv-rate, /api/exchange/usd-cny,
 * pricing.syncRates and the scheduled sync all read from here.
 */
import https from "node:https";
import { z } from "zod/v4";

import { logger } from "../logger";
import { BCV_TRUSTED_CA } from "./bcv-ca";

/** bcv.org.ve omits its intermediate; see bcv-ca.ts. Built once: full TLS verification. */
const BCV_AGENT = new https.Agent({ ca: [...BCV_TRUSTED_CA] });

// ── Bounds and endpoints ─────────────────────────

/**
 * Bs per USD. Deliberately wide: it only rejects parse garbage. Real jumps
 * are caught by the ±15 % guard of modules/rate-sync, which (unlike a fixed
 * ceiling) keeps working as the bolívar devalues.
 */
const MIN_VES_RATE = 1;
const MAX_VES_RATE = 100_000;
const MIN_CNY_RATE = 5;
const MAX_CNY_RATE = 10;

/** Parallel estimate shown when DolarAPI has no quote — display only, never stored. */
const ESTIMATED_PARALLEL_FACTOR = 1.15;

const BCV_URL = "https://www.bcv.org.ve/";
const DOLAR_API_URL = "https://ve.dolarapi.com/v1/dolares";
const FRANKFURTER_URL = "https://api.frankfurter.dev/v1/latest?from=USD&to=CNY";
const EXCHANGE_RATE_API_URL = "https://v6.exchangerate-api.com/v6";

const UPSTREAM_TIMEOUT_MS = 6_500;
/** The BCV home page is a few hundred KB; far more is not the page we parse. */
const MAX_BCV_HTML_BYTES = 2 * 1024 * 1024;

const CACHE_TTL_MS = 15 * 60 * 1000;
const MIN_REFRESH_MS = 60 * 1000;
/** Past this age a last-good value is dropped rather than served (or stored). */
const MAX_STALE_MS = 6 * 60 * 60 * 1000;

// ── Types ────────────────────────────────────────

export interface UpstreamRate {
  rate: number;
  /** Upstream value date, YYYY-MM-DD. */
  date: string;
  /** Provider id, stored in exchange_rate.source (e.g. "bcv-direct"). */
  source: string;
}

export interface BcvDirect {
  usdRate: number;
  eurRate: number | null;
  date: string;
  dateText: string;
}

export interface DolarApiRates {
  oficial: { rate: number; date: string } | null;
  paralelo: { rate: number; date: string } | null;
}

export interface VesRates {
  oficial: UpstreamRate & { dateText: string };
  euro: UpstreamRate | null;
  /** `estimated` = derived from the official rate for display; never stored. */
  paralelo: UpstreamRate & { estimated: boolean };
  spread: { absolute: number; percentage: number };
  timestamp: string;
}

// ── Pure parsers ─────────────────────────────────

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function inRange(value: number, min: number, max: number): boolean {
  return Number.isFinite(value) && value >= min && value <= max;
}

/** "813,73610000" (es-VE) → 813.7361 */
function parseVesNumber(raw: string): number {
  return Number.parseFloat(raw.replace(/\./g, "").replace(",", "."));
}

export function parseBcvHtml(
  html: string,
  today: Date = new Date(),
): BcvDirect | null {
  const usd =
    /id=["']dolar["'][\s\S]*?<strong[^>]*>\s*([0-9.,]+)\s*<\/strong>/i.exec(
      html,
    )?.[1];
  if (!usd) return null;
  const usdRate = parseVesNumber(usd);
  if (!inRange(usdRate, MIN_VES_RATE, MAX_VES_RATE)) return null;

  const eur =
    /id=["']euro["'][\s\S]*?<strong[^>]*>\s*([0-9.,]+)\s*<\/strong>/i.exec(
      html,
    )?.[1];
  const eurParsed = eur ? parseVesNumber(eur) : Number.NaN;
  const eurRate = inRange(eurParsed, MIN_VES_RATE, MAX_VES_RATE)
    ? eurParsed
    : null;

  const date =
    /content=["']([0-9]{4}-[0-9]{2}-[0-9]{2})/i.exec(html)?.[1] ??
    isoDay(today);
  const text = (
    /Fecha Valor:[^<]*<span[^>]*>([\s\S]*?)<\/span>/i.exec(html)?.[1] ?? ""
  )
    .replace(/\s+/g, " ")
    .trim();

  return { usdRate, eurRate, date, dateText: text.length > 0 ? text : date };
}

const dolarApiItemSchema = z.object({
  fuente: z.string(),
  promedio: z.number().nullable(),
  fechaActualizacion: z.string(),
});

export function parseDolarApi(json: unknown): DolarApiRates | null {
  if (!Array.isArray(json)) return null;
  const items: unknown[] = json;

  const pick = (fuente: string): { rate: number; date: string } | null => {
    for (const item of items) {
      const parsed = dolarApiItemSchema.safeParse(item);
      if (!parsed.success || parsed.data.fuente !== fuente) continue;
      const { promedio, fechaActualizacion } = parsed.data;
      const day = /^\d{4}-\d{2}-\d{2}/.exec(fechaActualizacion)?.[0];
      if (
        promedio === null ||
        !inRange(promedio, MIN_VES_RATE, MAX_VES_RATE) ||
        !day
      ) {
        return null;
      }
      return { rate: promedio, date: day };
    }
    return null;
  };

  return { oficial: pick("oficial"), paralelo: pick("paralelo") };
}

const frankfurterSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rates: z.object({ CNY: z.number() }),
});

export function parseFrankfurter(json: unknown): UpstreamRate | null {
  const parsed = frankfurterSchema.safeParse(json);
  if (
    !parsed.success ||
    !inRange(parsed.data.rates.CNY, MIN_CNY_RATE, MAX_CNY_RATE)
  ) {
    return null;
  }
  return {
    rate: parsed.data.rates.CNY,
    date: parsed.data.date,
    source: "frankfurter",
  };
}

const exchangeRateApiSchema = z.object({
  result: z.literal("success"),
  conversion_rate: z.number(),
  time_last_update_utc: z.string().optional(),
});

export function parseExchangeRateApi(
  json: unknown,
  today: Date = new Date(),
): UpstreamRate | null {
  const parsed = exchangeRateApiSchema.safeParse(json);
  if (
    !parsed.success ||
    !inRange(parsed.data.conversion_rate, MIN_CNY_RATE, MAX_CNY_RATE)
  ) {
    return null;
  }
  const updated = parsed.data.time_last_update_utc
    ? new Date(parsed.data.time_last_update_utc)
    : null;
  const date =
    updated && !Number.isNaN(updated.getTime())
      ? isoDay(updated)
      : isoDay(today);
  return {
    rate: parsed.data.conversion_rate,
    date,
    source: "exchangerate-api",
  };
}

/** Official from the BCV page (DolarAPI fallback), parallel from DolarAPI. */
export function composeVesRates(
  bcv: BcvDirect | null,
  dolarApi: DolarApiRates | null,
  now: Date,
): VesRates | null {
  const oficial = bcv
    ? {
        rate: bcv.usdRate,
        date: bcv.date,
        dateText: bcv.dateText,
        source: "bcv-direct",
      }
    : dolarApi?.oficial
      ? {
          rate: dolarApi.oficial.rate,
          date: dolarApi.oficial.date,
          dateText: dolarApi.oficial.date,
          source: "dolarapi-oficial",
        }
      : null;
  if (!oficial) return null;

  const paralelo = dolarApi?.paralelo
    ? {
        rate: dolarApi.paralelo.rate,
        date: dolarApi.paralelo.date,
        source: "dolarapi-paralelo",
        estimated: false,
      }
    : {
        rate: oficial.rate * ESTIMATED_PARALLEL_FACTOR,
        date: oficial.date,
        source: "estimated-fallback",
        estimated: true,
      };

  const spreadAbsolute = paralelo.rate - oficial.rate;
  return {
    oficial,
    euro: bcv?.eurRate
      ? { rate: bcv.eurRate, date: bcv.date, source: "bcv-direct" }
      : null,
    paralelo,
    spread: {
      absolute: Number(spreadAbsolute.toFixed(4)),
      percentage: Number(((spreadAbsolute / oficial.rate) * 100).toFixed(2)),
    },
    timestamp: now.toISOString(),
  };
}

// ── Cache ────────────────────────────────────────

export interface CachedLoaderOptions {
  ttlMs: number;
  /** Minimum age before a forced refresh (or a retry after a failure) calls the upstream again. */
  minRefreshMs: number;
  /**
   * While the upstream fails, the last good value is served until it is this
   * old; then the loader returns null instead of passing old data off as new.
   */
  maxStaleMs: number;
  now?: () => number;
}

export type CachedLoader<T> = (options?: {
  fresh?: boolean;
}) => Promise<T | null>;

export function createCachedLoader<T>(
  fetcher: () => Promise<T | null>,
  options: CachedLoaderOptions,
): CachedLoader<T> {
  const now = options.now ?? Date.now;
  let value: T | null = null;
  let fetchedAt = Number.NEGATIVE_INFINITY;
  let attemptedAt = Number.NEGATIVE_INFINITY;
  let inFlight: Promise<T | null> | null = null;

  const lastGood = (): T | null =>
    value !== null && now() - fetchedAt < options.maxStaleMs ? value : null;

  return ({ fresh = false } = {}) => {
    const t = now();
    const maxAge = fresh ? options.minRefreshMs : options.ttlMs;
    if (value !== null && t - fetchedAt < maxAge) return Promise.resolve(value);
    if (inFlight) return inFlight;
    // The upstream just failed: do not hammer it, serve what we have.
    if (t - attemptedAt < options.minRefreshMs) {
      return Promise.resolve(lastGood());
    }

    attemptedAt = t;
    inFlight = fetcher()
      .then((next) => {
        if (next === null) return lastGood();
        value = next;
        fetchedAt = now();
        return next;
      })
      .catch(() => lastGood())
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  };
}

// ── Upstream I/O ─────────────────────────────────

function fetchBcvHtml(): Promise<string | null> {
  return new Promise((resolve) => {
    const req = https.get(
      BCV_URL,
      {
        agent: BCV_AGENT,
        timeout: UPSTREAM_TIMEOUT_MS,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "es-VE,es;q=0.9",
        },
      },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          resolve(null);
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_BCV_HTML_BYTES) {
            req.destroy();
            resolve(null);
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        res.on("error", () => resolve(null));
      },
    );
    req.on("error", (error) => {
      logger.warn("exchange-rate upstream failed", { upstream: "bcv" }, error);
      resolve(null);
    });
    req.on("timeout", () => {
      req.destroy();
      resolve(null);
    });
  });
}

/** GET + JSON; `null` on any failure (logged without the URL, which may hold a key). */
async function fetchJson(url: string, upstream: string): Promise<unknown> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    if (!res.ok) {
      logger.warn("exchange-rate upstream failed", {
        upstream,
        status: res.status,
      });
      return null;
    }
    const body: unknown = await res.json();
    return body;
  } catch (error) {
    logger.warn("exchange-rate upstream failed", {
      upstream,
      reason: error instanceof Error ? error.name : "unknown",
    });
    return null;
  }
}

async function fetchVesRates(): Promise<VesRates | null> {
  const [html, dolarApiJson] = await Promise.all([
    fetchBcvHtml(),
    fetchJson(DOLAR_API_URL, "dolarapi"),
  ]);
  return composeVesRates(
    html ? parseBcvHtml(html) : null,
    parseDolarApi(dolarApiJson),
    new Date(),
  );
}

async function fetchUsdCnyRate(): Promise<UpstreamRate | null> {
  const primary = parseFrankfurter(
    await fetchJson(FRANKFURTER_URL, "frankfurter"),
  );
  if (primary) return primary;

  const apiKey = process.env.EXCHANGE_RATE_API_KEY;
  if (!apiKey) return null;
  return parseExchangeRateApi(
    await fetchJson(
      `${EXCHANGE_RATE_API_URL}/${encodeURIComponent(apiKey)}/pair/USD/CNY`,
      "exchangerate-api",
    ),
  );
}

/** Official + parallel Bs rates (cached 15 min, forced refresh ≥ 60 s apart). */
export const getVesRates: CachedLoader<VesRates> = createCachedLoader(
  fetchVesRates,
  {
    ttlMs: CACHE_TTL_MS,
    minRefreshMs: MIN_REFRESH_MS,
    maxStaleMs: MAX_STALE_MS,
  },
);

/** USD → CNY rate (cached 15 min, forced refresh ≥ 60 s apart). */
export const getUsdCnyRate: CachedLoader<UpstreamRate> = createCachedLoader(
  fetchUsdCnyRate,
  {
    ttlMs: CACHE_TTL_MS,
    minRefreshMs: MIN_REFRESH_MS,
    maxStaleMs: MAX_STALE_MS,
  },
);
