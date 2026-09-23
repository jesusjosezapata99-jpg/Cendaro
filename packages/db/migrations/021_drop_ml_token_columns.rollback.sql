-- Rollback for 021_drop_ml_token_columns.sql (F9.3, finding L1).
-- Restores the columns exactly as they were: nullable text/timestamptz,
-- no defaults, no constraints. Any tokens dropped by 021 are NOT recoverable
-- — by 2026-09-21 none could exist through the application.

ALTER TABLE public.mercadolibre_account
  ADD COLUMN IF NOT EXISTS access_token text,
  ADD COLUMN IF NOT EXISTS refresh_token text,
  ADD COLUMN IF NOT EXISTS token_expires_at timestamptz;
