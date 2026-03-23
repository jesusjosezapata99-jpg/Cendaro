"use client";

import { Star } from "lucide-react";

import { ScrollEntrance, StaggerGroup, StaggerItem } from "./scroll-entrance";

const testimonials = [
  {
    name: "María García",
    role: "Directora de Operaciones",
    company: "FreshMart",
    quote:
      "Antes perdíamos horas cuadrando inventario con Excel. Cendaro nos devolvió ese tiempo y eliminó los errores por completo.",
    initials: "MG",
    color: "bg-emerald-500/20 text-emerald-400",
  },
  {
    name: "Carlos Ruiz",
    role: "Fundador",
    company: "TechSupply.io",
    quote:
      "El flujo de pedidos automatizado con notificaciones por WhatsApp transformó nuestra logística. Nuestros clientes notan la diferencia.",
    initials: "CR",
    color: "bg-blue-500/20 text-blue-400",
  },
  {
    name: "Laura Martínez",
    role: "CEO",
    company: "Artesanías Luna",
    quote:
      "La categorización con IA me ahorra horas cada semana. Importo el catálogo desde Excel y Cendaro hace el resto.",
    initials: "LM",
    color: "bg-amber-500/20 text-amber-400",
  },
];

function Stars() {
  return (
    <div className="flex gap-0.5" aria-label="5 de 5 estrellas">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className="h-3.5 w-3.5 fill-amber-400 text-amber-400"
          strokeWidth={0}
        />
      ))}
    </div>
  );
}

export function Testimonials() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-7xl px-6">
        <ScrollEntrance>
          <h2 className="mx-auto max-w-2xl text-center font-serif text-[clamp(2rem,3.5vw,3rem)] leading-[1.15] tracking-[-0.01em]">
            Lo que dicen nuestros usuarios
          </h2>
          <p className="text-muted-foreground mx-auto mt-4 max-w-xl text-center">
            Negocios reales que transformaron su gestión con Cendaro.
          </p>
        </ScrollEntrance>

        <StaggerGroup
          className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-3"
          staggerDelay={0.1}
        >
          {testimonials.map((t) => (
            <StaggerItem key={t.name}>
              <div className="group border-border bg-card hover:border-muted-foreground/30 hover:shadow-primary/5 flex h-full flex-col rounded-(--radius-card) border p-6 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
                {/* Stars */}
                <Stars />

                {/* Quote */}
                <blockquote className="text-muted-foreground mt-4 flex-1 text-sm leading-relaxed">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>

                {/* Author */}
                <div className="border-border mt-6 flex items-center gap-3 border-t pt-4">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold ${t.color}`}
                  >
                    {t.initials}
                  </div>
                  <div>
                    <p className="text-foreground text-sm font-medium">
                      {t.name}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {t.role}, {t.company}
                    </p>
                  </div>
                </div>
              </div>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </div>
    </section>
  );
}
