"use client";

import type { LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Package, ShoppingCart } from "lucide-react";

import { ScrollEntrance } from "./scroll-entrance";

interface StickyFeature {
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
  mockupLabel: string;
  mockupColor: string;
}

const features: StickyFeature[] = [
  {
    id: "inventory",
    icon: Package,
    title: "Inventario siempre al día",
    description:
      "Control en tiempo real de stock, movimientos y alertas automáticas. Cero sorpresas, cero rupturas de stock.",
    mockupLabel: "Inventario",
    mockupColor: "bg-emerald-500/20",
  },
  {
    id: "orders",
    icon: ShoppingCart,
    title: "Pedidos sin fricción",
    description:
      "Desde la creación hasta la entrega, automatiza el flujo completo. Notificaciones por WhatsApp incluidas.",
    mockupLabel: "Pedidos",
    mockupColor: "bg-blue-500/20",
  },
  {
    id: "catalog",
    icon: BookOpen,
    title: "Catálogo inteligente",
    description:
      "Organiza productos, precios y márgenes. Importa desde Excel en segundos con validación automática.",
    mockupLabel: "Catálogo",
    mockupColor: "bg-amber-500/20",
  },
];

export function StickyFeatures() {
  const [activeIndex, setActiveIndex] = useState(0);
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);

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

  return (
    <section className="py-24" id="features">
      <div className="mx-auto max-w-7xl px-6">
        <ScrollEntrance>
          <h2 className="mx-auto max-w-2xl text-center font-serif text-[clamp(2rem,3.5vw,3rem)] leading-[1.15] tracking-[-0.01em]">
            Todo lo que necesitas, nada que sobre
          </h2>
        </ScrollEntrance>

        {/* Desktop: sticky layout */}
        <div className="mt-20 hidden lg:grid lg:grid-cols-2 lg:gap-16">
          {/* Left: scrolling text */}
          <div>
            {features.map((feature, index) => (
              <div
                key={feature.id}
                ref={(el) => {
                  sectionRefs.current[index] = el;
                }}
                className="flex min-h-[60vh] flex-col justify-center"
              >
                <div
                  className={`transition-opacity duration-500 ${
                    activeIndex === index ? "opacity-100" : "opacity-30"
                  }`}
                >
                  <feature.icon
                    className="text-primary h-8 w-8"
                    strokeWidth={1.5}
                  />
                  <h3 className="mt-4 text-2xl font-semibold tracking-tight">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground mt-3 max-w-md leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Right: sticky mockup */}
          <div className="relative">
            <div className="sticky top-24 flex items-center justify-center py-8">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeIndex}
                  className="border-border bg-card w-full overflow-hidden rounded-xl border"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                >
                  {/* Mock screen */}
                  <div className="aspect-4/3 p-6">
                    {/* Top bar */}
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-8 w-8 rounded-lg ${features[activeIndex]?.mockupColor ?? "bg-muted"}`}
                      />
                      <span className="text-foreground text-sm font-medium">
                        {features[activeIndex]?.mockupLabel}
                      </span>
                    </div>
                    {/* Content rows */}
                    <div className="mt-6 space-y-3">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div
                          key={i}
                          className="border-border/50 bg-background/50 flex items-center gap-3 rounded-lg border p-3"
                        >
                          <div
                            className={`h-6 w-6 rounded ${features[activeIndex]?.mockupColor ?? "bg-muted"}`}
                          />
                          <div className="flex-1 space-y-1">
                            <div
                              className="bg-muted-foreground/10 h-2.5 rounded"
                              style={{ width: `${60 + i * 5}%` }}
                            />
                            <div className="bg-muted-foreground/5 h-2 w-16 rounded" />
                          </div>
                          <div className="bg-muted-foreground/10 h-3 w-12 rounded" />
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Mobile: stacked cards */}
        <div className="mt-12 space-y-8 lg:hidden">
          {features.map((feature, index) => (
            <ScrollEntrance key={feature.id} delay={index * 0.08}>
              <div className="border-border bg-card rounded-(--radius-card) border p-6">
                <feature.icon
                  className="text-primary h-6 w-6"
                  strokeWidth={1.5}
                />
                <h3 className="mt-3 text-lg font-semibold">{feature.title}</h3>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </ScrollEntrance>
          ))}
        </div>
      </div>
    </section>
  );
}
