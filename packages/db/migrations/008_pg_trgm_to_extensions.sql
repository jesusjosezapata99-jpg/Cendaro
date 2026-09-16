-- Cendaro ERP — Move pg_trgm out of the public schema
-- PLAN-2026-09-PROD-HARDENING, phase F8 (finding H10)
--
-- pg_trgm lived in public (advisor lint 0014 extension_in_public), which puts
-- its 31 functions and 10 operators next to the application objects exposed
-- by the Data API. Supabase's documented remediation is
-- ALTER EXTENSION ... SET SCHEMA extensions; the extension is owned by
-- supabase_admin and relocated through supautils (pg_trgm is a privileged
-- extension).
--
-- What keeps working:
--   * The 3 GIN indexes on product (name/sku/barcode) reference the opclass by
--     OID, so they survive the move untouched.
--   * Unqualified similarity() in catalog-import.ts resolves through the
--     search_path. The API connects as postgres, whose role-level search_path
--     is "$user", public, extensions; SET LOCAL ROLE app_user keeps it.
--   * No view, column default, expression index or function body references
--     pg_trgm (read-only inventory, 2026-09-15).
--
-- What had to be added: app_user had no USAGE on schema extensions, so after
-- the move similarity() would stop resolving for it and catalog import would
-- silently lose its category suggestions (the query runs in a savepoint and
-- only logs a warning). The GRANT is part of the same transaction.
--
-- Rollback: 008_pg_trgm_to_extensions.rollback.sql

BEGIN;

GRANT USAGE ON SCHEMA extensions TO app_user;
ALTER EXTENSION pg_trgm SET SCHEMA extensions;

COMMIT;
