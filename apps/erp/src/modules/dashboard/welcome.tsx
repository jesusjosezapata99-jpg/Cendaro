"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, m } from "framer-motion";

import { Skeleton } from "@cendaro/ui";

import { useCurrentUser } from "~/hooks/use-current-user";

export interface DashboardInsight {
  text: string;
  href: string;
}

const TICKER_INTERVAL_MS = 6000;
const GREETING_REFRESH_MS = 5 * 60 * 1000;

function greetingForHour(hour: number): string {
  if (hour >= 5 && hour < 12) return "Buenos días";
  if (hour >= 12 && hour < 17) return "Buenas tardes";
  return "Buenas noches";
}

/**
 * Greeting (M-10) + insights ticker (M-09) — PLAN-2026-09-DESIGN-SYSTEM
 * §5.8.2. The greeting doubles as the page's only heading (a real `<h1>`,
 * not `sr-only`): unlike every other page, the dashboard's top row *is*
 * Cendaro greeting row, not the generic `PageHeader` toolbar.
 */
export function Welcome({ insights }: { insights: DashboardInsight[] }) {
  const { profile, loading } = useCurrentUser();
  const [greeting, setGreeting] = useState(() =>
    greetingForHour(new Date().getHours()),
  );
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const id = setInterval(
      () => setGreeting(greetingForHour(new Date().getHours())),
      GREETING_REFRESH_MS,
    );
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (paused || insights.length <= 1) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % insights.length);
    }, TICKER_INTERVAL_MS);
    return () => clearInterval(id);
  }, [paused, insights.length]);

  useEffect(() => {
    setIndex(0);
  }, [insights.length]);

  const firstName = profile?.fullName.split(" ")[0] ?? "";
  const current = insights[index];

  return (
    <div>
      <h1 className="text-2xl">
        {greeting}
        {loading ? (
          <Skeleton className="ml-2 inline-block h-6 w-24 align-middle" />
        ) : (
          <span className="text-muted-foreground">, {firstName}</span>
        )}
      </h1>

      {current ? (
        <div
          className="mt-1 flex items-center gap-3"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <AnimatePresence mode="wait">
            <m.div
              key={index}
              initial={{ y: 14, opacity: 0, filter: "blur(4px)" }}
              animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
              exit={{ y: -14, opacity: 0, filter: "blur(4px)" }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            >
              <Link
                href={current.href}
                className="text-muted-foreground hover:text-foreground text-sm transition-colors"
              >
                {current.text}
              </Link>
            </m.div>
          </AnimatePresence>

          {insights.length > 1 ? (
            <div className="flex gap-1">
              {insights.map((insight, i) => (
                <span
                  key={insight.href}
                  className="bg-primary/10 relative h-0.5 w-4 overflow-hidden rounded-full"
                >
                  {i === index && !paused ? (
                    <m.span
                      className="bg-primary/40 absolute inset-0 origin-left"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{
                        duration: TICKER_INTERVAL_MS / 1000,
                        ease: "linear",
                      }}
                    />
                  ) : null}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
