-- Rollback of 020_session_activity.sql
--
-- Deploy the code that no longer checks session activity FIRST: without this
-- table, protectedProcedure's idle-timeout check must be disabled or it will
-- reject every authenticated call.
--
-- The rows are disposable per-session heartbeats, never business data, so
-- dropping the table loses nothing worth keeping.

BEGIN;

DROP TABLE IF EXISTS public.user_session_activity;

COMMIT;
