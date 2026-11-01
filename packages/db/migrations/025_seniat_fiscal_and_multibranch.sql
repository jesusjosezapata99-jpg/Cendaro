-- =============================================================================
-- Migration 025: SENIAT Fiscal Engine, Legal Entities & Multi-Branch (PRD v2.0, F11.1 & F11.2)
-- =============================================================================
-- Creates:
-- 1. `tax_classification` enum ('standard_16', 'reduced_8', 'exempt_0')
-- 2. `fiscal_document_type` enum ('factura', 'nota_credito', 'nota_debito')
-- 3. `legal_entity` table with RLS and FK covering indexes
-- 4. `branch` table with RLS and FK covering indexes
-- 5. `fiscal_document` table (SENIAT Factura/NC/ND, IVA 16%/8%/Exento, IGTF 3%,
--    IVA 75%/100% & ISLR retentions, Libro de Ventas support) with RLS and FK indexes
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE public.tax_classification AS ENUM (
    'standard_16',
    'reduced_8',
    'exempt_0'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.fiscal_document_type AS ENUM (
    'factura',
    'nota_credito',
    'nota_debito'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 1. Legal Entity (Multi-RIF / Multi-Compañía por Workspace)
CREATE TABLE IF NOT EXISTS public.legal_entity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  workspace_id uuid NOT NULL DEFAULT (current_setting('app.workspace_id'::text))::uuid REFERENCES public.workspace(id) ON DELETE CASCADE,
  rif varchar(32) NOT NULL,
  legal_name varchar(256) NOT NULL,
  trade_name varchar(256),
  fiscal_address text NOT NULL,
  taxpayer_type varchar(64) NOT NULL DEFAULT 'ordinario',
  is_special_taxpayer boolean NOT NULL DEFAULT false,
  retention_rate_pct integer NOT NULL DEFAULT 75,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_legal_entity_rif UNIQUE (workspace_id, rif)
);

CREATE INDEX IF NOT EXISTS idx_legal_entity_workspace_id ON public.legal_entity(workspace_id);

ALTER TABLE public.legal_entity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_entity FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_isolation_legal_entity ON public.legal_entity;
DROP POLICY IF EXISTS legal_entity_workspace_isolation ON public.legal_entity;
CREATE POLICY legal_entity_workspace_isolation ON public.legal_entity
  AS PERMISSIVE
  FOR ALL
  TO app_user
  USING (workspace_id = (select current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (select current_setting('app.workspace_id', true))::uuid);

GRANT SELECT, INSERT, UPDATE ON public.legal_entity TO app_user;

-- 2. Branch (Multi-Sucursal / Series de Facturación y Almacén por Defecto)
CREATE TABLE IF NOT EXISTS public.branch (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  workspace_id uuid NOT NULL DEFAULT (current_setting('app.workspace_id'::text))::uuid REFERENCES public.workspace(id) ON DELETE CASCADE,
  legal_entity_id uuid NOT NULL REFERENCES public.legal_entity(id) ON DELETE CASCADE,
  code varchar(32) NOT NULL,
  name varchar(256) NOT NULL,
  address text,
  city varchar(128),
  state varchar(128),
  phone varchar(64),
  invoice_series_prefix varchar(16) NOT NULL DEFAULT 'A',
  control_number_prefix varchar(16) NOT NULL DEFAULT '00-',
  default_warehouse_id uuid REFERENCES public.warehouse(id),
  is_main boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_branch_code UNIQUE (workspace_id, code)
);

CREATE INDEX IF NOT EXISTS idx_branch_workspace_id ON public.branch(workspace_id);
CREATE INDEX IF NOT EXISTS idx_branch_legal_entity_id ON public.branch(legal_entity_id);
CREATE INDEX IF NOT EXISTS idx_branch_default_warehouse_id ON public.branch(default_warehouse_id);

ALTER TABLE public.branch ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_isolation_branch ON public.branch;
DROP POLICY IF EXISTS branch_workspace_isolation ON public.branch;
CREATE POLICY branch_workspace_isolation ON public.branch
  AS PERMISSIVE
  FOR ALL
  TO app_user
  USING (workspace_id = (select current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (select current_setting('app.workspace_id', true))::uuid);

GRANT SELECT, INSERT, UPDATE ON public.branch TO app_user;

-- 3. Fiscal Document (SENIAT Providencia 0071 / Imprenta Digital / Libro de Ventas)
CREATE TABLE IF NOT EXISTS public.fiscal_document (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  workspace_id uuid NOT NULL DEFAULT (current_setting('app.workspace_id'::text))::uuid REFERENCES public.workspace(id),
  legal_entity_id uuid REFERENCES public.legal_entity(id),
  branch_id uuid REFERENCES public.branch(id),
  order_id uuid REFERENCES public.sales_order(id),
  internal_invoice_id uuid REFERENCES public.internal_invoice(id),
  credit_note_id uuid REFERENCES public.credit_note(id),
  customer_id uuid REFERENCES public.customer(id),
  document_type public.fiscal_document_type NOT NULL DEFAULT 'factura',
  fiscal_invoice_number varchar(64) NOT NULL,
  control_number varchar(64) NOT NULL,
  affected_invoice_number varchar(64),
  buyer_rif varchar(32) NOT NULL,
  buyer_legal_name varchar(256) NOT NULL,
  buyer_address text,
  exchange_rate_bcv double precision NOT NULL DEFAULT 1,
  exempt_amount_usd double precision NOT NULL DEFAULT 0,
  taxable_base_16_usd double precision NOT NULL DEFAULT 0,
  iva_16_usd double precision NOT NULL DEFAULT 0,
  taxable_base_8_usd double precision NOT NULL DEFAULT 0,
  iva_8_usd double precision NOT NULL DEFAULT 0,
  igtf_base_usd double precision NOT NULL DEFAULT 0,
  igtf_3_usd double precision NOT NULL DEFAULT 0,
  total_usd double precision NOT NULL DEFAULT 0,
  total_ves double precision NOT NULL DEFAULT 0,
  iva_retention_pct integer NOT NULL DEFAULT 0,
  iva_retention_voucher varchar(64),
  iva_retention_usd double precision NOT NULL DEFAULT 0,
  iva_retention_ves double precision NOT NULL DEFAULT 0,
  islr_retention_pct double precision NOT NULL DEFAULT 0,
  islr_retention_voucher varchar(64),
  islr_retention_usd double precision NOT NULL DEFAULT 0,
  issued_by uuid REFERENCES public.user_profile(id),
  issued_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_fiscal_document_control_number UNIQUE (workspace_id, control_number)
);

CREATE INDEX IF NOT EXISTS idx_fiscal_document_workspace_id ON public.fiscal_document(workspace_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_document_legal_entity_id ON public.fiscal_document(legal_entity_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_document_branch_id ON public.fiscal_document(branch_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_document_order_id ON public.fiscal_document(order_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_document_internal_invoice_id ON public.fiscal_document(internal_invoice_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_document_credit_note_id ON public.fiscal_document(credit_note_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_document_customer_id ON public.fiscal_document(customer_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_document_issued_by ON public.fiscal_document(issued_by);
CREATE INDEX IF NOT EXISTS idx_fiscal_document_issued_at ON public.fiscal_document(workspace_id, issued_at DESC);

ALTER TABLE public.fiscal_document ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_document FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_isolation_fiscal_document ON public.fiscal_document;
DROP POLICY IF EXISTS fiscal_document_workspace_isolation ON public.fiscal_document;
CREATE POLICY fiscal_document_workspace_isolation ON public.fiscal_document
  AS PERMISSIVE
  FOR ALL
  TO app_user
  USING (workspace_id = (select current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (select current_setting('app.workspace_id', true))::uuid);

REVOKE ALL ON public.legal_entity, public.branch, public.fiscal_document FROM app_user;
GRANT SELECT, INSERT, UPDATE ON public.legal_entity, public.branch, public.fiscal_document TO app_user;

-- 4. Fiscal documents are immutable: only retention data may change afterwards,
-- and corrections go through a credit or debit note.
ALTER TABLE public.fiscal_document
  ADD COLUMN IF NOT EXISTS retention_applied_usd double precision NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS uq_fiscal_document_invoice_number
  ON public.fiscal_document (workspace_id, legal_entity_id, fiscal_invoice_number);

CREATE OR REPLACE FUNCTION public.protect_fiscal_document()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
DECLARE
  retention_columns text[] := ARRAY[
    'iva_retention_pct', 'iva_retention_voucher', 'iva_retention_usd',
    'iva_retention_ves', 'islr_retention_pct', 'islr_retention_voucher',
    'islr_retention_usd', 'retention_applied_usd'
  ];
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'fiscal documents cannot be deleted';
  END IF;
  IF (to_jsonb(NEW) - retention_columns) IS DISTINCT FROM (to_jsonb(OLD) - retention_columns) THEN
    RAISE EXCEPTION 'fiscal documents are immutable except for retention data';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.protect_fiscal_document()
  FROM PUBLIC, anon, authenticated, app_user;

DROP TRIGGER IF EXISTS trg_protect_fiscal_document ON public.fiscal_document;
CREATE TRIGGER trg_protect_fiscal_document
  BEFORE UPDATE OR DELETE ON public.fiscal_document
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_fiscal_document();
