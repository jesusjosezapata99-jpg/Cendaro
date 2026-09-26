"use client";

import type { KeyboardEvent } from "react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@cendaro/ui";
import { Icons } from "@cendaro/ui/icons";

import type { Step } from "../content";
import type { MediaClip } from "../primitives/video-policy";
import { LandingVideo } from "../primitives/landing-video";
import { ProductFrame } from "../primitives/product-frame";

interface StepClip {
  clip: MediaClip;
  label: string;
}

interface HowItWorksClientProps {
  steps: readonly Step[];
  /** One product recording per step, same order as `steps`. */
  clips: readonly StepClip[];
  /** Site host for the frame's address bar. */
  host: string;
}

/** Centre band that decides the active step (± 5 % around the middle). */
const ACTIVE_BAND = "-45% 0px -45% 0px";

function Bullets({ items }: { items: readonly string[] }) {
  return (
    <ul className="mt-5 flex flex-col gap-2 text-sm">
      {items.map((item) => (
        <li key={item} className="flex items-center gap-2">
          <Icons.Check className="size-4 shrink-0" />
          {item}
        </li>
      ))}
    </ul>
  );
}

/**
 * "Cómo funciona" (plan T4.4). Desktop: steps scroll on the left while one
 * sticky frame, vertically centred, crossfades between views mounted once.
 * Below lg: accessible tabs with a single view. Every view is in the DOM from
 * the server render, so nothing loads when the step changes.
 */
export function HowItWorksClient({
  steps,
  clips,
  host,
}: HowItWorksClientProps) {
  const [active, setActive] = useState(0);
  const stepRefs = useRef<(HTMLElement | null)[]>([]);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const index = stepRefs.current.indexOf(entry.target as HTMLElement);
          if (index >= 0) setActive(index);
        }
      },
      { rootMargin: ACTIVE_BAND },
    );
    for (const el of stepRefs.current) if (el) observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const goTo = (index: number): void => {
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    stepRefs.current[index]?.scrollIntoView({
      behavior: reduced ? "auto" : "smooth",
      block: "center",
    });
  };

  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>): void => {
    const delta =
      event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (delta === 0) return;
    event.preventDefault();
    const next = (active + delta + steps.length) % steps.length;
    setActive(next);
    tabRefs.current[next]?.focus();
  };

  const progress = (active + 1) / steps.length;

  return (
    <>
      {/* ── lg+: sticky scroll ─────────────────────────────────────── */}
      <div className="hidden gap-16 lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <ol className="relative">
          <span
            aria-hidden="true"
            className="bg-border absolute top-0 bottom-0 left-1.25 w-px"
          />
          <span
            aria-hidden="true"
            className="bg-foreground absolute top-0 left-1.25 h-full w-px origin-top transition-transform duration-(--motion-enter) ease-(--ease-out-expo)"
            style={{ transform: `scaleY(${progress})` }}
          />
          {steps.map((step, i) => (
            <li
              key={step.id}
              ref={(el) => {
                stepRefs.current[i] = el;
              }}
              className="flex min-h-[70vh] items-center"
            >
              <div className="relative pl-10">
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute top-2 left-0 size-2.75 border transition-colors duration-(--motion-ui)",
                    i <= active
                      ? "bg-foreground border-foreground"
                      : "bg-background border-border",
                  )}
                />
                <button
                  type="button"
                  onClick={() => goTo(i)}
                  aria-current={i === active ? "step" : undefined}
                  className="focus-visible:ring-ring text-left outline-none focus-visible:ring-1"
                >
                  <span className="text-muted-foreground font-mono text-xs tracking-[0.18em]">
                    {step.index}
                  </span>
                  <span
                    className={cn(
                      "mt-2 block font-serif text-3xl leading-tight tracking-[-0.015em] transition-colors duration-(--motion-ui)",
                      i === active
                        ? "text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {step.title}
                  </span>
                </button>
                <p className="text-muted-foreground mt-4 max-w-md leading-relaxed">
                  {step.body}
                </p>
                <Bullets items={step.bullets} />
              </div>
            </li>
          ))}
        </ol>

        <div className="relative">
          <div className="sticky top-[calc(50vh-13rem)]">
            <ProductFrame host={host} path={steps[active]?.path ?? "/"}>
              <div className="grid">
                {clips.map(({ clip, label }, i) => (
                  <div
                    key={steps[i]?.id ?? i}
                    inert={i !== active}
                    className={cn(
                      "col-start-1 row-start-1 transition-opacity duration-(--motion-media) ease-(--ease-out-expo)",
                      i === active ? "opacity-100" : "opacity-0",
                    )}
                  >
                    <LandingVideo
                      clip={clip}
                      label={label}
                      active={i === active}
                    />
                  </div>
                ))}
              </div>
            </ProductFrame>
          </div>
        </div>
      </div>

      {/* ── below lg: tabs ─────────────────────────────────────────── */}
      <div className="lg:hidden">
        <div
          role="tablist"
          aria-label="Pasos"
          className="border-border flex overflow-x-auto border-b"
        >
          {steps.map((step, i) => (
            <button
              key={step.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`paso-tab-${step.id}`}
              aria-selected={i === active}
              aria-controls={`paso-panel-${step.id}`}
              tabIndex={i === active ? 0 : -1}
              onClick={() => setActive(i)}
              onKeyDown={onTabKey}
              className={cn(
                "-mb-px min-h-11 shrink-0 border-b px-4 font-mono text-xs tracking-[0.12em] transition-colors duration-(--motion-ui)",
                i === active
                  ? "border-foreground text-foreground"
                  : "text-muted-foreground border-transparent",
              )}
            >
              {step.index}
            </button>
          ))}
        </div>
        {steps.map((step, i) => (
          <div
            key={step.id}
            role="tabpanel"
            id={`paso-panel-${step.id}`}
            aria-labelledby={`paso-tab-${step.id}`}
            hidden={i !== active}
            className="pt-8"
          >
            <h3 className="font-serif text-2xl leading-tight">{step.title}</h3>
            <p className="text-muted-foreground mt-3 leading-relaxed">
              {step.body}
            </p>
            <Bullets items={step.bullets} />
            <div className="mt-6 overflow-hidden">
              <ProductFrame host={host} path={step.path}>
                {clips[i] ? (
                  <LandingVideo
                    clip={clips[i].clip}
                    label={clips[i].label}
                    active={i === active}
                  />
                ) : null}
              </ProductFrame>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
