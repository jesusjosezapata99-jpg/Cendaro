import { Icons } from "@cendaro/ui/icons";

import { SECURITY } from "../content";
import { Reveal } from "../primitives/reveal";
import { SectionHeading } from "../primitives/section-heading";

/** Verifiable security and control checklist (plan §6.1 #9). */
export function SecuritySection() {
  return (
    <section
      id="seguridad"
      aria-labelledby="seguridad-title"
      className="border-border scroll-mt-20 border-t py-16 md:py-32"
    >
      <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
        <SectionHeading
          align="start"
          id="seguridad-title"
          eyebrow={{ index: "05", label: "Seguridad y control" }}
          title="Cada quien ve lo suyo. Cada cambio queda escrito."
          description="Tus clientes, precios y cobranzas son el corazón del negocio. Cendaro los protege por diseño, no por configuración."
        />
        <Reveal variant="rise">
          <ul className="border-border bg-card divide-border divide-y border">
            {SECURITY.map((item) => (
              <li key={item.text} className="flex gap-4 px-5 py-4 md:px-6">
                <span className="border-border bg-background flex size-6 shrink-0 items-center justify-center border">
                  <Icons.Check className="size-4" />
                </span>
                <span className="leading-relaxed">{item.text}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
