import { createSupabaseBrowserClient } from "@cendaro/auth/client";

import { env } from "~/env";

let client: ReturnType<typeof createSupabaseBrowserClient> | undefined;

/**
 * Singleton browser Supabase client. Only `auth.mfa.*` (TOTP enrollment) uses
 * it directly — all other data access goes through tRPC, which verifies the
 * JWT server-side and never trusts anything read from this client.
 */
export function getSupabaseBrowserClient() {
  client ??= createSupabaseBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  return client;
}
