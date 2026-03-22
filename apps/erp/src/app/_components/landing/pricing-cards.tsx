"use client";

import { useState } from "react";
import { Check } from "lucide-react";

import { ScrollEntrance } from "./scroll-entrance";

const plans = [
  {
    name: "Starter",
    description: "Para negocios que empiezan a organizar su gestión.",
    monthlyPrice: 0,
    annualPrice: 0,
    priceLabel: "Gratis",
    cta: "Empezar gratis",
    ctaVariant: "outline" as const,
    features: [
      "Hasta 500 productos",
      "1 usuario",
      "Inventario básico",
      "Pedidos manuales",
      "Soporte por email",
    ],
  },
  {
    name: "Pro",
    description: "Para negocios que necesitan automatización completa.",
    monthlyPrice: 29,
    annualPrice: 23,
    priceLabel: null,
    cta: "Empezar prueba Pro",
    ctaVariant: "default" as const,
    highlighted: true,
    features: [
      "Productos ilimitados",
      "Usuarios ilimitados",
      "Inventario avanzado + alertas",
      "Pedidos automáticos + WhatsApp",
      "Facturación y albaranes",
      "Analytics y reportes",
      "Categorización con IA",
      "Soporte prioritario",
    ],
  },
  {
    name: "Enterprise",
    description: "Para operaciones que necesitan personalización total.",
    monthlyPrice: 0,
    annualPrice: 0,
    priceLabel: "Personalizado",
    cta: "Contactar ventas",
    ctaVariant: "outline" as const,
    features: [
      "Todo lo de Pro",
      "Onboarding dedicado",
      "SLA garantizado",
      "Integraciones a medida",
      "Soporte 24/7 dedicado",
      "Facturación personalizada",
    ],
  },
];

export function PricingCards() {
  const [annual, setAnnual] = useState(false);

  return (
    <section className="py-24" id="pricing">
      <div className="mx-auto max-w-7xl px-6">
        <ScrollEntrance>
          <h2 className="mx-auto max-w-2xl text-center font-serif text-[clamp(2rem,3.5vw,3rem)] leading-[1.15] tracking-[-0.01em]">
            Precios que escalan con tu negocio
          </h2>
          <p className="text-muted-foreground mx-auto mt-4 max-w-xl text-center">
            Empieza gratis, crece sin límites.
          </p>
        </ScrollEntrance>

        {/* Toggle */}
        <ScrollEntrance delay={0.1}>
          <div className="mt-10 flex items-center justify-center gap-3">
            <span
              className={`text-sm transition-colors ${!annual ? "text-foreground font-medium" : "text-muted-foreground"}`}
            >
              Mensual
            </span>
            <button
              type="button"
              className="bg-muted relative h-7 w-12 cursor-pointer rounded-full transition-colors"
              onClick={() => setAnnual(!annual)}
              aria-label={`Cambiar a plan ${annual ? "mensual" : "anual"}`}
            >
              <div
                className={`bg-foreground absolute top-0.5 left-0.5 h-6 w-6 rounded-full transition-transform duration-200 ${
                  annual ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
            <span
              className={`text-sm transition-colors ${annual ? "text-foreground font-medium" : "text-muted-foreground"}`}
            >
              Anual
            </span>
            {annual && (
              <span className="bg-primary/10 text-primary rounded-full px-2.5 py-0.5 text-xs font-medium">
                Ahorra 20%
              </span>
            )}
          </div>
        </ScrollEntrance>

        {/* Cards */}
        <div className="mx-auto mt-12 grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-3">
          {plans.map((plan, index) => (
            <ScrollEntrance key={plan.name} delay={index * 0.1}>
              <div
                className={`flex h-full flex-col rounded-(--radius-card) border p-8 transition-colors ${
                  plan.highlighted
                    ? "border-primary bg-card ring-primary/20 ring-1"
                    : "border-border bg-card"
                }`}
              >
                <h3 className="text-lg font-semibold">{plan.name}</h3>
                <p className="text-muted-foreground mt-1 text-sm">
                  {plan.description}
                </p>

                <div className="mt-6">
                  {plan.priceLabel ? (
                    <span className="text-4xl font-bold tabular-nums">
                      {plan.priceLabel}
                    </span>
                  ) : (
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold tabular-nums">
                        ${annual ? plan.annualPrice : plan.monthlyPrice}
                      </span>
                      <span className="text-muted-foreground">/mes</span>
                    </div>
                  )}
                </div>

                <ul className="mt-8 flex-1 space-y-3">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2.5 text-sm"
                    >
                      <Check className="text-primary mt-0.5 h-4 w-4 shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <a
                  href="/login"
                  className={`mt-8 block w-full cursor-pointer rounded-lg py-3 text-center text-sm font-medium transition-all duration-200 active:scale-[0.97] ${
                    plan.ctaVariant === "default"
                      ? "bg-foreground text-background hover:opacity-90"
                      : "border-border text-foreground hover:bg-muted border bg-transparent"
                  }`}
                >
                  {plan.cta}
                </a>
              </div>
            </ScrollEntrance>
          ))}
        </div>
      </div>
    </section>
  );
}
