"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";

import { NoiseOverlay } from "./noise-overlay";
import { ScrollVideo } from "./scroll-video";

const ease = [0.16, 1, 0.3, 1] as const;

export function Hero() {
  const reduced = useReducedMotion();

  return (
    <section className="relative flex min-h-[90vh] flex-col items-center justify-center overflow-hidden px-6 pt-32 pb-24 text-center">
      {/* Noise texture */}
      <NoiseOverlay />

      {/* Background glow — center */}
      <div
        className="bg-primary/12 pointer-events-none absolute top-1/2 left-1/2 -z-10 h-[500px] w-[700px] -translate-x-1/2 -translate-y-1/3 rounded-full blur-[140px]"
        aria-hidden="true"
      />

      {/* Edge vignettes — left & right (like midday) */}
      <div
        className="pointer-events-none absolute top-0 left-0 -z-10 h-full w-[400px] bg-linear-to-r from-blue-600/6 to-transparent"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute top-0 right-0 -z-10 h-full w-[400px] bg-linear-to-l from-blue-600/6 to-transparent"
        aria-hidden="true"
      />

      {/* Trust badge */}
      <motion.div
        className="border-primary/20 bg-primary/5 mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-1.5"
        initial={{ opacity: 0, y: 16, filter: "blur(10px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.7, ease, delay: 0 }}
      >
        <span className="relative flex h-2 w-2">
          <span className="bg-primary absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
          <span className="bg-primary relative inline-flex h-2 w-2 rounded-full" />
        </span>
        <span className="text-primary text-xs font-medium">
          Nuevo — Categorización con IA
        </span>
      </motion.div>

      {/* Headline — tighter tracking like midday (-0.02em) */}
      <motion.h1
        className="text-foreground mx-auto max-w-4xl font-serif text-[clamp(2.5rem,5vw,4.5rem)] leading-[1.08] tracking-[-0.02em]"
        initial={{ opacity: 0, y: 24, filter: "blur(10px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.7, ease, delay: 0.15 }}
      >
        Gestión inteligente para negocios que crecen
      </motion.h1>

      {/* Subtitle */}
      <motion.p
        className="text-muted-foreground mx-auto mt-6 max-w-xl text-lg"
        initial={{ opacity: 0, y: 24, filter: "blur(10px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.7, ease, delay: 0.3 }}
      >
        Inventario, pedidos, catálogo y facturación en un solo lugar. Sin Excel.
        Sin complicaciones. Todo automatizado.
      </motion.p>

      {/* CTAs */}
      <motion.div
        className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:gap-3"
        initial={{ opacity: 0, y: 24, filter: "blur(10px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.7, ease, delay: 0.45 }}
      >
        <a
          href="/login"
          className="group bg-foreground text-background inline-flex cursor-pointer items-center gap-2 px-8 py-3 text-base font-medium transition-all duration-200 hover:opacity-90 active:scale-[0.97]"
        >
          Empezar gratis
          <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
        </a>
        <a
          href="#features"
          className="border-border text-foreground hover:bg-muted inline-flex cursor-pointer items-center gap-2 border px-6 py-3 text-base font-medium transition-all duration-200 active:scale-[0.97]"
        >
          Ver funciones
        </a>
      </motion.div>
      <motion.span
        className="text-muted-foreground mt-3 text-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.7, ease, delay: 0.6 }}
      >
        14 días gratis · Cancela cuando quieras
      </motion.span>

      {/* ── Video demo — flat, enterprise treatment ── */}
      <motion.div
        className="relative mx-auto mt-16 w-full max-w-5xl"
        initial={
          reduced ? { opacity: 0 } : { opacity: 0, y: 40, filter: "blur(10px)" }
        }
        animate={
          reduced ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" }
        }
        transition={{ duration: 0.9, ease, delay: 0.5 }}
      >
        {/* Glow behind the card — softer, diffused */}
        <div
          className="bg-primary/8 pointer-events-none absolute -inset-12 -z-10 rounded-3xl blur-[100px]"
          aria-hidden="true"
        />

        <div className="overflow-hidden rounded-xl border border-[rgba(255,255,255,0.08)]">
          <ScrollVideo
            src="/videos/hero-dashboard.mp4"
            eager
            className="rounded-xl"
          />
        </div>
      </motion.div>
    </section>
  );
}
