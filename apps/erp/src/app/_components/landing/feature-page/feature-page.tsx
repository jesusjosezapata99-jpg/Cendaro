import type { CSSProperties } from "react";
import Link from "next/link";

import { Icon, Icons } from "@cendaro/ui/icons";

import type { FeaturePage as FeaturePageContent } from "../features";
import { siteUrl } from "~/lib/site-env";
import { CLIP_LABELS, MODULES } from "../content";
import { featureHref, MODULE_FEATURE } from "../features";
import { FaqSection } from "../home/faq-section";
import { FinalCta } from "../home/final-cta";
import { MEDIA } from "../media";
import { SampleDataNote } from "../mini/app-shell";
import { CtaButtons } from "../primitives/cta-buttons";
import { GrainBackdrop } from "../primitives/grain-backdrop";
import { LandingVideo } from "../primitives/landing-video";
import { ProductFrame } from "../primitives/product-frame";
import { Reveal } from "../primitives/reveal";
import { SectionHeading } from "../primitives/section-heading";

/** App route shown in the product frame of each feature page. */
const FRAME_PATH = {
  inventario: "/inventory",
  importaciones: "/containers",
  finanzas: "/rates",
} as const;

/** Recording shown in the product frame of each feature page. */
const FEATURE_CLIP = {
  inventario: "flow-inventory-stock",
  importaciones: "flow-container-ai",
  finanzas: "flow-rates-bcv",
} as const satisfies Record<
  FeaturePageContent["slug"],
  keyof typeof CLIP_LABELS
>;

const pad = (n: number): string => String(n).padStart(2, "0");
const delay = (ms: number): CSSProperties =>
  ({ "--line-delay": `${ms}ms` }) as CSSProperties;

/**
 * Feature page template (plan §6.2, T5.1): breadcrumbs, hero, product view,
 * "Cómo se hace", capabilities, related modules, questions and CTA. All
 * Server Components; the `<h1>` and lead paint on the first frame (CSS-only
 * entrance, animate-hero-rise) so a JS-gated reveal never holds back LCP.
 */
export function FeaturePage({ page }: { page: FeaturePageContent }) {
  const clipId = FEATURE_CLIP[page.slug];

  return (
    <>
      <section
        aria-labelledby="feature-title"
        className="relative overflow-hidden pt-24 pb-16 md:pt-32 md:pb-24"
      >
        <div className="mx-auto flex max-w-7xl flex-col items-center px-4 text-center sm:px-6">
          <Breadcrumbs name={page.name} />
          <p className="animate-hero-rise text-muted-foreground mt-8 font-mono text-xs tracking-[0.18em] uppercase">
            {page.eyebrow}
          </p>
          <h1
            id="feature-title"
            style={delay(60)}
            className="animate-hero-rise text-foreground mt-5 max-w-4xl font-serif text-[clamp(2.5rem,6vw,5rem)] leading-[1.04] tracking-[-0.025em] text-balance"
          >
            {page.title}
          </h1>
          <p
            style={delay(120)}
            className="animate-hero-rise text-muted-foreground mt-6 max-w-2xl text-lg leading-relaxed text-pretty md:text-xl"
          >
            {page.lead}
          </p>
          <div
            style={delay(180)}
            className="animate-hero-rise mt-9 w-full sm:w-auto"
          >
            <CtaButtons context={page.name} />
          </div>
        </div>

        <Reveal
          variant="rise"
          delay={200}
          className="mx-auto mt-14 max-w-6xl px-4 sm:px-6 md:mt-20"
        >
          <GrainBackdrop className="border-border border px-3 pt-6 sm:px-8 sm:pt-12 lg:px-16 lg:pt-16">
            <ProductFrame
              host={siteUrl.host}
              path={FRAME_PATH[page.slug]}
              className="border-b-0"
            >
              <LandingVideo
                priority
                clip={MEDIA[clipId]}
                label={CLIP_LABELS[clipId]}
              />
            </ProductFrame>
          </GrainBackdrop>
          <SampleDataNote className="mt-3 text-center" />
        </Reveal>
      </section>

      <Steps page={page} />
      <Capabilities page={page} />
      <RelatedModules page={page} />
      <FaqSection items={page.faq} index="04" title="Preguntas frecuentes" />
      <FinalCta context={page.name} />
    </>
  );
}

function Breadcrumbs({ name }: { name: string }) {
  return (
    <nav aria-label="Ruta de navegación" className="animate-hero-rise">
      <ol className="text-muted-foreground flex flex-wrap items-center justify-center gap-1.5 text-sm">
        <li>
          <Link href="/" className="hover:text-foreground">
            Inicio
          </Link>
        </li>
        <li aria-hidden="true">
          <Icons.ChevronRight className="size-4" />
        </li>
        <li>
          <Link href="/funciones" className="hover:text-foreground">
            Funciones
          </Link>
        </li>
        <li aria-hidden="true">
          <Icons.ChevronRight className="size-4" />
        </li>
        <li aria-current="page" className="text-foreground">
          {name}
        </li>
      </ol>
    </nav>
  );
}

function Steps({ page }: { page: FeaturePageContent }) {
  return (
    <section
      aria-labelledby="pasos-title"
      className="border-border border-t py-16 md:py-32"
    >
      <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionHeading
            align="start"
            id="pasos-title"
            eyebrow={{ index: "01", label: "Cómo se hace" }}
            title={`${page.steps.length} pasos, de principio a fin`}
            description="Así se ve el trabajo dentro de Cendaro, en el orden en que lo hace tu equipo."
          />
        </div>
        <ol className="border-border border-t">
          {page.steps.map((step, i) => (
            <Reveal
              as="li"
              key={step.title}
              variant="fade"
              className="border-border grid grid-cols-[3rem_minmax(0,1fr)] gap-4 border-b py-7 md:grid-cols-[4rem_minmax(0,1fr)] md:py-9"
            >
              <span className="text-muted-foreground font-mono text-sm tabular-nums">
                {pad(i + 1)}
              </span>
              <span>
                <span className="block font-serif text-2xl leading-tight tracking-[-0.01em] md:text-3xl">
                  {step.title}
                </span>
                <span className="text-muted-foreground mt-3 block max-w-xl leading-relaxed">
                  {step.text}
                </span>
              </span>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Capabilities({ page }: { page: FeaturePageContent }) {
  return (
    <section
      aria-labelledby="capacidades-title"
      className="border-border border-t py-16 md:py-32"
    >
      <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16">
        <SectionHeading
          align="start"
          id="capacidades-title"
          eyebrow={{ index: "02", label: "Por qué importa" }}
          title={page.difference.title}
          description={page.difference.body}
        />
        <Reveal variant="fade">
          <ul className="border-border grid border-t border-l sm:grid-cols-2">
            {page.capabilities.map((capability) => (
              <li
                key={capability.text}
                className="border-border flex items-center gap-3 border-r border-b p-4 sm:p-5"
              >
                <Icons.Check className="size-5 shrink-0" />
                <span>{capability.text}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

function RelatedModules({ page }: { page: FeaturePageContent }) {
  return (
    <section
      aria-labelledby="modulos-title"
      className="border-border border-t py-16 md:py-32"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading
          align="start"
          id="modulos-title"
          eyebrow={{ index: "03", label: "Módulos" }}
          title="Los módulos que intervienen"
          description="Comparten los mismos productos, clientes, tasas y permisos que el resto de Cendaro."
        />
        <Reveal variant="fade" className="mt-12">
          <ul className="border-border grid grid-cols-1 border-t border-l sm:grid-cols-2 lg:grid-cols-4">
            {page.modules.map((module) => {
              const info = MODULES[module];
              const slug = MODULE_FEATURE[module];
              const href =
                slug && slug !== page.slug
                  ? featureHref(slug)
                  : `/funciones#${module}`;
              return (
                <li key={module} className="border-border border-r border-b">
                  <Link
                    href={href}
                    className="group hover:bg-muted flex h-full flex-col gap-4 p-5 transition-colors duration-(--motion-micro)"
                  >
                    <span className="flex items-center justify-between">
                      <span className="border-border flex size-10 items-center justify-center border">
                        <Icon name={info.icon} className="size-5" />
                      </span>
                      <Icons.ArrowForward className="text-muted-foreground size-4 transition-transform duration-(--motion-micro) group-hover:translate-x-0.5" />
                    </span>
                    <span>
                      <span className="block font-medium">{info.name}</span>
                      <span className="text-muted-foreground mt-1 block text-sm leading-snug">
                        {info.line}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
