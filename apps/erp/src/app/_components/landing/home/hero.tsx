import type { CSSProperties } from "react";

import { Icons } from "@cendaro/ui/icons";

import { siteUrl } from "~/lib/site-env";
import { HERO, HERO_VIDEO_LABEL } from "../content";
import { MEDIA } from "../media";
import { SampleDataNote } from "../mini/app-shell";
import { CtaButtons } from "../primitives/cta-buttons";
import { GrainBackdrop } from "../primitives/grain-backdrop";
import { LandingVideo } from "../primitives/landing-video";
import { ProductFrame } from "../primitives/product-frame";
import { Reveal } from "../primitives/reveal";

/**
 * Home hero (plan §6.1 #2–3). The `<h1>` is the LCP element: it is painted on
 * the first frame and only its lines slide (animate-hero-line, transform
 * only). Pill, lead and CTAs are also visible on the first frame
 * (animate-hero-rise); only the product frame waits for the observer.
 */
export function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="relative overflow-hidden pt-28 pb-16 md:pt-36 md:pb-24"
    >
      <div className="mx-auto flex max-w-7xl flex-col items-center px-4 text-center sm:px-6">
        <div className="animate-hero-rise">
          <a
            href={HERO.pill.href}
            className="border-border hover:bg-muted inline-flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-sm transition-colors duration-(--motion-micro)"
          >
            <span className="bg-foreground text-background rounded-full px-2 py-0.5 text-xs">
              {HERO.pill.label}
            </span>
            {HERO.pill.text}
            <Icons.ArrowForward className="size-4" />
          </a>
        </div>

        <h1
          id="hero-title"
          className="text-foreground mt-6 max-w-5xl font-serif text-[clamp(2.75rem,6vw,5.5rem)] leading-[1.02] tracking-[-0.025em] text-balance"
        >
          {HERO.title.map((line, i) => (
            <span key={line} className="block overflow-hidden pb-[0.08em]">
              <span
                className="animate-hero-line block"
                style={{ "--line-delay": `${i * 90}ms` } as CSSProperties}
              >
                {line}
              </span>
            </span>
          ))}
        </h1>

        <div
          className="animate-hero-rise mt-6 max-w-2xl"
          style={{ "--line-delay": "150ms" } as CSSProperties}
        >
          <p className="text-muted-foreground text-lg leading-relaxed text-pretty md:text-xl">
            {HERO.lead}
          </p>
        </div>

        <div
          className="animate-hero-rise mt-9 w-full sm:w-auto"
          style={{ "--line-delay": "220ms" } as CSSProperties}
        >
          <CtaButtons context="Inicio" />
          <p className="text-muted-foreground mt-4 text-sm">{HERO.note}</p>
        </div>
      </div>

      <Reveal
        variant="rise"
        delay={280}
        className="mx-auto mt-14 max-w-7xl px-4 sm:px-6 md:mt-20"
      >
        <GrainBackdrop className="border-border border px-3 pt-6 sm:px-8 sm:pt-12 lg:px-16 lg:pt-16">
          <ProductFrame
            host={siteUrl.host}
            path="/dashboard"
            className="border-b-0"
          >
            <LandingVideo
              priority
              clip={MEDIA["hero-overview"]}
              label={HERO_VIDEO_LABEL}
            />
          </ProductFrame>
        </GrainBackdrop>
        <SampleDataNote className="mt-3 text-center" />
      </Reveal>
    </section>
  );
}
