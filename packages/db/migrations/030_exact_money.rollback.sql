-- Reverts 030_exact_money.sql. Amounts keep the rounded values.

BEGIN;

DROP TRIGGER IF EXISTS trg_sync_customer_balance ON public.account_receivable;

ALTER TABLE public.account_receivable
  ALTER COLUMN total_amount TYPE double precision,
  ALTER COLUMN paid_amount TYPE double precision,
  ALTER COLUMN balance TYPE double precision;

ALTER TABLE public.ar_installment
  ALTER COLUMN amount TYPE double precision,
  ALTER COLUMN paid_amount TYPE double precision;

ALTER TABLE public.cash_closure
  ALTER COLUMN total_sales TYPE double precision,
  ALTER COLUMN total_cash TYPE double precision,
  ALTER COLUMN total_digital TYPE double precision,
  ALTER COLUMN expected_total TYPE double precision,
  ALTER COLUMN actual_total TYPE double precision,
  ALTER COLUMN discrepancy TYPE double precision;

ALTER TABLE public.container
  ALTER COLUMN cost_fob TYPE double precision;

ALTER TABLE public.container_item
  ALTER COLUMN unit_cost TYPE double precision;

ALTER TABLE public.credit_note
  ALTER COLUMN subtotal_usd TYPE double precision,
  ALTER COLUMN tax_usd TYPE double precision,
  ALTER COLUMN total_usd TYPE double precision,
  ALTER COLUMN exchange_rate_bcv TYPE double precision,
  ALTER COLUMN total_ves TYPE double precision;

ALTER TABLE public.credit_note_item
  ALTER COLUMN unit_price_usd TYPE double precision,
  ALTER COLUMN subtotal_usd TYPE double precision;

ALTER TABLE public.customer
  ALTER COLUMN credit_limit TYPE double precision,
  ALTER COLUMN balance TYPE double precision;

ALTER TABLE public.exchange_rate
  ALTER COLUMN rate TYPE double precision;

ALTER TABLE public.fiscal_document
  ALTER COLUMN exchange_rate_bcv TYPE double precision,
  ALTER COLUMN exempt_amount_usd TYPE double precision,
  ALTER COLUMN taxable_base_16_usd TYPE double precision,
  ALTER COLUMN iva_16_usd TYPE double precision,
  ALTER COLUMN taxable_base_8_usd TYPE double precision,
  ALTER COLUMN iva_8_usd TYPE double precision,
  ALTER COLUMN igtf_base_usd TYPE double precision,
  ALTER COLUMN igtf_3_usd TYPE double precision,
  ALTER COLUMN total_usd TYPE double precision,
  ALTER COLUMN total_ves TYPE double precision,
  ALTER COLUMN iva_retention_usd TYPE double precision,
  ALTER COLUMN iva_retention_ves TYPE double precision,
  ALTER COLUMN islr_retention_pct TYPE double precision,
  ALTER COLUMN islr_retention_usd TYPE double precision,
  ALTER COLUMN retention_applied_usd TYPE double precision;

ALTER TABLE public.internal_invoice
  ALTER COLUMN subtotal TYPE double precision,
  ALTER COLUMN discount TYPE double precision,
  ALTER COLUMN tax TYPE double precision,
  ALTER COLUMN total TYPE double precision;

ALTER TABLE public.internal_invoice_item
  ALTER COLUMN unit_price TYPE double precision,
  ALTER COLUMN discount TYPE double precision,
  ALTER COLUMN line_total TYPE double precision;

ALTER TABLE public.ml_listing
  ALTER COLUMN price TYPE double precision;

ALTER TABLE public.ml_order
  ALTER COLUMN unit_price TYPE double precision;

ALTER TABLE public.order_item
  ALTER COLUMN unit_price TYPE double precision,
  ALTER COLUMN discount TYPE double precision,
  ALTER COLUMN line_total TYPE double precision;

ALTER TABLE public.payment
  ALTER COLUMN amount TYPE double precision;

ALTER TABLE public.payment_allocation
  ALTER COLUMN amount TYPE double precision;

ALTER TABLE public.price_history
  ALTER COLUMN old_amount_usd TYPE double precision,
  ALTER COLUMN new_amount_usd TYPE double precision,
  ALTER COLUMN old_amount_bs TYPE double precision,
  ALTER COLUMN new_amount_bs TYPE double precision,
  ALTER COLUMN rate_used TYPE double precision;

ALTER TABLE public.product_price
  ALTER COLUMN amount_usd TYPE double precision,
  ALTER COLUMN amount_bs TYPE double precision,
  ALTER COLUMN rate_used TYPE double precision;

ALTER TABLE public.product_supplier
  ALTER COLUMN cost TYPE double precision;

ALTER TABLE public.quote
  ALTER COLUMN subtotal TYPE double precision,
  ALTER COLUMN discount TYPE double precision,
  ALTER COLUMN total TYPE double precision;

ALTER TABLE public.quote_item
  ALTER COLUMN unit_price TYPE double precision,
  ALTER COLUMN discount TYPE double precision,
  ALTER COLUMN line_total TYPE double precision;

ALTER TABLE public.repricing_event
  ALTER COLUMN old_rate TYPE double precision,
  ALTER COLUMN new_rate TYPE double precision;

ALTER TABLE public.sales_order
  ALTER COLUMN subtotal TYPE double precision,
  ALTER COLUMN discount TYPE double precision,
  ALTER COLUMN total TYPE double precision,
  ALTER COLUMN total_paid TYPE double precision;

ALTER TABLE public.vendor_commission
  ALTER COLUMN order_total TYPE double precision,
  ALTER COLUMN commission_pct TYPE double precision,
  ALTER COLUMN commission_amount TYPE double precision;

CREATE TRIGGER trg_sync_customer_balance
  AFTER INSERT OR DELETE OR UPDATE OF balance, customer_id ON public.account_receivable
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_customer_balance();

COMMIT;
