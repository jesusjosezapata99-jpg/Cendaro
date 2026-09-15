"use client";

import { m } from "framer-motion";

import { ScrollEntrance, StaggerGroup, StaggerItem } from "./scroll-entrance";

const ease = [0.16, 1, 0.3, 1] as const;

const painPoints = [
  {
    label: "Conteo manual de inventario",
    metric: "45 min",
    sublabel: "por semana",
    description:
      "Contar stock a mano, anotar en cuadernos y cruzar con archivos de Excel.",
  },
  {
    label: "Pedidos por WhatsApp",
    metric: "2 horas",
    sublabel: "por semana",
    description:
      "Buscar precios, calcular totales, confirmar disponibilidad y responder uno a uno.",
  },
  {
    label: "Facturación y cobros",
    metric: "1–2 horas",
    sublabel: "por semana",
    description:
      "Crear facturas manualmente, perseguir cobros pendientes y cuadrar cuentas.",
  },
  {
    label: "Reportes y decisiones",
    metric: "1 hora",
    sublabel: "por semana",
    description:
      "Reunir datos de distintas fuentes y armar reportes para entender qué pasó.",
  },
];

export function ValueProps() {
  return (
    <section className="relative py-32">
      <div className="mx-auto max-w-7xl px-6">
        <ScrollEntrance>
          <h2 className="mx-auto max-w-2xl text-center font-serif text-[clamp(2rem,3.5vw,3rem)] leading-[1.12] tracking-[-0.02em]">
            Menos admin. Más negocio.
          </h2>
          <p className="text-muted-foreground mx-auto mt-4 max-w-xl text-center text-lg font-normal">
            Cendaro elimina el trabajo manual para que inviertas tu tiempo en lo
            que realmente importa.
          </p>
        </ScrollEntrance>

        {/* Pain-point cards (4 columns on desktop, 1px border) */}
        <StaggerGroup
          className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
          staggerDelay={0.08}
        >
          {painPoints.map((item) => (
            <StaggerItem key={item.label}>
              <div className="border-border bg-card hover:border-foreground/20 flex h-full flex-col border p-6 transition-colors duration-200">
                <span className="text-muted-foreground/60 text-xs font-medium tracking-wider uppercase">
                  {item.label}
                </span>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="text-foreground text-2xl font-medium tracking-tight tabular-nums">
                    {item.metric}
                  </span>
                  <span className="text-muted-foreground text-xs font-normal">
                    {item.sublabel}
                  </span>
                </div>
                <p className="text-muted-foreground/60 mt-3 text-sm leading-relaxed">
                  {item.description}
                </p>
              </div>
            </StaggerItem>
          ))}
        </StaggerGroup>

        {/* Summary card — 1px border treatment */}
        <ScrollEntrance delay={0.2}>
          <div className="border-border bg-card mt-4 border">
            <div className="flex flex-col items-center justify-between gap-8 p-8 md:flex-row md:gap-16 md:p-10">
              {/* Left: description */}
              <div className="max-w-md">
                <span className="text-muted-foreground/50 text-xs font-medium tracking-wider uppercase">
                  Cuando todo se acumula
                </span>
                <h3 className="text-foreground mt-2 text-xl leading-tight font-medium tracking-tight">
                  Lo que desaparece con Cendaro
                </h3>
                <p className="text-muted-foreground/60 mt-3 text-sm leading-relaxed">
                  Trabajo manual causado por herramientas desconectadas — Excel
                  para inventario, WhatsApp para pedidos, cuadernos para stock.
                  Cendaro centraliza todo en un sistema que se actualiza solo,
                  para que cada minuto se invierta en crecer tu negocio.
                </p>
              </div>

              {/* Right: big metric — SANS-SERIF tabular nums */}
              <m.div
                className="flex shrink-0 flex-col items-center md:items-end"
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, amount: 0.5 }}
                transition={{ duration: 0.8, ease }}
              >
                <span className="text-foreground font-mono text-[clamp(3.5rem,8vw,6rem)] leading-none font-normal tracking-tighter tabular-nums">
                  4–6
                </span>
                <span className="text-muted-foreground/60 mt-1 text-sm font-medium tracking-wide">
                  horas ahorradas por semana
                </span>
              </m.div>
            </div>
          </div>
        </ScrollEntrance>
      </div>
    </section>
  );
}
