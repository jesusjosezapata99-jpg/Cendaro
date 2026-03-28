import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@cendaro/auth/server";
import { createUserSchema } from "@cendaro/validators";

import { env } from "~/env";
import { rateLimit } from "~/lib/rate-limit";

/**
 * POST /api/auth/create-user
 *
 * Creates a new Supabase Auth user + user_profile record.
 * Only callable by authenticated owner/admin users.
 *
 * Flow:
 * 1. Rate limit + Zod input validation
 * 2. Validate caller session (must be owner or admin)
 * 3. Create auth user via admin.createUser()
 * 4. Insert user_profile via service-role client (bypasses RLS)
 * 5. Return created user data
 */
export async function POST(request: Request) {
  // ── Rate Limiting (3 attempts per 60s per IP — stricter for user creation) ──
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { success: allowed, reset } = rateLimit(`create-user:${ip}`, {
    window: 60_000,
    max: 3,
  });
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

  // ── Zod Input Validation ──
  const parsed = createUserSchema.safeParse(
    await request.json().catch(() => ({})),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { username, fullName, email, password, role, phone } = parsed.data;

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  // Verify caller is authenticated and has owner/admin role
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(
    cookieStore,
    supabaseUrl,
    supabaseKey,
  );

  const {
    data: { user: caller },
  } = await supabase.auth.getUser();

  if (!caller) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  // Check caller role from user_metadata
  const callerRole = (caller.user_metadata as { role?: string } | undefined)
    ?.role;
  if (!callerRole || !["owner", "admin"].includes(callerRole)) {
    return NextResponse.json(
      { error: "No tienes permisos para crear usuarios" },
      { status: 403 },
    );
  }

  // Owner-protection: only owner can create another owner
  if (role === "owner" && callerRole !== "owner") {
    return NextResponse.json(
      { error: "Solo un dueño puede crear otro dueño" },
      { status: 403 },
    );
  }

  // Create admin client with service role key
  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(supabaseUrl, serviceKey);

  // Check for duplicate username
  const { data: existingUsername } = await admin
    .from("user_profile")
    .select("id")
    .eq("username", username.toLowerCase().trim())
    .single<{ id: string }>();

  if (existingUsername) {
    return NextResponse.json(
      { error: "El nombre de usuario ya está en uso" },
      { status: 409 },
    );
  }

  // Create Supabase Auth user
  const { data: authData, error: authError } =
    await admin.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password,
      email_confirm: true,
      user_metadata: { role },
    });

  if (authError) {
    // Handle duplicate email from Supabase
    if (authError.message.includes("already been registered")) {
      return NextResponse.json(
        { error: "Este correo electrónico ya está registrado" },
        { status: 409 },
      );
    }
    // Log the actual error for server audit but return a generic sanitized error to the client
    console.error("[CreateUser] Auth error:", authError);
    return NextResponse.json(
      {
        error:
          "Ocurrió un error al intentar crear el usuario. Verifique los datos o contacte a soporte.",
      },
      { status: 400 },
    );
  }

  // Insert user_profile record
  const { error: profileError } = await admin.from("user_profile").insert({
    id: authData.user.id,
    email: email.toLowerCase().trim(),
    username: username.toLowerCase().trim(),
    full_name: fullName.trim(),
    role,
    phone: phone?.trim() ?? null,
  });

  if (profileError) {
    // Rollback: delete auth user if profile insert fails
    await admin.auth.admin.deleteUser(authData.user.id);

    if (profileError.message.includes("duplicate")) {
      return NextResponse.json(
        { error: "El usuario o correo ya existe" },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: "Error al crear el perfil del usuario" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    user: {
      id: authData.user.id,
      email: email.toLowerCase().trim(),
      username: username.toLowerCase().trim(),
      fullName: fullName.trim(),
      role,
    },
  });
}
