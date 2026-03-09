import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@cendaro/auth/server";

export async function POST(request: Request) {
  const body = (await request.json()) as { username?: string; password?: string };
  const { username, password } = body;

  if (!username || !password) {
    return NextResponse.json(
      { error: "Usuario y contraseña son requeridos" },
      { status: 400 },
    );
  }

  // eslint-disable-next-line no-restricted-properties
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  // eslint-disable-next-line no-restricted-properties
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  // eslint-disable-next-line no-restricted-properties
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: "Configuración del servidor incompleta" },
      { status: 500 },
    );
  }

  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore, supabaseUrl, supabaseKey);

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
