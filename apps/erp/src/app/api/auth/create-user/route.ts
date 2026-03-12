import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@cendaro/auth/server";

/**
 * POST /api/auth/create-user
 *
 * Creates a new Supabase Auth user + user_profile record.
 * Only callable by authenticated owner/admin users.
 *
 * Flow:
 * 1. Validate caller session (must be owner or admin)
 * 2. Create auth user via admin.createUser()
 * 3. Insert user_profile via service-role client (bypasses RLS)
 * 4. Return created user data
 */
export async function POST(request: Request) {
  const body = (await request.json()) as {
    username?: string;
    fullName?: string;
    email?: string;
    password?: string;
    role?: string;
    phone?: string;
  };

  const { username, fullName, email, password, role, phone } = body;

  // Validate required fields
  if (!username || !fullName || !email || !password || !role) {
    return NextResponse.json(
      { error: "Todos los campos obligatorios son requeridos" },
      { status: 400 },
    );
  }

  if (password.length < 6) {
    return NextResponse.json(
      { error: "La contraseña debe tener al menos 6 caracteres" },
      { status: 400 },
    );
  }

  const validRoles = [
    "owner",
    "admin",
    "supervisor",
    "employee",
    "vendor",
    "marketing",
  ];
  if (!validRoles.includes(role)) {
    return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (!supabaseUrl || !supabaseKey || !serviceKey) {
    return NextResponse.json(
      { error: "Configuración del servidor incompleta" },
      { status: 500 },
    );
  }

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
    return NextResponse.json({ error: authError.message }, { status: 400 });
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
