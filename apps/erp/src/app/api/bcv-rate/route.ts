import { NextResponse } from "next/server";

/**
 * Server-side proxy for Venezuelan exchange rates via DolarAPI.com.
 *
 * Source: https://ve.dolarapi.com (MIT, no API key, no rate limits)
 *
 * Single endpoint returns both official (BCV) and parallel (USDT) rates.
 * ISR-cached for 1 hour on the server.
 *
 * Response shape:
 *   { oficial: { rate, date, source }, paralelo: { rate, date, source } }
 */

interface DolarApiItem {
  fuente: "oficial" | "paralelo";
  nombre: string;
  compra: number | null;
  venta: number | null;
  promedio: number;
  fechaActualizacion: string;
}

function extractDate(iso: string): string {
  return iso.split("T")[0] ?? new Date().toISOString().slice(0, 10);
}

export async function GET() {
  try {
    const res = await fetch("https://ve.dolarapi.com/v1/dolares", {
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 3600 }, // ISR cache 1h
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "DolarAPI returned non-OK status" },
        { status: 502 },
      );
    }

    const data = (await res.json()) as DolarApiItem[];

    const oficial = data.find((d) => d.fuente === "oficial");
    const paralelo = data.find((d) => d.fuente === "paralelo");

    // Sanity bounds: oficial 1–1000, paralelo 1–2000
    if (!oficial?.promedio || oficial.promedio < 1 || oficial.promedio > 1000) {
      return NextResponse.json(
        { error: "Official rate out of sanity bounds" },
        { status: 502 },
      );
    }

    if (
      !paralelo?.promedio ||
      paralelo.promedio < 1 ||
      paralelo.promedio > 2000
    ) {
      return NextResponse.json(
        { error: "Parallel rate out of sanity bounds" },
        { status: 502 },
      );
    }

    return NextResponse.json({
      oficial: {
        rate: oficial.promedio,
        date: extractDate(oficial.fechaActualizacion),
        source: "dolarapi-oficial",
      },
      paralelo: {
        rate: paralelo.promedio,
        date: extractDate(paralelo.fechaActualizacion),
        source: "dolarapi-paralelo",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "DolarAPI unavailable" },
      { status: 502 },
    );
  }
}
