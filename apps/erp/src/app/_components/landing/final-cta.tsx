import { ArrowRight } from "lucide-react";

import { ScrollEntrance } from "./scroll-entrance";

export function FinalCTA() {
  return (
    <section className="bg-foreground text-background relative overflow-hidden py-32">
      {/* Giant watermark logo */}
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        aria-hidden="true"
      >
        <span className="font-serif text-[20vw] leading-none font-bold opacity-[0.03] select-none">
          Cendaro
        </span>
      </div>

      <div className="relative mx-auto max-w-3xl px-6 text-center">
        <ScrollEntrance>
          <h2 className="font-serif text-[clamp(2rem,4vw,3.5rem)] leading-[1.1] tracking-[-0.02em]">
            Gestiona tu negocio. No el papeleo.
          </h2>
          <p className="mx-auto mt-6 max-w-lg text-lg opacity-70">
            Deja que Cendaro se encargue de la gestión mientras tú te enfocas en
            hacer crecer tu negocio.
          </p>
          <div className="mt-10">
            <a
              href="/login"
              className="group bg-background text-foreground inline-flex cursor-pointer items-center gap-2 rounded-lg px-8 py-3 text-base font-medium transition-all duration-200 hover:opacity-90 active:scale-[0.97]"
            >
              Empezar gratis
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </a>
          </div>
        </ScrollEntrance>
      </div>
    </section>
  );
}
