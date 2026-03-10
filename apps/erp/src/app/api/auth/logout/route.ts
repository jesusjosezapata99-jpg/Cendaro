import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@cendaro/auth/server";

export async function POST() {
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
  const supabase = createSupabaseServerClient(
    cookieStore,
    supabaseUrl,
    supabaseKey,
  );

  await supabase.auth.signOut();

  return NextResponse.json({ success: true });
}
