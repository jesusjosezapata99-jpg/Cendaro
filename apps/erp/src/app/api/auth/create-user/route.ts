import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import type { UserRole } from "@cendaro/validators";
import { buildAuditIntegrityMetadata, isValidUuid, logger } from "@cendaro/api";
import { createSupabaseServerClient } from "@cendaro/auth/server";
import { createUserSchema } from "@cendaro/validators";

import { env } from "~/env";
import { rateLimit } from "~/lib/rate-limit";
import { isTrustedOrigin } from "~/lib/trusted-origin";

/**
 * POST /api/auth/create-user
 *
 * Creates a Supabase Auth user, its user_profile and its membership in the
 * caller's current workspace.
 *
 * Authorization comes ONLY from the database: the caller must be an active
 * owner/admin member of the target workspace (`workspace_member`). The
 * caller's `user_metadata` is never consulted — users can edit it themselves
 * through `auth.updateUser()` (PLAN-2026-09-SECURITY-REMEDIATION, C1).
 *
 * Rules:
 *   • admin can create supervisor/employee/vendor/marketing
 *   • only owner can create admin or owner
 *   • the workspace plan quota (`workspace_quota.max_users`, -1 = unlimited)
 *     is enforced on active members
 */

const AUTH_SECURITY_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
} as const;

const WORKSPACE_COOKIE = "cendaro-workspace-id";
const CREATOR_ROLES: readonly UserRole[] = ["owner", "admin"];
const OWNER_ONLY_ROLES: readonly UserRole[] = ["owner", "admin"];

function json(body: unknown, status: number, extra: HeadersInit = {}) {
  return NextResponse.json(body, {
    status,
    headers: { ...AUTH_SECURITY_HEADERS, ...extra },
  });
}

function forbidden(message: string) {
  return json({ error: message }, 403);
}

/**
 * Removes a half-created account so a failed request leaves nothing behind.
 * supabase-js reports failures as values, so every step is checked and the
 * auth user is always deleted even if an earlier cleanup step failed.
 */
async function rollbackCreatedUser(admin: SupabaseClient, userId: string) {
  const steps = [
    [
      "workspace_member",
      await admin.from("workspace_member").delete().eq("user_id", userId),
    ],
    [
      "user_profile",
      await admin.from("user_profile").delete().eq("id", userId),
    ],
    ["auth_user", await admin.auth.admin.deleteUser(userId)],
  ] as const;

  for (const [step, { error }] of steps) {
    if (error) {
      logger.error("[create-user] rollback step failed", {
        userId,
        step,
        reason: error.message,
      });
    }
  }
}

export async function POST(request: Request) {
  // ── Rate limiting (3 attempts per 60s per IP) ──
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { success: allowed, reset } = await rateLimit(`create-user:${ip}`, {
    window: 60_000,
    max: 3,
  });
  if (!allowed) {
    return json(
      { error: "Demasiados intentos. Intente de nuevo más tarde." },
      429,
      { "Retry-After": String(Math.ceil((reset - Date.now()) / 1_000)) },
    );
  }

  // ── CSRF defense in depth ──
  if (!isTrustedOrigin(request.headers, request.url)) {
    return json({ error: "Solicitud no autorizada" }, 403);
  }

  // ── Input validation ──
  const parsed = createUserSchema.safeParse(
    await request.json().catch(() => ({})),
  );
  if (!parsed.success) {
    return json(
      { error: "Datos inválidos", details: parsed.error.issues },
      400,
    );
  }
  const { username, fullName, email, password, role, phone } = parsed.data;
  const normalizedEmail = email.toLowerCase().trim();
  const normalizedUsername = username.toLowerCase().trim();

  // ── Caller session ──
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(
    cookieStore,
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  const {
    data: { user: caller },
  } = await supabase.auth.getUser();
  if (!caller) {
    return json({ error: "No autenticado" }, 401);
  }

  // ── Target workspace (explicit header, else the workspace cookie) ──
  const workspaceId =
    request.headers.get("x-workspace-id") ??
    cookieStore.get(WORKSPACE_COOKIE)?.value;
  if (!isValidUuid(workspaceId)) {
    return json({ error: "Workspace no especificado o inválido" }, 400);
  }

  // Fail closed: env validation is skipped under CI, so the key can be absent
  // at runtime. Authorization needs the service role, so no role can be
  // verified without it — the response stays generic for every caller.
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    logger.error("[create-user] SUPABASE_SERVICE_ROLE_KEY missing", {
      workspaceId,
    });
    return json({ error: "Servicio no disponible temporalmente" }, 503);
  }

  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ── Authorization from the database ──
  const [{ data: membership }, { data: callerProfile }] = await Promise.all([
    admin
      .from("workspace_member")
      .select("role")
      .eq("user_id", caller.id)
      .eq("workspace_id", workspaceId)
      .eq("status", "active")
      .maybeSingle<{ role: UserRole }>(),
    admin
      .from("user_profile")
      .select("full_name, status")
      .eq("id", caller.id)
      .maybeSingle<{ full_name: string; status: string }>(),
  ]);

  const callerRole = membership?.role;
  if (
    !callerRole ||
    !CREATOR_ROLES.includes(callerRole) ||
    callerProfile?.status !== "active"
  ) {
    return forbidden("No tienes permisos para crear usuarios");
  }
  if (OWNER_ONLY_ROLES.includes(role) && callerRole !== "owner") {
    return forbidden("Solo un dueño puede crear administradores o dueños");
  }

  // ── Plan quota ──
  const [
    { data: quota, error: quotaError },
    { count: activeMembers, error: countError },
  ] = await Promise.all([
    admin
      .from("workspace_quota")
      .select("max_users")
      .eq("workspace_id", workspaceId)
      .maybeSingle<{ max_users: number }>(),
    admin
      .from("workspace_member")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("status", "active"),
  ]);
  // Fail closed: an unreadable quota or member count must not mean "unlimited".
  if (quotaError || countError || activeMembers === null) {
    logger.error("[create-user] quota lookup failed", {
      workspaceId,
      reason: (quotaError ?? countError)?.message ?? "count unavailable",
    });
    return json({ error: "Servicio no disponible temporalmente" }, 503);
  }
  const maxUsers = quota?.max_users ?? -1;
  if (maxUsers >= 0 && activeMembers >= maxUsers) {
    return json(
      { error: "Se alcanzó el límite de usuarios del plan del workspace" },
      409,
    );
  }

  // ── Duplicate username ──
  const { data: existingUsername } = await admin
    .from("user_profile")
    .select("id")
    .eq("username", normalizedUsername)
    .maybeSingle<{ id: string }>();
  if (existingUsername) {
    return json({ error: "El nombre de usuario ya está en uso" }, 409);
  }

  // ── Auth user (no role in user_metadata: it is not a trusted source) ──
  const { data: authData, error: authError } =
    await admin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName.trim(),
        username: normalizedUsername,
      },
    });

  if (authError) {
    if (authError.message.includes("already been registered")) {
      return json({ error: "Este correo electrónico ya está registrado" }, 409);
    }
    logger.error("[create-user] auth user creation failed", {
      workspaceId,
      reason: authError.message,
    });
    return json(
      {
        error:
          "Ocurrió un error al intentar crear el usuario. Verifique los datos o contacte a soporte.",
      },
      400,
    );
  }

  const newUserId = authData.user.id;

  // The on_auth_user_created trigger already inserted a default profile, so
  // this is an upsert that sets the requested values.
  const { error: profileError } = await admin.from("user_profile").upsert(
    {
      id: newUserId,
      email: normalizedEmail,
      username: normalizedUsername,
      full_name: fullName.trim(),
      role,
      phone: phone?.trim() ?? null,
      status: "active",
    },
    { onConflict: "id" },
  );

  const { error: memberError } = profileError
    ? { error: profileError }
    : await admin.from("workspace_member").insert({
        workspace_id: workspaceId,
        user_id: newUserId,
        role,
        status: "active",
        invited_by: caller.id,
      });

  if (profileError || memberError) {
    await rollbackCreatedUser(admin, newUserId);
    const failure = profileError ?? memberError;
    if (failure?.message.includes("duplicate")) {
      return json({ error: "El usuario o correo ya existe" }, 409);
    }
    logger.error("[create-user] profile or membership insert failed", {
      workspaceId,
      reason: failure?.message,
    });
    return json({ error: "Error al crear el perfil del usuario" }, 500);
  }

  // ── Audit (a failure here must not undo the created account) ──
  const auditEntry = {
    workspaceId,
    actorId: caller.id,
    action: "user.create",
    entity: "user_profile",
    entityId: newUserId,
    newValue: { email: normalizedEmail, username: normalizedUsername, role },
  };
  const { error: auditError } = await admin.from("audit_log").insert({
    workspace_id: workspaceId,
    actor_id: caller.id,
    actor_role: callerRole,
    actor_name: callerProfile.full_name,
    action: auditEntry.action,
    entity: auditEntry.entity,
    entity_id: newUserId,
    new_value: auditEntry.newValue,
    metadata: buildAuditIntegrityMetadata(auditEntry),
  });
  if (auditError) {
    logger.error("[create-user] audit insert failed", {
      workspaceId,
      reason: auditError.message,
    });
  }

  return json(
    {
      success: true,
      user: {
        id: newUserId,
        email: normalizedEmail,
        username: normalizedUsername,
        fullName: fullName.trim(),
        role,
      },
    },
    200,
  );
}
