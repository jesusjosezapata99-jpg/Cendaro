import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod/v4";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    LTX_API_KEY: z.string().startsWith("ltxv_").optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    GROQ_API_KEY: z.string().min(1).optional(),
    EXCHANGE_RATE_API_KEY: z.string().min(1).optional(),
    // Vercel Cron bearer secret for /api/cron/*. Optional so builds work
    // without it; the cron routes refuse to run (503) until it is set to at
    // least 32 characters. The length is checked there, not here: a short
    // value must disable the cron, not crash every page at startup.
    CRON_SECRET: z.string().optional(),
    // Owner/admin MFA cutover (YYYY-MM-DD, UTC). Unset = not scheduled: no
    // blocking and no banner. Read at runtime by
    // packages/api/src/services/mfa-enforcement.ts; validated here too so a
    // typo fails local builds and server startup (Vercel builds set CI, which
    // skips validation) instead of the first tRPC call.
    MFA_ENFORCEMENT_DATE: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
      z.iso.date().optional(),
    ),
    MERCADOLIBRE_APP_ID: z.string().optional(),
    MERCADOLIBRE_SECRET: z.string().optional(),
    VERCEL_URL: z
      .string()
      .regex(/^[a-z0-9.-]+$/)
      .optional(),
    // Vercel deployment target. Only "production" may be indexed by search
    // engines (app/robots.ts); previews and local builds answer disallow.
    VERCEL_ENV: z.enum(["production", "preview", "development"]).optional(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
  },
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    // Sentry DSN (public by design). Empty/missing → Sentry disabled.
    NEXT_PUBLIC_SENTRY_DSN: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
      z.string().url().optional(),
    ),
    // Public marketing site (PLAN-2026-09-LANDING-REDESIGN F1). All three are
    // inlined at build time, so a change needs a redeploy. Empty = unset.
    // Canonical origin for metadata, sitemap and JSON-LD; unset falls back to
    // the Vercel production URL (src/lib/site.ts).
    NEXT_PUBLIC_SITE_URL: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
      z.string().url().optional(),
    ),
    // "Solicitar acceso" by WhatsApp: international number, digits only
    // (e.g. 584141234567). Unset hides the WhatsApp button.
    NEXT_PUBLIC_CONTACT_WHATSAPP: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
      z
        .string()
        .regex(/^\d{8,15}$/)
        .optional(),
    ),
    // "Solicitar acceso" by email. Unset hides the email link.
    NEXT_PUBLIC_CONTACT_EMAIL: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
      z.string().email().optional(),
    ),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_CONTACT_WHATSAPP: process.env.NEXT_PUBLIC_CONTACT_WHATSAPP,
    NEXT_PUBLIC_CONTACT_EMAIL: process.env.NEXT_PUBLIC_CONTACT_EMAIL,
  },
  skipValidation:
    !!process.env.CI || process.env.npm_lifecycle_event === "lint",
});
