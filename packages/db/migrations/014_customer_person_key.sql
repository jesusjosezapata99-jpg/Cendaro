-- Cendaro ERP — One customer per person per workspace
-- PLAN-2026-09-SECURITY-REMEDIATION, phase F2 (POS customer registration)
--
-- 013 made the canonical identification unique, but a natural person has two
-- valid identifications: the cédula (V-12345678) and the personal RIF built
-- from it (V-12345678-X). sales.createCustomer / updateCustomer look the
-- person up before writing, yet two cashiers registering each form at the
-- same moment could both pass that lookup. person_key maps both forms to the
-- cédula form, and its unique index closes the race in the database. It also
-- ignores the RIF check digit, so a legacy personal RIF with a wrong digit
-- still collides.
--
-- The expression is byte-identical to CUSTOMER_PERSON_KEY_SQL in
-- packages/db/src/schema.ts (guarded by customer-fiscal.test.ts) and mirrored
-- by fiscalPersonKey() in @cendaro/validators.
--
-- Pre-check (read-only, 2026-09-17): 300 customers, 0 duplicate
-- (workspace_id, person_key) pairs; the expression was evaluated in production
-- against the test vectors of customer-fiscal.test.ts.
--
-- The new constraint covers every case of uq_customer_workspace_identification
-- (equal identifications always have equal keys), so 013's constraint is
-- dropped to avoid maintaining two indexes.
--
-- Deploy order: apply before the code that selects customer.person_key.
-- Never reconcile this table with `pnpm db:push`: Postgres stores the
-- expression in its own normalized form (casts added), so drizzle-kit sees a
-- difference and would drop and re-create person_key and its constraint.
-- Hand-written migrations are the only path to production.
-- Rollback: 014_customer_person_key.rollback.sql

BEGIN;

DO $$
DECLARE
  duplicates integer;
BEGIN
  SELECT count(*) INTO duplicates
  FROM (
    SELECT 1
    FROM public.customer
    WHERE identification IS NOT NULL
    GROUP BY workspace_id,
      CASE WHEN identification ~ '^[VE]-[0-9]{8}-[0-9]$' AND substr(identification, 3, 8) <> '00000000' THEN substr(identification, 1, 2) || ltrim(substr(identification, 3, 8), '0') ELSE identification END
    HAVING count(*) > 1
  ) d;
  IF duplicates > 0 THEN
    RAISE EXCEPTION 'customer has % people registered more than once (cédula and personal RIF); merge them before applying 014', duplicates;
  END IF;
END $$;

ALTER TABLE public.customer
  ADD COLUMN person_key varchar(32)
  GENERATED ALWAYS AS (CASE WHEN identification ~ '^[VE]-[0-9]{8}-[0-9]$' AND substr(identification, 3, 8) <> '00000000' THEN substr(identification, 1, 2) || ltrim(substr(identification, 3, 8), '0') ELSE identification END) STORED;

ALTER TABLE public.customer
  ADD CONSTRAINT uq_customer_workspace_person_key
  UNIQUE (workspace_id, person_key);

ALTER TABLE public.customer
  DROP CONSTRAINT uq_customer_workspace_identification;

COMMIT;
