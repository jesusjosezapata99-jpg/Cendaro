-- Rollback of 013_customer_identification_unique.sql
-- Removes the constraint; sales.createCustomer keeps its application-level
-- duplicate check.

BEGIN;

ALTER TABLE public.customer
  DROP CONSTRAINT IF EXISTS uq_customer_workspace_identification;

COMMIT;
