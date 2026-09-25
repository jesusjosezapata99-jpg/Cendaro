"use client";

import { useState } from "react";

import { cn } from "@cendaro/ui";
import { AnimatedNumber } from "@cendaro/ui/animated-number";
import { StatusPill } from "@cendaro/ui/status-pill";

interface DemoProduct {
  name: string;
  usd: number;
}

interface DualCurrencyDemoProps {
  products: readonly DemoProduct[];
  /** Example rate (Bs per USD) — labelled as an example, never "today's". */
  rate: number;
  /** Variation above which Cendaro holds a new rate for approval (0.15). */
  holdRatio: number;
  holdLabel: string;
}

/** Simulated overnight jump (must stay above holdRatio to show the hold). */
const JUMP = 0.2;
const money = { minimumFractionDigits: 2, maximumFractionDigits: 2 } as const;

/**
 * Interactive dual-currency explainer (plan T4.5): a price lives in USD, the
 * bolívar amount follows the rate, and a jump above the hold threshold is
 * not applied until someone approves it (rate-sync.ts). No network calls.
 */
export function DualCurrencyDemo({
  products,
  rate,
  holdRatio,
  holdLabel,
}: DualCurrencyDemoProps) {
  const [productIndex, setProductIndex] = useState(0);
  const [qty, setQty] = useState(12);
  const [jumped, setJumped] = useState(false);

  const product = products[productIndex] ?? products[0];
  const totalUsd = (product?.usd ?? 0) * qty;
  const held = jumped && JUMP > holdRatio;
  const applied = jumped && !held ? rate * (1 + JUMP) : rate;

  return (
    <div className="border-border grid border lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="border-border flex flex-col gap-6 border-b p-6 md:p-8 lg:border-r lg:border-b-0">
        <fieldset>
          <legend className="text-muted-foreground font-mono text-xs tracking-[0.18em] uppercase">
            Producto
          </legend>
          <div className="mt-3 flex flex-col gap-2">
            {products.map((p, i) => (
              <label
                key={p.name}
                className={cn(
                  "border-border flex min-h-11 cursor-pointer items-center justify-between gap-3 border px-3 text-sm transition-colors duration-(--motion-micro)",
                  i === productIndex ? "bg-muted" : "hover:bg-muted",
                )}
              >
                <span className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="demo-producto"
                    checked={i === productIndex}
                    onChange={() => setProductIndex(i)}
                    className="accent-foreground"
                  />
                  {p.name}
                </span>
                <span className="font-mono tabular-nums">
                  USD {p.usd.toLocaleString("es-VE", money)}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <label
            htmlFor="demo-cantidad"
            className="text-muted-foreground font-mono text-xs tracking-[0.18em] uppercase"
          >
            Cantidad
          </label>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              aria-label="Restar una unidad"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="border-border hover:bg-muted size-11 border text-lg"
            >
              −
            </button>
            <input
              id="demo-cantidad"
              inputMode="numeric"
              value={qty}
              onChange={(e) => {
                const n = Number(e.target.value.replace(/\D/g, ""));
                setQty(Math.min(999, Math.max(1, n || 1)));
              }}
              className="border-border bg-background h-11 w-20 border text-center font-mono tabular-nums"
            />
            <button
              type="button"
              aria-label="Sumar una unidad"
              onClick={() => setQty((q) => Math.min(999, q + 1))}
              className="border-border hover:bg-muted size-11 border text-lg"
            >
              +
            </button>
          </div>
        </div>

        <div>
          <p
            id="demo-escenario"
            className="text-muted-foreground font-mono text-xs tracking-[0.18em] uppercase"
          >
            Tasa
          </p>
          <div
            role="radiogroup"
            aria-labelledby="demo-escenario"
            className="border-border mt-3 grid grid-cols-2 border"
          >
            {[
              { value: false, label: "Tasa del día" },
              { value: true, label: `Salto de ${Math.round(JUMP * 100)} %` },
            ].map((option) => (
              <button
                key={option.label}
                type="button"
                role="radio"
                aria-checked={jumped === option.value}
                onClick={() => setJumped(option.value)}
                className={cn(
                  "min-h-11 px-3 text-sm transition-colors duration-(--motion-micro)",
                  jumped === option.value
                    ? "bg-foreground text-background"
                    : "hover:bg-muted",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-card flex flex-col justify-between gap-8 p-6 md:p-8">
        <div>
          <p className="text-muted-foreground text-sm">Total en dólares</p>
          <p className="mt-1 font-mono text-4xl tabular-nums md:text-5xl">
            USD <AnimatedNumber value={totalUsd} format={money} />
          </p>
          <p className="text-muted-foreground mt-6 text-sm">
            Total en bolívares
          </p>
          <p className="mt-1 font-mono text-2xl tabular-nums md:text-3xl">
            Bs <AnimatedNumber value={totalUsd * applied} format={money} />
          </p>
        </div>

        <div aria-live="polite" className="border-border border-t pt-5 text-sm">
          {held ? (
            <div className="flex flex-col gap-2">
              <StatusPill tone="warning" className="self-start">
                Retenida para aprobación
              </StatusPill>
              <p className="text-muted-foreground leading-relaxed">
                La nueva tasa sube más de {holdLabel}: Cendaro sigue usando la
                última aprobada hasta que un responsable la revise.
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground leading-relaxed">
              Tasa de ejemplo:{" "}
              <span className="text-foreground font-mono tabular-nums">
                {rate.toLocaleString("es-VE", { maximumFractionDigits: 4 })}
              </span>{" "}
              Bs/USD. En Cendaro se usa la tasa BCV del día, sincronizada
              automáticamente.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
