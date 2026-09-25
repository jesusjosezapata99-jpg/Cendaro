/**
 * Public marketing site helpers (PLAN-2026-09-LANDING-REDESIGN F1).
 *
 * Pure functions only — no `~/env` import — so they are unit-testable without
 * the full environment. `site-env.ts` binds them to the validated env.
 */

/** Used until the own domain (cendaro.io) exists and NEXT_PUBLIC_SITE_URL is set. */
export const DEFAULT_SITE_URL = "https://cendaro-erp.vercel.app";

const WHATSAPP_NUMBER = /^\d{8,15}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Canonical origin of the public site, always without a trailing slash. */
export function resolveSiteUrl(raw: string | undefined): URL {
  const candidate = raw?.trim();
  if (candidate) {
    try {
      const url = new URL(candidate);
      if (url.protocol === "https:" || url.protocol === "http:") {
        return new URL(url.origin);
      }
    } catch {
      // Invalid value: fall back to the default below.
    }
  }
  return new URL(DEFAULT_SITE_URL);
}

export interface AccessRequestLinks {
  /** wa.me deep link with a prefilled message, or null when not configured. */
  whatsapp: string | null;
  /** mailto link with subject and body, or null when not configured. */
  email: string | null;
}

export interface AccessRequestInput {
  whatsappNumber: string | undefined;
  email: string | undefined;
  /** Where the visitor clicked (e.g. "Importaciones", "Plan Pro"). */
  context?: string;
}

/** The prefilled message sent with an access request. */
export function accessRequestMessage(context?: string): string {
  const origin = context?.trim();
  return origin
    ? `Hola, quiero solicitar acceso a Cendaro (desde: ${origin}).`
    : "Hola, quiero solicitar acceso a Cendaro.";
}

/**
 * "Solicitar acceso" links. Nothing is stored: the visitor opens WhatsApp or
 * their mail client with the message ready (user decision D3, 2026-09-24).
 */
export function buildAccessRequestLinks(
  input: AccessRequestInput,
): AccessRequestLinks {
  const message = accessRequestMessage(input.context);
  const number = input.whatsappNumber?.trim();
  const email = input.email?.trim();

  return {
    whatsapp:
      number && WHATSAPP_NUMBER.test(number)
        ? `https://wa.me/${number}?text=${encodeURIComponent(message)}`
        : null,
    email:
      email && EMAIL.test(email)
        ? `mailto:${email}?subject=${encodeURIComponent(
            "Solicitud de acceso a Cendaro",
          )}&body=${encodeURIComponent(message)}`
        : null,
  };
}

/** Only the Vercel production deployment may be indexed. */
export function isIndexableDeployment(vercelEnv: string | undefined): boolean {
  return vercelEnv === "production";
}
