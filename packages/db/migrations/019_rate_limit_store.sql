-- Cendaro ERP — Persistent rate-limit store
-- PLAN-2026-09-SECURITY-REMEDIATION, phase F6 (finding M1)
--
-- The limiter lived in a module-scoped Map (apps/erp/src/lib/rate-limit.ts),
-- which on Vercel means one counter per serverless instance: a burst spread
-- over N cold starts got N times the allowance, and every deploy reset every
-- lockout. These two tables move the state where all instances share it.
--
-- Algorithm (sliding window counter, the one Cloudflare documents): each key
-- keeps one row per fixed window; a request is weighted against the previous
-- window in proportion to how far the current one has advanced. It costs one
-- row per key per window instead of one row per request, and it does not have
-- the double-burst edge of a plain fixed window.
--
--   rate_limit_bucket  — request counters, one row per (key, window_start)
--   rate_limit_lockout — hard blocks after repeated auth failures
--
-- Access: both tables are infrastructure, never workspace data. RLS is enabled
-- with no policy and privileges are revoked from anon, authenticated and
-- app_user, so only the roles that bypass RLS (postgres, service_role) can
-- touch them. The limiter therefore runs outside the workspace RLS
-- transaction, on the pooled postgres connection.
--
-- Retention: rows are disposable. `expires_at` marks when a row stops being
-- meaningful; `rate_limit_gc()` deletes what is past it and is called
-- opportunistically by the application (no pg_cron dependency).
--
-- Rollback: 019_rate_limit_store.rollback.sql

BEGIN;

CREATE TABLE IF NOT EXISTS public.rate_limit_bucket (
  key          text        NOT NULL,
  window_start timestamptz NOT NULL,
  count        integer     NOT NULL DEFAULT 1,
  expires_at   timestamptz NOT NULL,
  PRIMARY KEY (key, window_start)
);

COMMENT ON TABLE public.rate_limit_bucket IS
  'Sliding-window request counters shared by every server instance (F6).';

CREATE INDEX IF NOT EXISTS idx_rate_limit_bucket_expires
  ON public.rate_limit_bucket (expires_at);

CREATE TABLE IF NOT EXISTS public.rate_limit_lockout (
  key          text        PRIMARY KEY,
  locked_until timestamptz NOT NULL,
  reason       text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.rate_limit_lockout IS
  'Hard blocks applied after repeated authentication failures (F6).';

CREATE INDEX IF NOT EXISTS idx_rate_limit_lockout_until
  ON public.rate_limit_lockout (locked_until);

-- Deletes expired counters and lockouts. Returns how many rows went away, so
-- the caller can log it. Not SECURITY DEFINER: it runs with the privileges of
-- whoever calls it, and only postgres/service_role can reach the tables.
CREATE OR REPLACE FUNCTION public.rate_limit_gc()
RETURNS integer
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  removed integer;
  removed_lockouts integer;
BEGIN
  DELETE FROM public.rate_limit_bucket WHERE expires_at < now();
  GET DIAGNOSTICS removed = ROW_COUNT;
  DELETE FROM public.rate_limit_lockout WHERE locked_until < now();
  GET DIAGNOSTICS removed_lockouts = ROW_COUNT;
  RETURN removed + removed_lockouts;
END;
$function$;

-- RLS with no policy: nothing reaches these rows except roles that bypass RLS.
ALTER TABLE public.rate_limit_bucket  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_lockout ENABLE ROW LEVEL SECURITY;

-- Postgres grants EXECUTE on new functions to PUBLIC by default, which would
-- expose rate_limit_gc through /rest/v1/rpc.
REVOKE EXECUTE ON FUNCTION public.rate_limit_gc() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rate_limit_gc() TO postgres, service_role;

REVOKE ALL ON public.rate_limit_bucket  FROM anon, authenticated, app_user;
REVOKE ALL ON public.rate_limit_lockout FROM anon, authenticated, app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rate_limit_bucket  TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rate_limit_lockout TO service_role;

COMMIT;
