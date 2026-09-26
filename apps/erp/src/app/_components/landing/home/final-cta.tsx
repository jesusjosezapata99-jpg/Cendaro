import { FINAL_CTA } from "../content";
import { CtaButtons } from "../primitives/cta-buttons";
import { GrainBackdrop } from "../primitives/grain-backdrop";
import { Reveal } from "../primitives/reveal";

/**
 * Closing call to action on a token surface — not inverted (fixes U3).
 * `context` is sent in the prefilled request message (which page it came from).
 */
export function FinalCta({
  context = "Cierre de la página",
}: {
  context?: string;
}) {
  return (
    <section
      aria-labelledby="cta-final-title"
      className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 md:pb-24"
    >
      <GrainBackdrop className="border-border border">
        <Reveal className="flex flex-col items-center px-6 py-16 text-center md:py-28">
          <h2
            id="cta-final-title"
            className="font-serif text-[clamp(2.25rem,5vw,4rem)] leading-[1.05] tracking-[-0.02em] text-balance"
          >
            {FINAL_CTA.title}
          </h2>
          <p className="text-muted-foreground mt-5 max-w-xl text-lg leading-relaxed text-pretty">
            {FINAL_CTA.lead}
          </p>
          <CtaButtons
            context={context}
            showEmailHint
            className="mt-9 w-full sm:w-auto"
          />
        </Reveal>
      </GrainBackdrop>
    </section>
  );
}
