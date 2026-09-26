import type { AccessRequestLinks } from "~/lib/site";
import { env } from "~/env";
import { buildAccessRequestLinks, resolveSiteUrl } from "~/lib/site";

/** `site.ts` helpers bound to the validated environment. */
export const siteUrl: URL = resolveSiteUrl(env.NEXT_PUBLIC_SITE_URL);

export function accessRequestLinks(context?: string): AccessRequestLinks {
  return buildAccessRequestLinks({
    whatsappNumber: env.NEXT_PUBLIC_CONTACT_WHATSAPP,
    email: env.NEXT_PUBLIC_CONTACT_EMAIL,
    context,
  });
}
