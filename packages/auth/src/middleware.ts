import { createServerClient } from "@supabase/ssr";

interface CookieStore {
  getAll: () => { name: string; value: string }[];
  set: (name: string, value: string, options: Record<string, unknown>) => void;
}

interface MiddlewareCookies {
  request: CookieStore;
  response: CookieStore;
}

export function createSupabaseMiddlewareClient(
  cookies: MiddlewareCookies,
  url: string,
  anonKey: string,
) {
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookies.request.getAll();
      },
      setAll(
        cookiesToSet: {
          name: string;
          value: string;
          options: Record<string, unknown>;
        }[],
      ) {
        for (const { name, value, options } of cookiesToSet) {
          cookies.request.set(name, value, options);
          cookies.response.set(name, value, options);
        }
      },
    },
  });
}
