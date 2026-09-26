import { OFFER, PLANS } from "../content";
import { Reveal } from "../primitives/reveal";
import { SectionHeading } from "../primitives/section-heading";
import { PlansClient } from "./plans-client";

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

        <PlansClient plans={PLANS} />

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
