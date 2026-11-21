-- Cendaro ERP — Exact money: amounts, unit prices, rates and percentages move
-- from double precision to numeric. Weights, volumes, conversion factors and
-- confidence scores stay double precision: they are measurements, not money.
--
-- A column named in UPDATE OF cannot change type, so that trigger is recreated.
--
-- Rollback: 030_exact_money.rollback.sql

BEGIN;

DROP TRIGGER IF EXISTS trg_sync_customer_balance ON public.account_receivable;

ALTER TABLE public.account_receivable
  ALTER COLUMN total_amount TYPE numeric(14,2) USING round(total_amount::numeric, 2),
  ALTER COLUMN paid_amount TYPE numeric(14,2) USING round(paid_amount::numeric, 2),
  ALTER COLUMN balance TYPE numeric(14,2) USING round(balance::numeric, 2);

ALTER TABLE public.ar_installment
  ALTER COLUMN amount TYPE numeric(14,2) USING round(amount::numeric, 2),
  ALTER COLUMN paid_amount TYPE numeric(14,2) USING round(paid_amount::numeric, 2);

ALTER TABLE public.cash_closure
  ALTER COLUMN total_sales TYPE numeric(14,2) USING round(total_sales::numeric, 2),
  ALTER COLUMN total_cash TYPE numeric(14,2) USING round(total_cash::numeric, 2),
  ALTER COLUMN total_digital TYPE numeric(14,2) USING round(total_digital::numeric, 2),
  ALTER COLUMN expected_total TYPE numeric(14,2) USING round(expected_total::numeric, 2),
  ALTER COLUMN actual_total TYPE numeric(14,2) USING round(actual_total::numeric, 2),
  ALTER COLUMN discrepancy TYPE numeric(14,2) USING round(discrepancy::numeric, 2);

ALTER TABLE public.container
  ALTER COLUMN cost_fob TYPE numeric(14,2) USING round(cost_fob::numeric, 2);

ALTER TABLE public.container_item
  ALTER COLUMN unit_cost TYPE numeric(14,4) USING round(unit_cost::numeric, 4);

ALTER TABLE public.credit_note
  ALTER COLUMN subtotal_usd TYPE numeric(14,2) USING round(subtotal_usd::numeric, 2),
  ALTER COLUMN tax_usd TYPE numeric(14,2) USING round(tax_usd::numeric, 2),
  ALTER COLUMN total_usd TYPE numeric(14,2) USING round(total_usd::numeric, 2),
  ALTER COLUMN exchange_rate_bcv TYPE numeric(18,6) USING round(exchange_rate_bcv::numeric, 6),
  ALTER COLUMN total_ves TYPE numeric(18,2) USING round(total_ves::numeric, 2);

ALTER TABLE public.credit_note_item
  ALTER COLUMN unit_price_usd TYPE numeric(14,4) USING round(unit_price_usd::numeric, 4),
  ALTER COLUMN subtotal_usd TYPE numeric(14,2) USING round(subtotal_usd::numeric, 2);

ALTER TABLE public.customer
  ALTER COLUMN credit_limit TYPE numeric(14,2) USING round(credit_limit::numeric, 2),
  ALTER COLUMN balance TYPE numeric(14,2) USING round(balance::numeric, 2);

ALTER TABLE public.exchange_rate
  ALTER COLUMN rate TYPE numeric(18,6) USING round(rate::numeric, 6);

ALTER TABLE public.fiscal_document
  ALTER COLUMN exchange_rate_bcv TYPE numeric(18,6) USING round(exchange_rate_bcv::numeric, 6),
  ALTER COLUMN exempt_amount_usd TYPE numeric(14,2) USING round(exempt_amount_usd::numeric, 2),
  ALTER COLUMN taxable_base_16_usd TYPE numeric(14,2) USING round(taxable_base_16_usd::numeric, 2),
  ALTER COLUMN iva_16_usd TYPE numeric(14,2) USING round(iva_16_usd::numeric, 2),
  ALTER COLUMN taxable_base_8_usd TYPE numeric(14,2) USING round(taxable_base_8_usd::numeric, 2),
  ALTER COLUMN iva_8_usd TYPE numeric(14,2) USING round(iva_8_usd::numeric, 2),
  ALTER COLUMN igtf_base_usd TYPE numeric(14,2) USING round(igtf_base_usd::numeric, 2),
  ALTER COLUMN igtf_3_usd TYPE numeric(14,2) USING round(igtf_3_usd::numeric, 2),
  ALTER COLUMN total_usd TYPE numeric(14,2) USING round(total_usd::numeric, 2),
  ALTER COLUMN total_ves TYPE numeric(18,2) USING round(total_ves::numeric, 2),
  ALTER COLUMN iva_retention_usd TYPE numeric(14,2) USING round(iva_retention_usd::numeric, 2),
  ALTER COLUMN iva_retention_ves TYPE numeric(18,2) USING round(iva_retention_ves::numeric, 2),
  ALTER COLUMN islr_retention_pct TYPE numeric(7,4) USING round(islr_retention_pct::numeric, 4),
  ALTER COLUMN islr_retention_usd TYPE numeric(14,2) USING round(islr_retention_usd::numeric, 2),
  ALTER COLUMN retention_applied_usd TYPE numeric(14,2) USING round(retention_applied_usd::numeric, 2);

ALTER TABLE public.internal_invoice
  ALTER COLUMN subtotal TYPE numeric(14,2) USING round(subtotal::numeric, 2),
  ALTER COLUMN discount TYPE numeric(14,2) USING round(discount::numeric, 2),
  ALTER COLUMN tax TYPE numeric(14,2) USING round(tax::numeric, 2),
  ALTER COLUMN total TYPE numeric(14,2) USING round(total::numeric, 2);

ALTER TABLE public.internal_invoice_item
  ALTER COLUMN unit_price TYPE numeric(14,4) USING round(unit_price::numeric, 4),
  ALTER COLUMN discount TYPE numeric(14,2) USING round(discount::numeric, 2),
  ALTER COLUMN line_total TYPE numeric(14,2) USING round(line_total::numeric, 2);

ALTER TABLE public.ml_listing
  ALTER COLUMN price TYPE numeric(14,4) USING round(price::numeric, 4);

ALTER TABLE public.ml_order
  ALTER COLUMN unit_price TYPE numeric(14,4) USING round(unit_price::numeric, 4);

ALTER TABLE public.order_item
  ALTER COLUMN unit_price TYPE numeric(14,4) USING round(unit_price::numeric, 4),
  ALTER COLUMN discount TYPE numeric(14,2) USING round(discount::numeric, 2),
  ALTER COLUMN line_total TYPE numeric(14,2) USING round(line_total::numeric, 2);

ALTER TABLE public.payment
  ALTER COLUMN amount TYPE numeric(14,2) USING round(amount::numeric, 2);

ALTER TABLE public.payment_allocation
  ALTER COLUMN amount TYPE numeric(14,2) USING round(amount::numeric, 2);

ALTER TABLE public.price_history
  ALTER COLUMN old_amount_usd TYPE numeric(14,4) USING round(old_amount_usd::numeric, 4),
  ALTER COLUMN new_amount_usd TYPE numeric(14,4) USING round(new_amount_usd::numeric, 4),
  ALTER COLUMN old_amount_bs TYPE numeric(18,2) USING round(old_amount_bs::numeric, 2),
  ALTER COLUMN new_amount_bs TYPE numeric(18,2) USING round(new_amount_bs::numeric, 2),
  ALTER COLUMN rate_used TYPE numeric(18,6) USING round(rate_used::numeric, 6);

ALTER TABLE public.product_price
  ALTER COLUMN amount_usd TYPE numeric(14,4) USING round(amount_usd::numeric, 4),
  ALTER COLUMN amount_bs TYPE numeric(18,2) USING round(amount_bs::numeric, 2),
  ALTER COLUMN rate_used TYPE numeric(18,6) USING round(rate_used::numeric, 6);

ALTER TABLE public.product_supplier
  ALTER COLUMN cost TYPE numeric(14,4) USING round(cost::numeric, 4);

ALTER TABLE public.quote
  ALTER COLUMN subtotal TYPE numeric(14,2) USING round(subtotal::numeric, 2),
  ALTER COLUMN discount TYPE numeric(14,2) USING round(discount::numeric, 2),
  ALTER COLUMN total TYPE numeric(14,2) USING round(total::numeric, 2);

ALTER TABLE public.quote_item
  ALTER COLUMN unit_price TYPE numeric(14,4) USING round(unit_price::numeric, 4),
  ALTER COLUMN discount TYPE numeric(14,2) USING round(discount::numeric, 2),
  ALTER COLUMN line_total TYPE numeric(14,2) USING round(line_total::numeric, 2);

ALTER TABLE public.repricing_event
  ALTER COLUMN old_rate TYPE numeric(18,6) USING round(old_rate::numeric, 6),
  ALTER COLUMN new_rate TYPE numeric(18,6) USING round(new_rate::numeric, 6);

ALTER TABLE public.sales_order
  ALTER COLUMN subtotal TYPE numeric(14,2) USING round(subtotal::numeric, 2),
  ALTER COLUMN discount TYPE numeric(14,2) USING round(discount::numeric, 2),
  ALTER COLUMN total TYPE numeric(14,2) USING round(total::numeric, 2),
  ALTER COLUMN total_paid TYPE numeric(14,2) USING round(total_paid::numeric, 2);

ALTER TABLE public.vendor_commission
  ALTER COLUMN order_total TYPE numeric(14,2) USING round(order_total::numeric, 2),
  ALTER COLUMN commission_pct TYPE numeric(7,4) USING round(commission_pct::numeric, 4),
  ALTER COLUMN commission_amount TYPE numeric(14,2) USING round(commission_amount::numeric, 2);

CREATE TRIGGER trg_sync_customer_balance
  AFTER INSERT OR DELETE OR UPDATE OF balance, customer_id ON public.account_receivable
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_customer_balance();

COMMIT;
