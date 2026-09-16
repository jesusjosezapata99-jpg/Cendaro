/**
 * Sentry — browser runtime. Next.js loads this file before the app hydrates.
 * Without NEXT_PUBLIC_SENTRY_DSN (local .env) the SDK stays disabled.
 */
import * as Sentry from "@sentry/nextjs";

import { env } from "~/env";

Sentry.init({
  dsn: env.NEXT_PUBLIC_SENTRY_DSN,
  // ERP screens show customer and pricing data: never attach IPs, cookies or
  // request bodies. Session Replay is deliberately not enabled for the same
  // reason.
  sendDefaultPii: false,
  tracesSampleRate: 0.1,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
