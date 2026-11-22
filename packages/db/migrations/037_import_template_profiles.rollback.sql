-- Reverts 037_import_template_profiles.sql.

BEGIN;

DROP TABLE IF EXISTS public.import_template_profile;

ALTER TABLE public.supplier
  DROP CONSTRAINT IF EXISTS uq_supplier_id_ws;

COMMIT;
