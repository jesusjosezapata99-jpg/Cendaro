import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod/v4";

import { createSupabaseServerClient } from "@cendaro/auth/server";

import { env } from "~/env";
import { rateLimit } from "~/lib/rate-limit";

export async function POST(request: Request) {
  // ── Rate Limiting (5 attempts per 60s per IP) ──
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { success: allowed, reset } = rateLimit(ip, { window: 60_000, max: 5 });
  if (!allowed) {
    return NextResponse.json(
      { error: "Demasiados intentos. Intente de nuevo más tarde." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)),
        },
      },
    );
  }

  const rawBody = (await request.json().catch(() => ({}))) as unknown;
  const loginSchema = z.object({
    username: z.string().min(1).max(128),
    password: z.string().min(6).max(256),
  });

  const parsed = loginSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Usuario y contraseña son requeridos y deben ser válidos" },
      { status: 400 },
    );
  }

  const { username, password } = parsed.data;

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: "Configuración del servidor incompleta" },
      { status: 500 },
    );
  }

  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(
    cookieStore,
    supabaseUrl,
    supabaseKey,
  );

  // Resolve username → email using service role to bypass RLS
  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(supabaseUrl, serviceKey || supabaseKey);

  const { data: profile, error: profileError } = await admin
    .from("user_profile")
    .select("email")
    .eq("username", username.toLowerCase().trim())
    .single<{ email: string }>();

  if (profileError) {
    return NextResponse.json(
      { error: "Usuario no encontrado" },
      { status: 401 },
    );
  }

  // Authenticate with the resolved email
  const { error } = await supabase.auth.signInWithPassword({
    email: profile.email,
    password,
  });

  if (error) {
    return NextResponse.json(
      { error: "Credenciales incorrectas" },
      { status: 401 },
    );
  }

  return NextResponse.json({ success: true });
}
