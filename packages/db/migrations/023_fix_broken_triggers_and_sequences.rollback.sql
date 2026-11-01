-- Rollback for 023_fix_broken_triggers_and_sequences.sql
-- Restores the definitions production had before this migration.

BEGIN;

CREATE OR REPLACE FUNCTION public.generate_order_number()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := 'OC-' || nextval('order_number_seq')::text;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.record_price_change()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  -- Only record if amount_usd actually changed
  IF OLD.amount_usd IS DISTINCT FROM NEW.amount_usd THEN
    INSERT INTO price_history (
      id, product_id, price_type,
      old_amount_usd, new_amount_usd,
      trigger, changed_by
    ) VALUES (
      gen_random_uuid(), NEW.product_id, NEW.price_type,
      OLD.amount_usd, NEW.amount_usd,
      'manual', (select auth.uid())
    );
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_price_history ON public.product_price;
CREATE TRIGGER trg_price_history
  AFTER UPDATE ON public.product_price
  FOR EACH ROW
  EXECUTE FUNCTION public.record_price_change();

COMMIT;
