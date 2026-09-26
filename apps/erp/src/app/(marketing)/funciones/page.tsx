import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";

import { Icons } from "@cendaro/ui/icons";
import { ERP_MODULES } from "@cendaro/validators";

import type { ModuleEntry } from "../../_components/landing/feature-page/module-index";
import {
  FACTS,
  MODULE_GROUPS,
  MODULES,
} from "../../_components/landing/content";
import { ModuleIndex } from "../../_components/landing/feature-page/module-index";
import {
  FEATURE_SLUGS,
  featureHref,
  FEATURES,
  MODULE_FEATURE,
} from "../../_components/landing/features";
import { FinalCta } from "../../_components/landing/home/final-cta";
import { Reveal } from "../../_components/landing/primitives/reveal";
import { SectionHeading } from "../../_components/landing/primitives/section-heading";
import { breadcrumbJsonLd, JsonLd } from "../../_components/landing/seo";

const TITLE = `Funciones: los ${FACTS.modules} módulos de Cendaro`;
const DESCRIPTION =
  "Inventario, importaciones con IA, punto de venta, pedidos, tasas BCV, cobranzas, WhatsApp y permisos por rol, en un solo sistema para distribuidoras en Venezuela.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/funciones" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    locale: "es_VE",
    siteName: "Cendaro",
    url: "/funciones",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

const MODULE_ENTRIES: readonly ModuleEntry[] = ERP_MODULES.map((id) => {
  const info = MODULES[id];
  const slug = MODULE_FEATURE[id];
  return {
    id,
    name: info.name,
    line: info.line,
    icon: info.icon,
    group: info.group,
    ...(slug ? { href: featureHref(slug) } : {}),
  };
});

const delay = (ms: number): CSSProperties =>
  ({ "--line-delay": `${ms}ms` }) as CSSProperties;

const JSON_LD = breadcrumbJsonLd([
  { name: "Inicio", path: "/" },
  { name: "Funciones", path: "/funciones" },
]);

/** Index of every module, with the three deep-dive pages first (plan T5.4). */
export default function FuncionesPage() {
  return (
    <>
      <JsonLd data={JSON_LD} />
      <section
        aria-labelledby="funciones-title"
        className="pt-24 pb-16 md:pt-32 md:pb-24"
      >
        <div className="mx-auto flex max-w-7xl flex-col items-center px-4 text-center sm:px-6">
          <nav aria-label="Ruta de navegación" className="animate-hero-rise">
            <ol className="text-muted-foreground flex items-center gap-1.5 text-sm">
              <li>
                <Link href="/" className="hover:text-foreground">
                  Inicio
                </Link>
              </li>
              <li aria-hidden="true">
                <Icons.ChevronRight className="size-4" />
              </li>
              <li aria-current="page" className="text-foreground">
                Funciones
              </li>
            </ol>
          </nav>
          <h1
            id="funciones-title"
            style={delay(60)}
            className="animate-hero-rise text-foreground mt-8 max-w-4xl font-serif text-[clamp(2.5rem,6vw,5rem)] leading-[1.04] tracking-[-0.025em] text-balance"
          >
            Todo lo que hace Cendaro
          </h1>
          <p
            style={delay(120)}
            className="animate-hero-rise text-muted-foreground mt-6 max-w-2xl text-lg leading-relaxed text-pretty md:text-xl"
          >
            {FACTS.modules} módulos que comparten los mismos productos,
            clientes, tasas y permisos. Empieza por los tres que más cambian el
            día a día de una distribuidora.
          </p>
        </div>

        <div className="mx-auto mt-14 max-w-7xl px-4 sm:px-6 md:mt-20">
          <ul className="border-border grid border-t border-l md:grid-cols-3">
            {FEATURE_SLUGS.map((slug, i) => {
              const page = FEATURES[slug];
              return (
                <Reveal
                  as="li"
                  key={slug}
                  delay={i * 60}
                  className="border-border border-r border-b"
                >
                  <Link
                    href={featureHref(slug)}
                    className="group hover:bg-muted flex h-full flex-col gap-6 p-6 transition-colors duration-(--motion-micro) md:p-8"
                  >
                    <span className="text-muted-foreground font-mono text-xs tracking-[0.18em] uppercase">
                      0{i + 1} — {page.eyebrow}
                    </span>
                    <span className="font-serif text-3xl leading-tight tracking-[-0.01em] text-balance">
                      {page.title}
                    </span>
                    <span className="text-muted-foreground leading-relaxed">
                      {page.lead}
                    </span>
                    <span className="mt-auto inline-flex items-center gap-2 text-sm">
                      Ver cómo funciona
                      <Icons.ArrowForward className="size-4 transition-transform duration-(--motion-micro) group-hover:translate-x-0.5" />
                    </span>
                  </Link>
                </Reveal>
              );
            })}
          </ul>
        </div>
      </section>

      <section
        aria-labelledby="indice-title"
        className="border-border border-t py-16 md:py-32"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionHeading
            align="start"
            id="indice-title"
            eyebrow={{ label: "Índice" }}
            title={`Los ${FACTS.modules} módulos`}
            description="Busca por nombre o por lo que necesitas resolver. Cada empresa activa los módulos de su plan."
          />
          <div className="mt-12">
            <ModuleIndex groups={MODULE_GROUPS} modules={MODULE_ENTRIES} />
          </div>
        </div>
      </section>

      <FinalCta context="Funciones" />
    </>
  );
}
