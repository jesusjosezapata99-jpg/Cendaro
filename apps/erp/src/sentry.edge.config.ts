/**
 * Sentry — edge runtime. Loaded by register() in instrumentation.ts.
 * No-op without a DSN.
 */
import * as Sentry from "@sentry/nextjs";

import { env } from "~/env";

Sentry.init({
  dsn: env.NEXT_PUBLIC_SENTRY_DSN,
  sendDefaultPii: false,
  tracesSampleRate: 0.1,
});
