"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

const ease = [0.16, 1, 0.3, 1] as const;

export function Hero() {
  return (
    <section className="relative flex min-h-[90vh] flex-col items-center justify-center overflow-hidden px-6 pt-32 pb-24 text-center">
      {/* Background glow */}
      <div
        className="bg-primary/15 pointer-events-none absolute top-1/2 left-1/2 -z-10 h-[500px] w-[700px] -translate-x-1/2 -translate-y-1/3 rounded-full blur-[140px]"
        aria-hidden="true"
      />

      {/* Trust badge */}
      <motion.div
        className="border-primary/20 bg-primary/5 mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-1.5"
        initial={{ opacity: 0, y: 16, filter: "blur(10px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.6, ease, delay: 0 }}
      >
        <span className="relative flex h-2 w-2">
          <span className="bg-primary absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
          <span className="bg-primary relative inline-flex h-2 w-2 rounded-full" />
        </span>
        <span className="text-primary text-xs font-medium">
          Nuevo — Categorización con IA
        </span>
      </motion.div>

      {/* Headline */}
      <motion.h1
        className="text-foreground mx-auto max-w-4xl font-serif text-[clamp(2.5rem,5vw,4.5rem)] leading-[1.1] tracking-[-0.02em]"
        initial={{ opacity: 0, y: 24, filter: "blur(10px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.6, ease, delay: 0.1 }}
      >
        Gestión inteligente para negocios que crecen
      </motion.h1>

      {/* Subtitle */}
      <motion.p
        className="text-muted-foreground mx-auto mt-6 max-w-xl text-lg"
        initial={{ opacity: 0, y: 24, filter: "blur(10px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.6, ease, delay: 0.2 }}
      >
        Inventario, pedidos, catálogo y facturación en un solo lugar. Sin Excel.
        Sin complicaciones. Todo automatizado.
      </motion.p>

      {/* CTAs */}
      <motion.div
        className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:gap-3"
        initial={{ opacity: 0, y: 24, filter: "blur(10px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.6, ease, delay: 0.3 }}
      >
        <a
          href="/login"
          className="group bg-foreground text-background inline-flex cursor-pointer items-center gap-2 rounded-lg px-8 py-3 text-base font-medium transition-all duration-200 hover:opacity-90 active:scale-[0.97]"
        >
          Empezar gratis
          <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
        </a>
        <a
          href="#features"
          className="border-border text-foreground hover:bg-muted inline-flex cursor-pointer items-center gap-2 rounded-lg border px-6 py-3 text-base font-medium transition-all duration-200 active:scale-[0.97]"
        >
          Ver funciones
        </a>
      </motion.div>
      <motion.span
        className="text-muted-foreground mt-3 text-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, ease, delay: 0.45 }}
      >
        14 días gratis · Cancela cuando quieras
      </motion.span>

      {/* Product screenshot */}
      <motion.div
        className="relative mx-auto mt-16 w-full max-w-5xl"
        initial={{ opacity: 0, y: 40, filter: "blur(10px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.8, ease, delay: 0.35 }}
      >
        {/* Glow behind the screenshot */}
        <div
          className="bg-primary/10 pointer-events-none absolute -inset-4 -z-10 rounded-3xl blur-[60px]"
          aria-hidden="true"
        />
        <div className="border-border bg-card transform-[perspective(1200px)_rotateX(2deg)] overflow-hidden rounded-xl border shadow-2xl">
          {/* Placeholder for actual product screenshot — a realistic dashboard preview */}
          <div className="from-card to-muted relative aspect-16/10 w-full bg-linear-to-br">
            {/* Mock dashboard layout */}
            <div className="absolute inset-0 p-6">
              {/* Top bar */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/20 h-8 w-8 rounded-lg" />
                  <div className="bg-muted-foreground/10 h-4 w-24 rounded" />
                </div>
                <div className="flex gap-2">
                  <div className="bg-muted-foreground/10 h-8 w-20 rounded-lg" />
                  <div className="bg-muted-foreground/10 h-8 w-8 rounded-full" />
                </div>
              </div>

              {/* Content grid */}
              <div className="mt-6 grid grid-cols-4 gap-4">
                {/* Stat cards */}
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="border-border/50 bg-background/50 rounded-xl border p-4"
                  >
                    <div className="bg-muted-foreground/10 h-3 w-12 rounded" />
                    <div className="bg-primary/20 mt-3 h-6 w-16 rounded" />
                    <div className="bg-muted-foreground/5 mt-2 h-2 w-20 rounded" />
                  </div>
                ))}
              </div>

              {/* Chart area */}
              <div className="mt-4 grid grid-cols-3 gap-4">
                <div className="border-border/50 bg-background/50 col-span-2 rounded-xl border p-4">
                  <div className="bg-muted-foreground/10 h-3 w-20 rounded" />
                  <div className="mt-4 flex items-end gap-1">
                    {[40, 65, 45, 80, 55, 90, 70, 85, 60, 95, 75, 88].map(
                      (h, i) => (
                        <div
                          key={i}
                          className="bg-primary/20 flex-1 rounded-t"
                          style={{ height: `${h}%`, maxHeight: "120px" }}
                        />
                      ),
                    )}
                  </div>
                </div>
                <div className="border-border/50 bg-background/50 rounded-xl border p-4">
                  <div className="bg-muted-foreground/10 h-3 w-16 rounded" />
                  <div className="mt-4 space-y-3">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="bg-primary/30 h-3 w-3 rounded-full" />
                        <div className="bg-muted-foreground/10 h-2 flex-1 rounded" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
