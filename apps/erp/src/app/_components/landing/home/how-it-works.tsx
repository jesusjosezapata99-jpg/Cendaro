import type { StepId } from "../content";
import { siteUrl } from "~/lib/site-env";
import { CLIP_LABELS, STEPS } from "../content";
import { MEDIA } from "../media";
import { SampleDataNote } from "../mini/app-shell";
import { SectionHeading } from "../primitives/section-heading";
import { HowItWorksClient } from "./how-it-works-client";

/** Recording that shows each step of the flow. */
const STEP_CLIP = {
  catalogo: "flow-catalog-import",
  importacion: "flow-container-ai",
  venta: "flow-orders-sale",
  cobranza: "flow-receivables-close",
} as const satisfies Record<StepId, keyof typeof CLIP_LABELS>;

/** "Cómo funciona": the real flow of a distributor, in four steps (plan §6.1 #5). */
export function HowItWorks() {
  const clips = STEPS.map((step) => ({
    clip: MEDIA[STEP_CLIP[step.id]],
    label: CLIP_LABELS[STEP_CLIP[step.id]],
  }));

  return (
    <section
      id="como-funciona"
      aria-labelledby="como-funciona-title"
      className="scroll-mt-20 py-16 md:py-32"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading
          id="como-funciona-title"
          eyebrow={{ index: "01", label: "Cómo funciona" }}
          title="Del contenedor al cierre de caja, sin hojas de cálculo"
          description="Así trabaja una distribuidora en Cendaro: cada paso deja los datos listos para el siguiente."
        />
        <div className="mt-10 md:mt-16">
          <HowItWorksClient steps={STEPS} clips={clips} host={siteUrl.host} />
          <SampleDataNote className="mt-4 text-center lg:text-right" />
        </div>
      </div>
    </section>
  );
}
