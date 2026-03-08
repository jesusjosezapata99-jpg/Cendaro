import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@cendaro/auth/server";

export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string; password?: string };
  const { email, password } = body;

  if (!email || !password) {
    return NextResponse.json(
      { error: "Correo y contraseña son requeridos" },
      { status: 400 },
    );
  }

  // eslint-disable-next-line no-restricted-properties
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  // eslint-disable-next-line no-restricted-properties
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: "Configuración del servidor incompleta" },
      { status: 500 },
    );
  }

  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore, supabaseUrl, supabaseKey);

  const { error } = await supabase.auth.signInWithPassword({
    email,
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
