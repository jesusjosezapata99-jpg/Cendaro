-- Rollback of 019_rate_limit_store.sql
--
-- Deploy the code that no longer uses the persistent store FIRST: without
-- these tables the limiter falls back to per-instance memory, which is the
-- behaviour F6 replaced (one counter per serverless instance).
--
-- The rows are disposable counters and lockouts, never business data, so
-- dropping the tables loses nothing worth keeping.

BEGIN;

DROP FUNCTION IF EXISTS public.rate_limit_gc();
DROP TABLE IF EXISTS public.rate_limit_bucket;
DROP TABLE IF EXISTS public.rate_limit_lockout;

COMMIT;
