-- Cendaro ERP — Order numbering and price history triggers
--
-- generate_order_number() used a sequence that no longer exists, so every
-- insert with an empty order number failed. It now takes the next number from
-- next_document_number(workspace_id, document_type), per workspace.
--
-- trg_price_history wrote columns that price_history does not have. The
-- application is the single writer of that table (it knows the user and the
-- repricing event), so the trigger and its function are removed.
--
-- Rollback: 023_fix_broken_triggers_and_sequences.rollback.sql

BEGIN;

DROP TRIGGER IF EXISTS trg_price_history ON public.product_price;
DROP FUNCTION IF EXISTS public.record_price_change();

CREATE OR REPLACE FUNCTION public.generate_order_number()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.order_number IS NULL OR btrim(NEW.order_number) = '' THEN
    NEW.order_number := public.next_document_number(NEW.workspace_id, 'order');
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.generate_order_number()
  FROM PUBLIC, anon, authenticated, app_user;

COMMIT;
