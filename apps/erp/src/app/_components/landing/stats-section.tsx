"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "framer-motion";

import { ScrollEntrance } from "./scroll-entrance";

const stats = [
  { value: 4, suffix: "h", label: "ahorradas por semana" },
  { value: 0, suffix: "", label: "errores de inventario", prefix: "" },
  { value: 50, suffix: "%", label: "más velocidad en pedidos", prefix: "+" },
  { value: 1, suffix: "min", label: "por pedido en promedio", prefix: "→" },
];

function CountUp({
  target,
  prefix = "",
  suffix = "",
  duration = 1200,
}: {
  target: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    if (target === 0) {
      setCount(0);
      return;
    }

    const startTime = performance.now();
    let rafId: number;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(target * eased));

      if (progress < 1) {
        rafId = requestAnimationFrame(animate);
      }
    };

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [isInView, target, duration]);

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      {count}
      {suffix}
    </span>
  );
}

export function StatsSection() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-7xl px-6">
        <ScrollEntrance>
          <h2 className="mx-auto max-w-2xl text-center font-serif text-[clamp(2rem,3.5vw,3rem)] leading-[1.15] tracking-[-0.01em]">
            Menos Excel. Más negocio.
          </h2>
          <p className="text-muted-foreground mx-auto mt-4 max-w-xl text-center">
            Resultados reales de negocios que usan Cendaro.
          </p>
        </ScrollEntrance>

        <div className="mx-auto mt-16 grid max-w-4xl grid-cols-2 gap-8 lg:grid-cols-4">
          {stats.map((stat, index) => (
            <ScrollEntrance key={stat.label} delay={index * 0.08}>
              <div className="text-center">
                <div className="text-[clamp(2.25rem,4vw,3.5rem)] leading-none font-bold tracking-[-0.03em]">
                  <CountUp
                    target={stat.value}
                    prefix={stat.prefix}
                    suffix={stat.suffix}
                  />
                </div>
                <div className="bg-primary/40 mx-auto mt-3 h-0.5 w-10 rounded-full" />
                <p className="text-muted-foreground mt-3 text-sm">
                  {stat.label}
                </p>
              </div>
            </ScrollEntrance>
          ))}
        </div>
      </div>
    </section>
  );
}
