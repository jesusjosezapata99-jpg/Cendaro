import { cn } from "@cendaro/ui";
import { Icons } from "@cendaro/ui/icons";

import { OFFER, PLANS } from "../content";
import { CtaButtons } from "../primitives/cta-buttons";
import { Reveal } from "../primitives/reveal";
import { SectionHeading } from "../primitives/section-heading";

/**
 * Plans without public prices (decision D2) plus the acquisition offer the
 * owner delegated (user:2026-09-25). Every CTA names its plan in the
 * prefilled WhatsApp message.
 */
export function PlansSection() {
  return (
    <section
      id="planes"
      aria-labelledby="planes-title"
      className="border-border scroll-mt-20 border-t py-16 md:py-32"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading
          id="planes-title"
          eyebrow={{ index: "06", label: "Planes" }}
          title="Empieza por lo que necesitas hoy"
          description="Cada empresa se activa acompañada. Cuéntanos cómo trabajas y te proponemos el plan y el precio que encajan con tu operación."
        />

        <ul className="border-border mt-12 grid border-t border-l md:mt-16 lg:grid-cols-3">
          {PLANS.map((plan, i) => (
            <Reveal
              as="li"
              key={plan.id}
              delay={i * 60}
              className={cn(
                "border-border flex flex-col border-r border-b p-6 md:p-8",
                plan.recommended && "bg-card",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-serif text-2xl">{plan.name}</h3>
                {plan.recommended ? (
                  <span className="border-foreground rounded-full border px-3 py-1 text-xs">
                    Recomendado
                  </span>
                ) : null}
              </div>
              <p className="text-muted-foreground mt-3 leading-relaxed">
                {plan.audience}
              </p>
              <ul className="mt-6 flex flex-1 flex-col gap-3 text-sm">
                {plan.highlights.map((h) => (
                  <li key={h} className="flex gap-3">
                    <Icons.Check className="mt-0.5 size-4 shrink-0" />
                    {h}
                  </li>
                ))}
              </ul>
              <p className="border-border mt-6 border-t pt-4 text-sm">
                <span className="text-muted-foreground">
                  Puesta en marcha:{" "}
                </span>
                {plan.onboarding}
              </p>
              <CtaButtons
                context={`Plan ${plan.name}`}
                showLogin={false}
                block
                className="mt-6"
              />
            </Reveal>
          ))}
        </ul>

        <ul className="mt-10 grid grid-cols-2 gap-6 md:mt-12 md:gap-8 lg:grid-cols-4">
          {OFFER.map((item, i) => (
            <Reveal as="li" key={item.title} variant="fade" delay={i * 50}>
              <p className="font-medium">{item.title}</p>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                {item.body}
              </p>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
