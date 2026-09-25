import { Icons } from "@cendaro/ui/icons";

import { BEFORE_AFTER } from "../content";
import { Reveal } from "../primitives/reveal";
import { SectionHeading } from "../primitives/section-heading";

/** Qualitative before/after — no invented time savings (plan §6.1 #8). */
export function BeforeAfter() {
  return (
    <section
      aria-labelledby="antes-despues-title"
      className="border-border border-t py-16 md:py-32"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading
          id="antes-despues-title"
          eyebrow={{ index: "04", label: "Menos Excel" }}
          title="Lo que deja de pasar en tu negocio"
        />
        <div className="border-border mt-10 border md:mt-16">
          <div className="border-border bg-card text-muted-foreground hidden grid-cols-2 border-b font-mono text-xs tracking-[0.18em] uppercase md:grid">
            <span className="border-border border-r px-6 py-3">Hoy</span>
            <span className="px-6 py-3">Con Cendaro</span>
          </div>
          {BEFORE_AFTER.map((row, i) => (
            <Reveal
              key={row.before}
              variant="fade"
              delay={i * 50}
              className="border-border grid border-b last:border-b-0 md:grid-cols-2"
            >
              <p className="text-muted-foreground border-border px-5 pt-4 text-sm leading-relaxed md:border-r md:px-6 md:py-5 md:text-base">
                <span className="sr-only">Hoy: </span>
                {row.before}
              </p>
              <p className="flex gap-3 px-5 pt-1 pb-4 leading-relaxed md:px-6 md:py-5">
                <Icons.ArrowForward className="mt-1 size-4 shrink-0" />
                <span>
                  <span className="sr-only">Con Cendaro: </span>
                  {row.after}
                </span>
              </p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
