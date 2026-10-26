-- Cendaro ERP — Fix broken legacy triggers and sequences
-- PLAN-2026-10-MAESTRO-ENTERPRISE-PRODUCTION-GRADE, phase F1.1
--
-- Fixes two latent database defects identified during the full schema audit:
--
-- 1. public.record_price_change() (and trg_price_history on public.product):
--    The legacy function attempted to INSERT INTO price_history (product_id,
--    old_price, new_price, changed_by) — columns that do not exist on
--    public.price_history (which uses workspace_id, product_id, price_type,
--    old_amount_usd, new_amount_usd, trigger, user_id) — and was attached to
--    public.product even though prices live in public.product_price.
--    We drop the broken trigger on public.product and replace
--    public.record_price_change() with a schema-aligned implementation for
--    public.product_price.
--
-- 2. public.generate_order_number():
--    Referenced non-existent sequence public.order_number_seq. The application
--    now generates per-workspace sequential document numbers via
--    public.next_document_number(p_workspace_id, p_doc_type, p_prefix).
--    We replace generate_order_number() to delegate to next_document_number
--    using NEW.workspace_id when NEW.order_number is null or empty.
--
-- Rollback: 023_fix_broken_triggers_and_sequences.rollback.sql

BEGIN;

DROP TRIGGER IF EXISTS trg_price_history ON public.product;

CREATE OR REPLACE FUNCTION public.record_price_change()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.amount_usd IS DISTINCT FROM NEW.amount_usd THEN
    INSERT INTO public.price_history (
      workspace_id,
      product_id,
      price_type,
      old_amount_usd,
      new_amount_usd,
      old_amount_bs,
      new_amount_bs,
      rate_used,
      trigger,
      user_id
    ) VALUES (
      NEW.workspace_id,
      NEW.product_id,
      NEW.price_type,
      OLD.amount_usd,
      NEW.amount_usd,
      OLD.amount_bs,
      NEW.amount_bs,
      NEW.rate_used,
      'manual'::public.repricing_trigger,
      NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    );
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.record_price_change()
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.generate_order_number()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.order_number IS NULL OR btrim(NEW.order_number) = '' THEN
    NEW.order_number := public.next_document_number(
      NEW.workspace_id,
      'order',
      'ORD'
    );
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.generate_order_number()
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.record_price_change(),
  public.generate_order_number()
TO app_user;

COMMIT;
