-- Rollback for 023_fix_broken_triggers_and_sequences.sql

BEGIN;

DROP TRIGGER IF EXISTS trg_price_history ON public.product;
DROP FUNCTION IF EXISTS public.record_price_change();
DROP FUNCTION IF EXISTS public.generate_order_number();

COMMIT;
