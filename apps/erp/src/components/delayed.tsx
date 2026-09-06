"use client";

import { useEffect, useState } from "react";

/**
 * Delays rendering `children` by `delay` ms (renders nothing until then).
 *
 * NN/g guidance: skeleton screens that flash when loads complete quickly
 * (under ~300 ms) make the UI feel SLOWER, not faster. Wrapping skeleton
 * fallbacks in <Delayed> keeps fast loads clean while still giving clear
 * feedback on genuinely slow ones.
 *
 * Safe for Suspense fallbacks under `cacheComponents`: renders null on the
 * server and on the first client render (timer in an effect), so the
 * fallback's initial markup always matches between server and client.
 *
 * Usage: <Suspense fallback={<Delayed><MySkeleton /></Delayed>}>
 */
export function Delayed({
  children,
  delay = 200,
}: {
  children: React.ReactNode;
  /** ms to wait before rendering — 200 ms avoids the flash-perception trap */
  delay?: number;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return ready ? <>{children}</> : null;
}
