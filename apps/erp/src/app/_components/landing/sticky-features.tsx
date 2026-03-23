"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { NoiseOverlay } from "./noise-overlay";
import { ScrollEntrance } from "./scroll-entrance";
import { ScrollVideo } from "./scroll-video";

/* ── Easing + animation tokens ── */
const ease = [0.16, 1, 0.3, 1] as const;

/* ── Feature data ── */
interface StickyFeature {
  id: string;
  title: string;
  description: string;
  video: string;
}

const features: StickyFeature[] = [
  {
    id: "inventory",
    title: "Inventario siempre al día",
    description:
      "Control en tiempo real de stock, movimientos y alertas automáticas de bajo inventario. Sin rupturas de stock, sin sorpresas.",
    video: "/videos/inventory-flow.mp4",
  },
  {
    id: "orders",
    title: "Pedidos sin fricción",
    description:
      "Desde la creación hasta la entrega, automatiza el flujo completo. Notificaciones automáticas por WhatsApp incluidas.",
    video: "/videos/orders-flow.mp4",
  },
  {
    id: "catalog",
    title: "Catálogo inteligente",
    description:
      "Organiza productos, precios y márgenes. Importa desde Excel en segundos con validación automática.",
    video: "/videos/catalog-flow.mp4",
  },
  {
    id: "analytics",
    title: "Reportes que se entienden",
    description:
      "Ventas, márgenes y facturas en un solo lugar. Exporta reportes o deja que Cendaro te muestre lo que importa.",
    video: "/videos/analytics-flow.mp4",
  },
  {
    id: "dashboard",
    title: "Panel de control centralizado",
    description:
      "KPIs, alertas y acciones rápidas desde el momento que abres Cendaro. Todo tu negocio en una sola pantalla.",
    video: "/videos/hero-dashboard.mp4",
  },
];

/* ── Indicator dot component ── */
function IndicatorDot({
  isActive,
  onClick,
  label,
}: {
  isActive: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Ir a: ${label}`}
      className="group relative flex items-center justify-center"
      style={{ width: 16, height: 16 }}
    >
      <motion.span
        className="block rounded-[1px]"
        animate={{
          width: isActive ? 8 : 5,
          height: isActive ? 8 : 5,
          backgroundColor: isActive
            ? "rgba(255,255,255,0.9)"
            : "rgba(255,255,255,0.2)",
        }}
        transition={{ duration: 0.35, ease }}
      />
    </button>
  );
}

export function StickyFeatures() {
  const [activeIndex, setActiveIndex] = useState(0);
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);

  /* Scroll-driven active index */
  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    sectionRefs.current.forEach((ref, index) => {
      if (!ref) return;
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting) {
            setActiveIndex(index);
          }
        },
        { threshold: 0.5, rootMargin: "-20% 0px -20% 0px" },
      );
      observer.observe(ref);
      observers.push(observer);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, []);

  /* Click-to-scroll handler */
  const scrollToFeature = useCallback((index: number) => {
    const el = sectionRefs.current[index];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);

  return (
    <section className="relative py-32" id="features">
      <NoiseOverlay opacity={0.025} />
      <div className="mx-auto max-w-7xl px-6">
        {/* Section heading */}
        <ScrollEntrance>
          <span className="text-muted-foreground/50 mb-3 block text-center text-xs font-medium tracking-[0.2em] uppercase">
            Cómo funciona
          </span>
          <h2 className="mx-auto max-w-2xl text-center font-serif text-[clamp(2rem,3.5vw,3rem)] leading-[1.15] tracking-[-0.01em]">
            Todo lo que necesitas, nada que sobre
          </h2>
        </ScrollEntrance>

        {/* Desktop: sticky layout */}
        <div className="mt-20 hidden lg:grid lg:grid-cols-[1fr_1.15fr] lg:gap-16">
          {/* Left: indicator line + scrolling text */}
          <div className="relative">
            {/* Vertical indicator line */}
            <div
              className="absolute top-0 left-[7px] h-full w-px"
              style={{ background: "rgba(255,255,255,0.08)" }}
            />

            {features.map((feature, index) => (
              <div
                key={feature.id}
                ref={(el) => {
                  sectionRefs.current[index] = el;
                }}
                className="flex min-h-[55vh] items-start gap-6 py-4"
                style={{ paddingTop: index === 0 ? "12vh" : undefined }}
              >
                {/* Indicator dot */}
                <div className="relative z-10 mt-[6px] shrink-0">
                  <IndicatorDot
                    isActive={activeIndex === index}
                    onClick={() => scrollToFeature(index)}
                    label={feature.title}
                  />
                </div>

                {/* Feature text */}
                <div className="flex flex-col justify-center">
                  <motion.h3
                    className="cursor-pointer font-serif text-[1.5rem] leading-tight tracking-[-0.01em]"
                    animate={{
                      opacity: activeIndex === index ? 1 : 0.2,
                    }}
                    transition={{ duration: 0.4, ease }}
                    onClick={() => scrollToFeature(index)}
                  >
                    {feature.title}
                  </motion.h3>

                  {/* Expandable description */}
                  <motion.div
                    className="overflow-hidden"
                    animate={{
                      height: activeIndex === index ? "auto" : 0,
                      opacity: activeIndex === index ? 1 : 0,
                    }}
                    initial={false}
                    transition={{ duration: 0.4, ease }}
                  >
                    <p className="text-muted-foreground/60 mt-3 max-w-md text-[0.95rem] leading-relaxed">
                      {feature.description}
                    </p>
                  </motion.div>
                </div>
              </div>
            ))}
          </div>

          {/* Right: sticky video */}
          <div className="relative">
            <div className="sticky top-20 flex items-center justify-center py-8">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeIndex}
                  className="w-full overflow-hidden rounded-xl border border-[rgba(255,255,255,0.08)]"
                  initial={{ opacity: 0, scale: 0.98, filter: "blur(4px)" }}
                  animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                  exit={{ opacity: 0, scale: 0.98, filter: "blur(4px)" }}
                  transition={{ duration: 0.4, ease }}
                >
                  <ScrollVideo
                    src={
                      features[activeIndex]?.video ??
                      "/videos/inventory-flow.mp4"
                    }
                    className="rounded-xl"
                  />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Mobile: stacked cards with videos */}
        <div className="mt-12 space-y-8 lg:hidden">
          {features.map((feature, index) => (
            <ScrollEntrance key={feature.id} delay={index * 0.08}>
              <div className="overflow-hidden rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)]">
                <div className="p-6">
                  <h3 className="font-serif text-lg font-semibold tracking-tight">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground/60 mt-2 text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </div>
                <ScrollVideo
                  src={feature.video}
                  className="border-t border-[rgba(255,255,255,0.06)]"
                />
              </div>
            </ScrollEntrance>
          ))}
        </div>
      </div>
    </section>
  );
}
