-- =============================================================================
-- Migration 024: Credit Notes (PRD v2.0 §3.1) & WORM Audit Hash Chain (F10.1)
-- =============================================================================

-- 1. Add cryptographic hash-chain columns to audit_log
ALTER TABLE public.audit_log
  ADD COLUMN IF NOT EXISTS prev_hash text,
  ADD COLUMN IF NOT EXISTS chain_hash text;

CREATE INDEX IF NOT EXISTS idx_audit_log_workspace_created
  ON public.audit_log (workspace_id, created_at DESC);

-- 2. Create credit_note_status enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'credit_note_status') THEN
    CREATE TYPE public.credit_note_status AS ENUM (
      'draft',
      'pending_approval',
      'approved',
      'applied',
      'cancelled'
    );
  END IF;
END
$$;

-- 3. Create credit_note table
CREATE TABLE IF NOT EXISTS public.credit_note (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspace(id) DEFAULT (current_setting('app.workspace_id')::uuid),
  credit_note_number varchar(32) NOT NULL,
  order_id uuid NOT NULL REFERENCES public.sales_order(id),
  internal_invoice_id uuid REFERENCES public.internal_invoice(id),
  customer_id uuid REFERENCES public.customer(id),
  status public.credit_note_status NOT NULL DEFAULT 'pending_approval',
  reason text NOT NULL,
  return_to_stock boolean NOT NULL DEFAULT true,
  warehouse_id uuid REFERENCES public.warehouse(id),
  subtotal_usd double precision NOT NULL DEFAULT 0,
  tax_usd double precision NOT NULL DEFAULT 0,
  total_usd double precision NOT NULL DEFAULT 0,
  exchange_rate_bcv double precision NOT NULL DEFAULT 1,
  total_ves double precision NOT NULL DEFAULT 0,
  refund_method public.payment_method,
  external_refund_reference varchar(128),
  requested_by uuid REFERENCES public.user_profile(id),
  approved_by uuid REFERENCES public.user_profile(id),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz,
  CONSTRAINT uq_credit_note_number UNIQUE (workspace_id, credit_note_number)
);

CREATE INDEX IF NOT EXISTS idx_credit_note_workspace_id ON public.credit_note (workspace_id);
CREATE INDEX IF NOT EXISTS idx_credit_note_order_id ON public.credit_note (order_id);
CREATE INDEX IF NOT EXISTS idx_credit_note_internal_invoice_id ON public.credit_note (internal_invoice_id);
CREATE INDEX IF NOT EXISTS idx_credit_note_customer_id ON public.credit_note (customer_id);
CREATE INDEX IF NOT EXISTS idx_credit_note_warehouse_id ON public.credit_note (warehouse_id);
CREATE INDEX IF NOT EXISTS idx_credit_note_requested_by ON public.credit_note (requested_by);
CREATE INDEX IF NOT EXISTS idx_credit_note_approved_by ON public.credit_note (approved_by);
CREATE INDEX IF NOT EXISTS idx_credit_note_status ON public.credit_note (status);

ALTER TABLE public.credit_note ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_note FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS credit_note_workspace_isolation ON public.credit_note;
CREATE POLICY credit_note_workspace_isolation ON public.credit_note
  AS PERMISSIVE FOR ALL TO app_user
  USING (workspace_id = (select current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (select current_setting('app.workspace_id', true))::uuid);

GRANT SELECT, INSERT, UPDATE ON public.credit_note TO app_user;

-- 4. Create credit_note_item table
CREATE TABLE IF NOT EXISTS public.credit_note_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspace(id) DEFAULT (current_setting('app.workspace_id')::uuid),
  credit_note_id uuid NOT NULL REFERENCES public.credit_note(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.product(id),
  quantity integer NOT NULL,
  unit_price_usd double precision NOT NULL,
  subtotal_usd double precision NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_credit_note_item_workspace_id ON public.credit_note_item (workspace_id);
CREATE INDEX IF NOT EXISTS idx_credit_note_item_credit_note_id ON public.credit_note_item (credit_note_id);
CREATE INDEX IF NOT EXISTS idx_credit_note_item_product_id ON public.credit_note_item (product_id);

ALTER TABLE public.credit_note_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_note_item FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS credit_note_item_workspace_isolation ON public.credit_note_item;
CREATE POLICY credit_note_item_workspace_isolation ON public.credit_note_item
  AS PERMISSIVE FOR ALL TO app_user
  USING (workspace_id = (select current_setting('app.workspace_id', true))::uuid)
  WITH CHECK (workspace_id = (select current_setting('app.workspace_id', true))::uuid);

GRANT SELECT, INSERT, UPDATE ON public.credit_note_item TO app_user;
