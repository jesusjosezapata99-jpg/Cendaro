-- Cendaro ERP — Drop plaintext MercadoLibre token columns
-- PLAN-2026-09-SECURITY-REMEDIATION, phase F9.3 (finding L1)
--
-- `mercadolibre_account` stored `access_token`, `refresh_token` and
-- `token_expires_at` in plaintext. The integration that would use them was
-- never built — no code path reads or writes these columns (verified
-- 2026-09-21: zero references in packages/api and apps/erp), and RLS never
-- protects against the DBA-level access that made them a finding in the
-- first place.
--
-- Decision (user, 2026-09-16 §6.5): remove the columns now, and re-introduce
-- token storage properly (Supabase Vault or AES-GCM with
-- INTEGRATION_ENCRYPTION_KEY) when the MercadoLibre integration is actually
-- implemented.
--
-- Risk: none in application terms — the table is write-only-by-design today
-- (nickname + ml_user_id) and unused. Rollback restores the exact columns.
--
-- Classification: 🟡 STANDARD (DROP COLUMN, reversible via rollback;
-- no data preserved because no data can exist through the API).

ALTER TABLE public.mercadolibre_account
  DROP COLUMN IF EXISTS access_token,
  DROP COLUMN IF EXISTS refresh_token,
  DROP COLUMN IF EXISTS token_expires_at;
