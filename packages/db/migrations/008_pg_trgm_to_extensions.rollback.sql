-- Rollback of 008_pg_trgm_to_extensions.sql — returns pg_trgm to public and
-- removes the USAGE grant app_user did not have before (baseline 2026-09-15).

BEGIN;

ALTER EXTENSION pg_trgm SET SCHEMA public;
REVOKE USAGE ON SCHEMA extensions FROM app_user;

COMMIT;
