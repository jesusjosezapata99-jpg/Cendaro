import { Icons } from "@cendaro/ui/icons";

import { FAQ } from "../content";
import { Reveal } from "../primitives/reveal";
import { SectionHeading } from "../primitives/section-heading";

/**
 * FAQ with native <details>: answers are in the DOM (SEO), keyboard and
 * screen-reader behaviour comes from the browser, no JavaScript (plan T4.10).
 */
export function FaqSection() {
  return (
    <section
      id="preguntas"
      aria-labelledby="preguntas-title"
      className="border-border scroll-mt-20 border-t py-16 md:py-32"
    >
      <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
        <SectionHeading
          align="start"
          id="preguntas-title"
          eyebrow={{ index: "07", label: "Preguntas" }}
          title="Lo que suelen preguntarnos"
        />
        <Reveal variant="fade" className="border-border border-t">
          {FAQ.map((item) => (
            <details
              key={item.q}
              className="group border-border border-b [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="focus-visible:ring-ring flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 text-left text-lg outline-none focus-visible:ring-1">
                {item.q}
                <Icons.Add className="size-5 shrink-0 transition-transform duration-(--motion-ui) group-open:rotate-45" />
              </summary>
              <p className="text-muted-foreground max-w-2xl pb-6 leading-relaxed">
                {item.a}
              </p>
            </details>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

/** FAQPage structured data built from the same array (plan T7.2). */
export function faqJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}
