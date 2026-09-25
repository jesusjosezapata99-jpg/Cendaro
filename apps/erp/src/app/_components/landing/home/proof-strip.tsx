import { PROOF } from "../content";
import { Reveal } from "../primitives/reveal";

/** Verifiable facts from the code (plan §6.1 #4) — replaces invented stats. */
export function ProofStrip() {
  return (
    <section aria-label="Cendaro en cifras" className="border-border border-y">
      <dl className="mx-auto grid max-w-7xl grid-cols-2 lg:grid-cols-4">
        {PROOF.map((item, i) => (
          <Reveal
            key={item.label}
            variant="fade"
            delay={i * 60}
            className="border-border flex flex-col gap-1 px-4 py-6 odd:border-r max-lg:nth-[-n+2]:border-b sm:px-6 md:py-8 lg:border-r lg:last:border-r-0"
          >
            <dt className="text-muted-foreground order-2 text-sm">
              {item.label}
            </dt>
            <dd className="order-1 font-mono text-2xl tabular-nums md:text-3xl">
              {item.value}
            </dd>
          </Reveal>
        ))}
      </dl>
    </section>
  );
}
