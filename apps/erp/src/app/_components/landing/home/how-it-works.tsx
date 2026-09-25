import { siteUrl } from "~/lib/site-env";
import { STEPS } from "../content";
import { SampleDataNote } from "../mini/app-shell";
import { STEP_VIEWS } from "../mini/views";
import { SectionHeading } from "../primitives/section-heading";
import { HowItWorksClient } from "./how-it-works-client";

/** "Cómo funciona": the real flow of a distributor, in four steps (plan §6.1 #5). */
export function HowItWorks() {
  const views = STEPS.map((step) => {
    const View = STEP_VIEWS[step.id];
    return <View key={step.id} />;
  });

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
          <HowItWorksClient steps={STEPS} views={views} host={siteUrl.host} />
          <SampleDataNote className="mt-4 text-center lg:text-right" />
        </div>
      </div>
    </section>
  );
}
