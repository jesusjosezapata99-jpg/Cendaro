-- Cendaro ERP — Server-side idle-session tracking
-- PLAN-2026-09-SECURITY-REMEDIATION, phase F7 (finding M2)
--
-- Before this migration the idle timeout was enforced only in
-- apps/erp/src/proxy.ts, as an httpOnly cookie checked on PAGE navigations.
-- Two gaps followed from that:
--
--   1. `/api/*` (including /api/trpc) skips proxy.ts entirely ("API/tRPC
--      routes handle their own auth"), so a caller that only ever hits tRPC
--      directly — a stolen access token replayed from a script, not a
--      browser — never went through the idle check at all. The JWT stayed
--      good for its full lifetime regardless of inactivity.
--   2. The cookie is client-visible state (readable by the browser even
--      though httpOnly protects it from JS); it is evidence of activity, not
--      proof of it, and nothing on the server ever verified it against a
--      value it wrote itself.
--
-- This table gives the server its own record, keyed by the JWT's
-- `session_id` claim (a required claim on every Supabase access token, see
-- GoTrue's MinimumViableTokenSchema), checked on every authenticated tRPC
-- call in `protectedProcedure` — the single choke point every procedure
-- builder in trpc.ts is built from.
--
-- Access: infrastructure, not workspace data — same shape as
-- rate_limit_bucket/rate_limit_lockout (018/019). RLS enabled, no policy;
-- only postgres/service_role reach it, checked before `SET LOCAL ROLE
-- app_user`, on the pooled connection.
--
-- Rollback: 020_session_activity.rollback.sql

BEGIN;

CREATE TABLE IF NOT EXISTS public.user_session_activity (
  session_id   uuid        PRIMARY KEY,
  user_id      uuid        NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_session_activity IS
  'Server-verified last-activity timestamp per JWT session_id, enforced on every protectedProcedure call (F7.1).';

-- Supports "list this user's active sessions" and the eventual cleanup job.
CREATE INDEX IF NOT EXISTS idx_user_session_activity_user
  ON public.user_session_activity (user_id);
CREATE INDEX IF NOT EXISTS idx_user_session_activity_last_seen
  ON public.user_session_activity (last_seen_at);

ALTER TABLE public.user_session_activity ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.user_session_activity FROM anon, authenticated, app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_session_activity TO service_role;

COMMIT;
