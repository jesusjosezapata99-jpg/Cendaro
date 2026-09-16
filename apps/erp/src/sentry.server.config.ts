/**
 * Sentry — Node.js runtime (Server Components, route handlers, tRPC).
 * Loaded by register() in instrumentation.ts. No-op without a DSN.
 */
import * as Sentry from "@sentry/nextjs";

import { env } from "~/env";

Sentry.init({
  dsn: env.NEXT_PUBLIC_SENTRY_DSN,
  // Never attach IPs, cookies, headers or request bodies (customer data).
  sendDefaultPii: false,
  tracesSampleRate: 0.1,
});
