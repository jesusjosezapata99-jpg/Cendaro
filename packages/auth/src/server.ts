import { createServerClient } from "@supabase/ssr";

export function createSupabaseServerClient(
  cookieStore: {
    getAll: () => { name: string; value: string }[];
    set: (
      name: string,
      value: string,
      options: Record<string, unknown>,
    ) => void;
  },
  url: string,
  anonKey: string,
) {
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(
        cookiesToSet: {
          name: string;
          value: string;
          options: Record<string, unknown>;
        }[],
      ) {
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, options);
        }
      },
    },
  });
}
