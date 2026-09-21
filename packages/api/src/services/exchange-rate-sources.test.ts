/**
 * Upstream exchange-rate sources (PLAN-2026-09-SECURITY-REMEDIATION F4.1/F8.6).
 *
 * Rates are fetched and validated on the server; the browser no longer sends
 * them. Parsers are pure and the cache coalesces concurrent loads and
 * throttles forced refreshes, so neither a page load nor a "refresh" button
 * can amplify requests to BCV / DolarAPI / Frankfurter.
 */
import { describe, expect, it, vi } from "vitest";

import {
  composeVesRates,
  createCachedLoader,
  parseBcvHtml,
  parseDolarApi,
  parseExchangeRateApi,
  parseFrankfurter,
} from "./exchange-rate-sources";

const BCV_HTML = `
  <meta property="article:modified_time" content="2026-09-18T20:01:00-04:00">
  <div id="euro" class="col-sm-12"><strong class="strong-tb"> 945,65085917 </strong></div>
  <div id="dolar" class="col-sm-12"><strong class="strong-tb"> 813,73610000 </strong></div>
  <div class="pull-right dinpro center">Fecha Valor: <span class="date-display-single">Viernes, 19 Septiembre 2026</span></div>
`;

describe("parseBcvHtml", () => {
  it("reads the USD and EUR rates and the value date", () => {
    expect(parseBcvHtml(BCV_HTML)).toEqual({
      usdRate: 813.7361,
      eurRate: 945.65085917,
      date: "2026-09-18",
      dateText: "Viernes, 19 Septiembre 2026",
    });
  });

  it("rejects a page without the USD block", () => {
    expect(parseBcvHtml("<html>mantenimiento</html>")).toBeNull();
  });

  it("rejects an implausible value such as a stray fraction", () => {
    const html = BCV_HTML.replace("813,73610000", "0,5");
    expect(parseBcvHtml(html)).toBeNull();
  });
});

describe("parseDolarApi", () => {
  it("keeps valid official and parallel averages", () => {
    expect(
      parseDolarApi([
        {
          fuente: "oficial",
          nombre: "Oficial",
          compra: null,
          venta: null,
          promedio: 846.5131,
          fechaActualizacion: "2026-09-18T20:00:00.000Z",
        },
        {
          fuente: "paralelo",
          nombre: "Paralelo",
          compra: null,
          venta: null,
          promedio: 940.87,
          fechaActualizacion: "2026-09-18T21:00:00.000Z",
        },
      ]),
    ).toEqual({
      oficial: { rate: 846.5131, date: "2026-09-18" },
      paralelo: { rate: 940.87, date: "2026-09-18" },
    });
  });

  it("ignores malformed payloads instead of trusting them", () => {
    expect(parseDolarApi({ error: "rate limited" })).toBeNull();
    expect(
      parseDolarApi([
        { fuente: "oficial", promedio: "846", fechaActualizacion: "x" },
      ]),
    ).toEqual({ oficial: null, paralelo: null });
  });
});

describe("parseFrankfurter / parseExchangeRateApi", () => {
  it("accepts a sane USD/CNY rate", () => {
    expect(
      parseFrankfurter({
        amount: 1,
        base: "USD",
        date: "2026-09-18",
        rates: { CNY: 7.12 },
      }),
    ).toEqual({ rate: 7.12, date: "2026-09-18", source: "frankfurter" });
  });

  it("rejects an out-of-range CNY rate", () => {
    expect(
      parseFrankfurter({ date: "2026-09-18", rates: { CNY: 71.2 } }),
    ).toBeNull();
  });

  it("uses the real update date of ExchangeRate-API, not the weekday", () => {
    // The old code took `split(",")[0]` of "Fri, 18 Sep 2026 …" → "Fri".
    expect(
      parseExchangeRateApi({
        result: "success",
        conversion_rate: 7.1,
        time_last_update_utc: "Fri, 18 Sep 2026 00:00:01 +0000",
      }),
    ).toEqual({ rate: 7.1, date: "2026-09-18", source: "exchangerate-api" });
  });
});

describe("composeVesRates", () => {
  const now = new Date("2026-09-19T12:00:00Z");

  it("prefers the BCV page and takes the parallel rate from DolarAPI", () => {
    const rates = composeVesRates(
      {
        usdRate: 813.7361,
        eurRate: 945.65,
        date: "2026-09-18",
        dateText: "Viernes, 19 Septiembre 2026",
      },
      {
        oficial: { rate: 846.5, date: "2026-09-18" },
        paralelo: { rate: 940.87, date: "2026-09-18" },
      },
      now,
    );

    expect(rates?.oficial).toEqual({
      rate: 813.7361,
      date: "2026-09-18",
      dateText: "Viernes, 19 Septiembre 2026",
      source: "bcv-direct",
    });
    expect(rates?.paralelo).toEqual({
      rate: 940.87,
      date: "2026-09-18",
      source: "dolarapi-paralelo",
      estimated: false,
    });
    expect(rates?.euro?.rate).toBe(945.65);
  });

  it("falls back to DolarAPI for the official rate", () => {
    const rates = composeVesRates(
      null,
      {
        oficial: { rate: 846.5, date: "2026-09-18" },
        paralelo: null,
      },
      now,
    );

    expect(rates?.oficial.source).toBe("dolarapi-oficial");
    // Without a real parallel quote the display estimate is flagged so it is
    // never stored as a rate.
    expect(rates?.paralelo).toMatchObject({
      source: "estimated-fallback",
      estimated: true,
    });
  });

  it("returns null when no official rate is available", () => {
    expect(composeVesRates(null, null, now)).toBeNull();
  });
});

describe("createCachedLoader", () => {
  it("coalesces concurrent loads into one upstream call", async () => {
    const fetcher = vi.fn(() => Promise.resolve({ value: 1 }));
    const load = createCachedLoader(fetcher, {
      ttlMs: 1000,
      minRefreshMs: 100,
      maxStaleMs: 3000,
    });

    const [a, b] = await Promise.all([load(), load()]);

    expect(a).toEqual({ value: 1 });
    expect(b).toEqual({ value: 1 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("serves the cache until it expires", async () => {
    let clock = 0;
    const fetcher = vi.fn(() => Promise.resolve({ value: clock }));
    const load = createCachedLoader(fetcher, {
      ttlMs: 1000,
      minRefreshMs: 100,
      maxStaleMs: 3000,
      now: () => clock,
    });

    await load();
    clock = 999;
    expect(await load()).toEqual({ value: 0 });
    clock = 1000;
    expect(await load()).toEqual({ value: 1000 });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("throttles forced refreshes", async () => {
    let clock = 0;
    const fetcher = vi.fn(() => Promise.resolve({ value: clock }));
    const load = createCachedLoader(fetcher, {
      ttlMs: 10_000,
      minRefreshMs: 100,
      maxStaleMs: 3000,
      now: () => clock,
    });

    await load();
    clock = 50;
    expect(await load({ fresh: true })).toEqual({ value: 0 });
    clock = 100;
    expect(await load({ fresh: true })).toEqual({ value: 100 });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("keeps serving the last good value when the upstream fails", async () => {
    let clock = 0;
    let fail = false;
    const fetcher = vi.fn(() =>
      Promise.resolve(fail ? null : { value: clock }),
    );
    const load = createCachedLoader(fetcher, {
      ttlMs: 1000,
      minRefreshMs: 100,
      maxStaleMs: 3000,
      now: () => clock,
    });

    await load();
    clock = 2000;
    fail = true;
    expect(await load()).toEqual({ value: 0 });
  });

  it("stops serving a value older than maxStaleMs", async () => {
    let clock = 0;
    let fail = false;
    const fetcher = vi.fn(() =>
      Promise.resolve(fail ? null : { value: clock }),
    );
    const load = createCachedLoader(fetcher, {
      ttlMs: 1000,
      minRefreshMs: 100,
      maxStaleMs: 3000,
      now: () => clock,
    });

    await load();
    fail = true;
    clock = 3000;
    // Old data is not passed off as a fresh rate (it would be stored as one).
    expect(await load()).toBeNull();
    clock = 3050;
    expect(await load()).toBeNull();
  });
});
