-- Rollback of 014_customer_person_key.sql
-- Restores 013's exact-identification constraint and removes person_key.
-- Deploy the code that no longer selects customer.person_key first.

BEGIN;

ALTER TABLE public.customer
  ADD CONSTRAINT uq_customer_workspace_identification
  UNIQUE (workspace_id, identification);

ALTER TABLE public.customer
  DROP CONSTRAINT IF EXISTS uq_customer_workspace_person_key;

ALTER TABLE public.customer
  DROP COLUMN IF EXISTS person_key;

COMMIT;
