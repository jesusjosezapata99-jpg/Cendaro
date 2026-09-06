import https from "node:https";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * Enterprise Exchange Rate API for Cendaro ERP.
 *
 * Tier 1: Direct official Banco Central de Venezuela (BCV) portal scraper
 *         (https://www.bcv.org.ve/) using Node HTTPS Agent for Venezuelan SSL certs.
 * Tier 2: DolarAPI fallback (https://ve.dolarapi.com/v1/dolares) for parallel/USDT
 *         and secondary official rate redundancy.
 *
 * Supports cache bypass via `?refresh=true`.
 */

interface DolarApiItem {
  fuente: "oficial" | "paralelo";
  nombre: string;
  compra: number | null;
  venta: number | null;
  promedio: number;
  fechaActualizacion: string;
}

interface BcvDirectResult {
  usdRate: number;
  eurRate: number | null;
  date: string;
  dateText: string;
}

interface RatePayload {
  oficial: {
    rate: number;
    date: string;
    dateText: string;
    source: string;
  };
  euro: {
    rate: number;
    date: string;
    source: string;
  } | null;
  paralelo: {
    rate: number;
    date: string;
    source: string;
  };
  spread: {
    absolute: number;
    percentage: number;
  };
  timestamp: string;
}

// In-memory cache (15 minutes)
let cachedRate: { data: RatePayload; expiresAt: number } | null = null;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 mins

function extractDate(iso: string): string {
  return iso.split("T")[0] ?? new Date().toISOString().slice(0, 10);
}

/**
 * Scrapes official exchange rates directly from Banco Central de Venezuela (BCV).
 */
async function fetchFromBcvDirect(): Promise<BcvDirectResult | null> {
  return new Promise((resolve) => {
    try {
      const agent = new https.Agent({ rejectUnauthorized: false });
      const req = https.get(
        "https://www.bcv.org.ve/",
        {
          agent,
          timeout: 6500,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
            Accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "es-VE,es;q=0.9,en;q=0.8",
          },
        },
        (res) => {
          if (res.statusCode !== 200) {
            resolve(null);
            return;
          }
          let html = "";
          res.on("data", (chunk) => {
            html += chunk;
          });
          res.on("end", () => {
            try {
              // Extract USD rate: <div id="dolar"...><strong class="strong-tb">813,73610000</strong>
              const dolarMatch =
                /id=["']dolar["'][\s\S]*?<strong[^>]*>\s*([0-9.,]+)\s*<\/strong>/i.exec(
                  html,
                );
              if (!dolarMatch?.[1]) {
                resolve(null);
                return;
              }
              const rawUsd = dolarMatch[1].replace(/\./g, "").replace(",", ".");
              const usdRate = parseFloat(rawUsd);
              if (isNaN(usdRate) || usdRate < 1 || usdRate > 5000) {
                resolve(null);
                return;
              }

              // Extract EUR rate: <div id="euro"...><strong class="strong-tb">945,65085917</strong>
              let eurRate: number | null = null;
              const euroMatch =
                /id=["']euro["'][\s\S]*?<strong[^>]*>\s*([0-9.,]+)\s*<\/strong>/i.exec(
                  html,
                );
              if (euroMatch?.[1]) {
                const rawEur = euroMatch[1]
                  .replace(/\./g, "")
                  .replace(",", ".");
                const parsedEur = parseFloat(rawEur);
                if (!isNaN(parsedEur) && parsedEur > 0) {
                  eurRate = parsedEur;
                }
              }

              // Extract official Fecha Valor ISO date
              let date = new Date().toISOString().slice(0, 10);
              const dateMatch =
                /content=["']([0-9]{4}-[0-9]{2}-[0-9]{2})/i.exec(html);
              if (dateMatch?.[1]) {
                date = dateMatch[1];
              }

              // Extract official Fecha Valor text (e.g. "Lunes, 07 Septiembre 2026")
              let dateText = date;
              const textMatch =
                /Fecha Valor:[^<]*<span[^>]*>([\s\S]*?)<\/span>/i.exec(html);
              if (textMatch?.[1]) {
                dateText = textMatch[1].replace(/\s+/g, " ").trim();
              }

              resolve({ usdRate, eurRate, date, dateText });
            } catch {
              resolve(null);
            }
          });
        },
      );

      req.on("error", () => resolve(null));
      req.on("timeout", () => {
        req.destroy();
        resolve(null);
      });
    } catch {
      resolve(null);
    }
  });
}

/**
 * Secondary fetch to DolarAPI for parallel/USDT rate & secondary redundancy.
 */
async function fetchFromDolarApi(): Promise<DolarApiItem[] | null> {
  try {
    const res = await fetch("https://ve.dolarapi.com/v1/dolares", {
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as DolarApiItem[];
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const isRefresh = request.nextUrl.searchParams.get("refresh") === "true";
  const now = Date.now();

  if (!isRefresh && cachedRate && cachedRate.expiresAt > now) {
    return NextResponse.json(cachedRate.data);
  }

  try {
    // Run BCV direct fetch and DolarAPI in parallel
    const [bcvDirect, dolarApiList] = await Promise.all([
      fetchFromBcvDirect(),
      fetchFromDolarApi(),
    ]);

    const dolarApiOficial = dolarApiList?.find((d) => d.fuente === "oficial");
    const dolarApiParalelo = dolarApiList?.find((d) => d.fuente === "paralelo");

    // Determine official rate
    let oficialRate: number;
    let oficialDate: string;
    let oficialDateText: string;
    let oficialSource: string;

    if (bcvDirect) {
      oficialRate = bcvDirect.usdRate;
      oficialDate = bcvDirect.date;
      oficialDateText = bcvDirect.dateText;
      oficialSource = "bcv-direct";
    } else if (
      dolarApiOficial?.promedio &&
      dolarApiOficial.promedio >= 1 &&
      dolarApiOficial.promedio <= 5000
    ) {
      oficialRate = dolarApiOficial.promedio;
      oficialDate = extractDate(dolarApiOficial.fechaActualizacion);
      oficialDateText = oficialDate;
      oficialSource = "dolarapi-oficial";
    } else {
      // If cached data exists even if expired, return it
      if (cachedRate) {
        return NextResponse.json(cachedRate.data);
      }
      return NextResponse.json(
        { error: "No se pudo obtener la tasa oficial del BCV" },
        { status: 502 },
      );
    }

    // Determine parallel rate (fallback to 1.15x official if DolarAPI is offline)
    let paraleloRate = oficialRate * 1.15;
    let paraleloDate = oficialDate;
    let paraleloSource = "estimated-fallback";

    if (
      dolarApiParalelo?.promedio &&
      dolarApiParalelo.promedio >= 1 &&
      dolarApiParalelo.promedio <= 10000
    ) {
      paraleloRate = dolarApiParalelo.promedio;
      paraleloDate = extractDate(dolarApiParalelo.fechaActualizacion);
      paraleloSource = "dolarapi-paralelo";
    }

    // Calculate spread
    const spreadAbsolute = paraleloRate - oficialRate;
    const spreadPercentage = (spreadAbsolute / oficialRate) * 100;

    const payload: RatePayload = {
      oficial: {
        rate: oficialRate,
        date: oficialDate,
        dateText: oficialDateText,
        source: oficialSource,
      },
      euro: bcvDirect?.eurRate
        ? {
            rate: bcvDirect.eurRate,
            date: bcvDirect.date,
            source: "bcv-direct",
          }
        : null,
      paralelo: {
        rate: paraleloRate,
        date: paraleloDate,
        source: paraleloSource,
      },
      spread: {
        absolute: Number(spreadAbsolute.toFixed(4)),
        percentage: Number(spreadPercentage.toFixed(2)),
      },
      timestamp: new Date().toISOString(),
    };

    cachedRate = {
      data: payload,
      expiresAt: now + CACHE_TTL_MS,
    };

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800",
      },
    });
  } catch (error) {
    if (cachedRate) {
      return NextResponse.json(cachedRate.data);
    }
    return NextResponse.json(
      {
        error: "Error interno al procesar tasa cambiaria",
        details: String(error),
      },
      { status: 502 },
    );
  }
}
