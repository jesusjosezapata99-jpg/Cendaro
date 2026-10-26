-- Cendaro ERP — Baseline Foundational Schema (000_initial_schema.sql)
-- PLAN-2026-10-MAESTRO-ENTERPRISE-PRODUCTION-GRADE, phase F1.2
--
-- Idempotent baseline DDL for provisioning clean CI / staging PostgreSQL
-- instances prior to applying incremental migrations 001..023.
-- Uses CREATE ROLE / CREATE TYPE / CREATE TABLE IF NOT EXISTS so running it on
-- an already-initialized database is a safe no-op.

BEGIN;

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user NOLOGIN;
  END IF;
END
$$;

-- Foundational Enums (idempotent)
DO $$ BEGIN CREATE TYPE public.user_role AS ENUM ('owner', 'admin', 'supervisor', 'employee', 'vendor', 'marketing'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.user_status AS ENUM ('active', 'inactive', 'suspended'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.erp_module AS ENUM ('dashboard', 'catalog', 'inventory', 'containers', 'pricing', 'sales', 'pos', 'quotes', 'delivery_notes', 'invoices', 'payments', 'cash_closure', 'vendors', 'customers', 'marketplace', 'whatsapp', 'users', 'settings', 'audit', 'approvals', 'alerts', 'receivables'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.permission_action AS ENUM ('view', 'create', 'edit', 'delete', 'approve', 'export', 'override'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.workspace_plan AS ENUM ('free', 'starter', 'professional', 'enterprise'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.workspace_status AS ENUM ('active', 'suspended', 'archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.workspace_member_status AS ENUM ('invited', 'active', 'suspended', 'removed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.product_status AS ENUM ('active', 'draft', 'discontinued'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.unit_of_measure AS ENUM ('unit', 'box', 'pack', 'kg', 'liter', 'meter', 'dozen', 'pair', 'roll', 'set'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.warehouse_type AS ENUM ('main', 'store', 'transit', 'quarantine'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.sales_channel AS ENUM ('store', 'mercadolibre', 'vendors', 'whatsapp', 'instagram'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.movement_type AS ENUM ('entry', 'exit', 'transfer', 'adjustment', 'sale', 'return', 'reservation', 'release'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.count_status AS ENUM ('draft', 'in_progress', 'completed', 'approved', 'rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.container_status AS ENUM ('created', 'in_transit', 'arrived_port', 'in_customs', 'released', 'in_warehouse', 'received', 'closed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.rate_type AS ENUM ('bcv_usd_ves', 'parallel_ves', 'usd_cny', 'custom'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.price_type AS ENUM ('store', 'mercadolibre', 'wholesale', 'distributor', 'min_allowed', 'promotional'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.repricing_trigger AS ENUM ('bcv_change', 'cost_change', 'manual', 'rule', 'promotion', 'import'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.order_status AS ENUM ('draft', 'pending', 'confirmed', 'preparing', 'prepared', 'dispatched', 'delivered', 'invoiced', 'cancelled', 'returned'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.payment_method AS ENUM ('mobile_payment', 'transfer', 'cash', 'pos_terminal', 'zelle', 'other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.closure_status AS ENUM ('open', 'closed', 'reviewed', 'discrepancy'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.customer_type AS ENUM ('wholesale', 'retail', 'distributor', 'vip', 'marketplace', 'vendor_client'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.ar_status AS ENUM ('pending', 'partial', 'paid', 'overdue', 'written_off'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.installment_status AS ENUM ('pending', 'partial', 'paid', 'overdue'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.ml_listing_status AS ENUM ('active', 'paused', 'closed', 'under_review', 'error'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.integration_log_level AS ENUM ('info', 'warn', 'error', 'critical'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.approval_status AS ENUM ('pending', 'approved', 'rejected', 'expired'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.approval_type AS ENUM ('price_override', 'discount_override', 'stock_adjustment', 'discrepancy_approval', 'credit_limit_override', 'order_cancellation', 'return_authorization', 'cash_discrepancy', 'repricing_approval'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.alert_type AS ENUM ('low_stock', 'negative_stock', 'exchange_rate_spike', 'overdue_receivable', 'container_delay', 'unvalidated_payment', 'cash_discrepancy', 'sync_error', 'discrepancy_detected', 'system'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.quote_status AS ENUM ('draft', 'sent', 'accepted', 'rejected', 'expired', 'converted'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.document_status AS ENUM ('draft', 'issued', 'delivered', 'cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.import_session_status AS ENUM ('pending', 'validating', 'ready', 'committing', 'committed', 'failed', 'expired'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.import_session_row_status AS ENUM ('pending', 'valid', 'warning', 'error', 'committed', 'skipped', 'failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.import_session_row_action AS ENUM ('insert', 'update', 'skip'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.notification_channel AS ENUM ('in_app', 'email', 'whatsapp'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Core Multi-Tenant & Sequential Document Helper
CREATE OR REPLACE FUNCTION public.next_document_number(
  p_workspace_id uuid,
  p_doc_type character varying,
  p_prefix character varying
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_next bigint;
BEGIN
  INSERT INTO public.document_sequence (workspace_id, doc_type, prefix, current_value, updated_at)
  VALUES (p_workspace_id, p_doc_type, p_prefix, 1, now())
  ON CONFLICT (workspace_id, doc_type)
  DO UPDATE SET
    current_value = public.document_sequence.current_value + 1,
    updated_at = now()
  RETURNING current_value INTO v_next;

  RETURN p_prefix || '-' || lpad(v_next::text, 6, '0');
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.next_document_number(uuid, character varying, character varying) FROM PUBLIC, anon, authenticated;

COMMIT;
