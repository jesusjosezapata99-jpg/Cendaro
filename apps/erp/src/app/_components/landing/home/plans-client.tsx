"use client";

import type { KeyboardEvent } from "react";
import { useRef, useState } from "react";

import { cn } from "@cendaro/ui";
import { Icons } from "@cendaro/ui/icons";

import type { Plan } from "../content";
import { CtaButtons } from "../primitives/cta-buttons";
import { Reveal } from "../primitives/reveal";

interface PlansClientProps {
  plans: readonly Plan[];
}

export function PlansClient({ plans }: PlansClientProps) {
  // Default to the recommended plan (index 1 / "pro") or first plan.
  const defaultIndex = plans.findIndex((p) => p.recommended);
  const [active, setActive] = useState(defaultIndex >= 0 ? defaultIndex : 0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>): void => {
    let next: number;
    if (event.key === "ArrowRight") {
      next = (active + 1) % plans.length;
    } else if (event.key === "ArrowLeft") {
      next = (active - 1 + plans.length) % plans.length;
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
      next = plans.length - 1;
    } else {
      return;
    }
    event.preventDefault();
    setActive(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <>
      {/* ── lg+: 3-column side-by-side grid ─────────────────────────── */}
      <ul className="border-border mt-12 hidden border-t border-l md:mt-16 lg:grid lg:grid-cols-3">
        {plans.map((plan, i) => (
          <Reveal
            as="li"
            key={plan.id}
            delay={i * 60}
            className={cn(
              "border-border flex flex-col border-r border-b p-6 md:p-8",
              plan.recommended && "bg-card",
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-serif text-2xl">{plan.name}</h3>
              {plan.recommended ? (
                <span className="border-foreground rounded-full border px-3 py-1 text-xs">
                  Recomendado
                </span>
              ) : null}
            </div>
            <p className="text-muted-foreground mt-3 leading-relaxed">
              {plan.audience}
            </p>
            <ul className="mt-6 flex flex-1 flex-col gap-3 text-sm">
              {plan.highlights.map((h) => (
                <li key={h} className="flex gap-3">
                  <Icons.Check className="mt-0.5 size-4 shrink-0" />
                  {h}
                </li>
              ))}
            </ul>
            <p className="border-border mt-6 border-t pt-4 text-sm">
              <span className="text-muted-foreground">Puesta en marcha: </span>
              {plan.onboarding}
            </p>
            <CtaButtons
              context={`Plan ${plan.name}`}
              showLogin={false}
              block
              className="mt-6"
            />
          </Reveal>
        ))}
      </ul>

      {/* ── below lg: compact segmented tabs (< 768px height saver) ─── */}
      <div className="mt-10 lg:hidden">
        <div
          role="tablist"
          aria-label="Planes disponibles"
          className="border-border flex border-b"
        >
          {plans.map((plan, i) => (
            <button
              key={plan.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`plan-tab-${plan.id}`}
              aria-selected={i === active}
              aria-controls={`plan-panel-${plan.id}`}
              tabIndex={i === active ? 0 : -1}
              onClick={() => setActive(i)}
              onKeyDown={onTabKey}
              className={cn(
                "-mb-px flex min-h-11 flex-1 items-center justify-center gap-1.5 border-b px-2 font-mono text-xs tracking-[0.12em] transition-colors duration-(--motion-ui)",
                i === active
                  ? "border-foreground text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground border-transparent",
              )}
            >
              <span>{plan.name}</span>
              {plan.recommended ? (
                <span className="bg-foreground text-background size-1.5 rounded-full" />
              ) : null}
            </button>
          ))}
        </div>

        {plans.map((plan, i) => (
          <div
            key={plan.id}
            role="tabpanel"
            id={`plan-panel-${plan.id}`}
            aria-labelledby={`plan-tab-${plan.id}`}
            hidden={i !== active}
            className={cn(
              "border-border border border-t-0 p-6",
              plan.recommended && "bg-card",
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-serif text-2xl">{plan.name}</h3>
              {plan.recommended ? (
                <span className="border-foreground rounded-full border px-3 py-1 text-xs">
                  Recomendado
                </span>
              ) : null}
            </div>
            <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
              {plan.audience}
            </p>
            <ul className="mt-5 flex flex-col gap-2.5 text-sm">
              {plan.highlights.map((h) => (
                <li key={h} className="flex gap-2.5">
                  <Icons.Check className="mt-0.5 size-4 shrink-0" />
                  <span>{h}</span>
                </li>
              ))}
            </ul>
            <p className="border-border mt-5 border-t pt-4 text-xs">
              <span className="text-muted-foreground">Puesta en marcha: </span>
              {plan.onboarding}
            </p>
            <CtaButtons
              context={`Plan ${plan.name}`}
              showLogin={false}
              block
              className="mt-6"
            />
          </div>
        ))}
      </div>
    </>
  );
}
