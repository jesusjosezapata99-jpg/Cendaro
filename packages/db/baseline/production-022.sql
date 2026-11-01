-- Production schema as of migration 022, exported read-only with pg_dump 17.6
-- (--schema-only --schema=public --no-owner) on 2026-11-01. It carries no data.
--
-- A fresh database is built from this file plus migrations 023 onward. Earlier
-- numbered files remain as history: they assume objects provisioned outside git.

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: alert_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.alert_type AS ENUM (
    'low_stock',
    'inventory_diff',
    'product_blocked',
    'rate_change',
    'vendor_under_target',
    'order_late',
    'ml_failure',
    'ar_overdue'
);


--
-- Name: approval_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.approval_status AS ENUM (
    'pending',
    'approved',
    'rejected',
    'expired'
);


--
-- Name: approval_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.approval_type AS ENUM (
    'credit_sale',
    'inventory_adjustment',
    'channel_stock_move',
    'product_unblock',
    'price_change',
    'container_close',
    'cash_closure',
    'edit_post_issue_document'
);


--
-- Name: ar_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ar_status AS ENUM (
    'pending',
    'partial',
    'paid',
    'overdue',
    'written_off'
);


--
-- Name: closure_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.closure_status AS ENUM (
    'open',
    'closed',
    'reviewed'
);


--
-- Name: container_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.container_status AS ENUM (
    'created',
    'in_transit',
    'received',
    'closed'
);


--
-- Name: count_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.count_status AS ENUM (
    'draft',
    'in_progress',
    'completed',
    'approved'
);


--
-- Name: customer_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.customer_type AS ENUM (
    'wholesale',
    'retail',
    'distributor',
    'vip',
    'marketplace',
    'vendor_client'
);


--
-- Name: document_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.document_status AS ENUM (
    'draft',
    'issued',
    'cancelled'
);


--
-- Name: erp_module; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.erp_module AS ENUM (
    'dashboard',
    'catalog',
    'inventory',
    'containers',
    'pricing',
    'rates',
    'pos',
    'orders',
    'customers',
    'vendors',
    'payments',
    'cash_closure',
    'receivables',
    'marketplace',
    'whatsapp',
    'users',
    'audit',
    'settings'
);


--
-- Name: import_session_row_action; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.import_session_row_action AS ENUM (
    'insert',
    'update',
    'skip'
);


--
-- Name: import_session_row_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.import_session_row_status AS ENUM (
    'pending',
    'valid',
    'warning',
    'error',
    'committed',
    'skipped',
    'failed'
);


--
-- Name: import_session_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.import_session_status AS ENUM (
    'pending',
    'validating',
    'category_mapping',
    'dry_run',
    'committed',
    'failed',
    'expired'
);


--
-- Name: installment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.installment_status AS ENUM (
    'pending',
    'paid',
    'overdue',
    'partially_paid'
);


--
-- Name: integration_log_level; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.integration_log_level AS ENUM (
    'info',
    'warning',
    'error',
    'critical'
);


--
-- Name: member_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.member_status AS ENUM (
    'active',
    'invited',
    'suspended',
    'removed'
);


--
-- Name: ml_listing_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ml_listing_status AS ENUM (
    'active',
    'paused',
    'closed',
    'out_of_stock',
    'error'
);


--
-- Name: movement_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.movement_type AS ENUM (
    'purchase',
    'sale',
    'transfer',
    'adjustment_in',
    'adjustment_out',
    'return',
    'container_receipt',
    'count_adjustment',
    'initial_stock'
);


--
-- Name: notification_bucket_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.notification_bucket_type AS ENUM (
    'finance',
    'operations',
    'inventory',
    'sales',
    'integrations',
    'general'
);


--
-- Name: order_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.order_status AS ENUM (
    'draft',
    'pending',
    'pending_confirmation',
    'confirmed',
    'prepared',
    'dispatched',
    'delivered',
    'invoiced',
    'cancelled',
    'returned'
);


--
-- Name: payment_method; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payment_method AS ENUM (
    'mobile_payment',
    'transfer',
    'cash',
    'pos_terminal',
    'zelle'
);


--
-- Name: permission_action; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.permission_action AS ENUM (
    'create',
    'read',
    'update',
    'delete',
    'approve',
    'export'
);


--
-- Name: price_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.price_type AS ENUM (
    'store',
    'wholesale',
    'vendor',
    'promo',
    'special'
);


--
-- Name: product_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.product_status AS ENUM (
    'active',
    'draft',
    'discontinued'
);


--
-- Name: quote_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.quote_status AS ENUM (
    'draft',
    'sent',
    'accepted',
    'rejected',
    'expired',
    'converted'
);


--
-- Name: rate_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.rate_type AS ENUM (
    'bcv',
    'parallel',
    'rmb_usd',
    'rmb_bs'
);


--
-- Name: repricing_trigger; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.repricing_trigger AS ENUM (
    'auto',
    'manual',
    'scheduled'
);


--
-- Name: sales_channel; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sales_channel AS ENUM (
    'store',
    'mercadolibre',
    'vendors',
    'whatsapp',
    'instagram'
);


--
-- Name: supplier_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.supplier_status AS ENUM (
    'active',
    'inactive'
);


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role AS ENUM (
    'owner',
    'admin',
    'supervisor',
    'employee',
    'vendor',
    'marketing'
);


--
-- Name: user_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_status AS ENUM (
    'active',
    'inactive',
    'suspended'
);


--
-- Name: warehouse_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.warehouse_type AS ENUM (
    'showroom',
    'warehouse',
    'external',
    'transit',
    'reserved',
    'defective'
);


--
-- Name: workspace_plan; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.workspace_plan AS ENUM (
    'starter',
    'pro',
    'enterprise'
);


--
-- Name: workspace_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.workspace_status AS ENUM (
    'active',
    'suspended',
    'archived'
);


--
-- Name: enforce_workspace_quota(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_workspace_quota() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  cur_count INTEGER;
  max_limit INTEGER;
BEGIN
  -- Count current active members
  SELECT count(*) INTO cur_count
  FROM public.workspace_member
  WHERE workspace_id = NEW.workspace_id
    AND status = 'active';

  -- Get quota limit
  SELECT max_users INTO max_limit
  FROM public.workspace_quota
  WHERE workspace_id = NEW.workspace_id;

  -- Enforce limit (NULL max_limit = unlimited)
  IF max_limit IS NOT NULL AND cur_count >= max_limit THEN
    RAISE EXCEPTION 'Workspace user limit reached (% / %)', cur_count, max_limit
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: find_active_user_id_by_email(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.find_active_user_id_by_email(p_email text) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT p.id
  FROM public.user_profile p
  WHERE lower(p.email) = lower(btrim(p_email))
    AND p.status = 'active'
  LIMIT 1;
$$;


--
-- Name: generate_order_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_order_number() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := 'OC-' || nextval('order_number_seq')::text;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
  INSERT INTO public.user_profile (
    id,
    email,
    full_name,
    username,
    role,
    status
  ) VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name',
      split_part(COALESCE(NEW.email, ''), '@', 1)
    ),
    COALESCE(
      NEW.raw_user_meta_data ->> 'username',
      split_part(COALESCE(NEW.email, ''), '@', 1)
    ),
    'employee'::public.user_role,
    'active'::public.user_status
  );
  RETURN NEW;
END;
$$;


--
-- Name: is_workspace_member(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_workspace_member(p_user_id uuid, p_workspace_id uuid) RETURNS TABLE(member_id uuid, member_role text, member_status text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT m.id, m.role::text, m.status::text
  FROM public.workspace_member m
  JOIN public.user_profile p
    ON p.id = m.user_id
   AND p.status = 'active'
  JOIN public.workspace w
    ON w.id = m.workspace_id
   AND w.status = 'active'
  WHERE m.user_id = p_user_id
    AND m.workspace_id = p_workspace_id
    AND m.status = 'active'
  LIMIT 1;
$$;


--
-- Name: next_document_number(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.next_document_number(p_workspace_id uuid, p_document_type text) RETURNS text
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_prefix TEXT;
  v_next   INTEGER;
  v_lock   BIGINT;
BEGIN
  -- Advisory lock scoped to workspace + document type
  v_lock := hashtext(p_workspace_id::text || p_document_type);
  PERFORM pg_advisory_xact_lock(v_lock);

  -- Determine prefix from document type
  v_prefix := CASE p_document_type
    WHEN 'order'         THEN 'ORD'
    WHEN 'quote'         THEN 'COT'
    WHEN 'delivery_note' THEN 'GDE'
    WHEN 'invoice'       THEN 'FAC'
    WHEN 'container'     THEN 'CNT'
    ELSE UPPER(LEFT(p_document_type, 3))
  END;

  -- Upsert and get next number atomically
  INSERT INTO public.document_sequence (workspace_id, document_type, last_number)
  VALUES (p_workspace_id, p_document_type, 1)
  ON CONFLICT (workspace_id, document_type)
  DO UPDATE SET last_number = document_sequence.last_number + 1
  RETURNING last_number INTO v_next;

  RETURN v_prefix || '-' || LPAD(v_next::text, 6, '0');
END;
$$;


--
-- Name: rate_limit_gc(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rate_limit_gc() RETURNS integer
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  removed integer;
  removed_lockouts integer;
BEGIN
  DELETE FROM public.rate_limit_bucket WHERE expires_at < now();
  GET DIAGNOSTICS removed = ROW_COUNT;
  DELETE FROM public.rate_limit_lockout WHERE locked_until < now();
  GET DIAGNOSTICS removed_lockouts = ROW_COUNT;
  RETURN removed + removed_lockouts;
END;
$$;


--
-- Name: record_price_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_price_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: rls_auto_enable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


--
-- Name: touch_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_ar_on_payment(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_ar_on_payment() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Apply the payment to the open receivable of the same order and workspace
  -- (SECURITY DEFINER bypasses RLS, so the workspace is matched explicitly).
  -- Fully paid (within half a cent of float8 rounding) → 'paid' with a zero
  -- balance; a partial payment on a 'pending' receivable → 'partial'; an
  -- overdue receivable stays 'overdue' until it is paid, so it keeps showing
  -- as overdue. payment.amount is expressed in USD.
  UPDATE account_receivable
  SET
    paid_amount = paid_amount + NEW.amount,
    balance = CASE
      WHEN balance - NEW.amount <= 0.005 THEN 0
      ELSE balance - NEW.amount
    END,
    status = CASE
      WHEN balance - NEW.amount <= 0.005 THEN 'paid'::ar_status
      WHEN status = 'pending' THEN 'partial'::ar_status
      ELSE status
    END
  WHERE order_id = NEW.order_id
    AND workspace_id = NEW.workspace_id
    AND status IN ('pending', 'partial', 'overdue');

  RETURN NEW;
END;
$$;


--
-- Name: user_membership_count(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_membership_count(p_user_id uuid) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT count(*)::integer
  FROM public.workspace_member m
  WHERE m.user_id = p_user_id
    AND m.status IN ('active', 'suspended');
$$;


--
-- Name: validate_stock_quantity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_stock_quantity() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.quantity < 0 THEN
    RAISE EXCEPTION 'Stock quantity cannot be negative. Product: %, Warehouse: %, Attempted: %',
      NEW.product_id, NEW.warehouse_id, NEW.quantity;
  END IF;
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: account_receivable; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_receivable (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    order_id uuid,
    total_amount double precision NOT NULL,
    paid_amount double precision DEFAULT 0 NOT NULL,
    balance double precision NOT NULL,
    status public.ar_status DEFAULT 'pending'::public.ar_status NOT NULL,
    due_date timestamp with time zone NOT NULL,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    workspace_id uuid DEFAULT (current_setting('app.workspace_id'::text))::uuid NOT NULL
);


--
-- Name: ai_prompt_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_prompt_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    config_key character varying(64) NOT NULL,
    system_prompt text NOT NULL,
    few_shot_examples jsonb DEFAULT '[]'::jsonb NOT NULL,
    business_context text,
    category_rules text,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    workspace_id uuid DEFAULT (current_setting('app.workspace_id'::text))::uuid NOT NULL
);


--
-- Name: approval; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approval (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    approval_type public.approval_type NOT NULL,
    status public.approval_status DEFAULT 'pending'::public.approval_status NOT NULL,
    entity_type character varying(64) NOT NULL,
    entity_id uuid NOT NULL,
    requested_by uuid NOT NULL,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_by uuid,
    resolved_at timestamp with time zone,
    reason text,
    metadata jsonb,
    expires_at timestamp with time zone,
    workspace_id uuid DEFAULT (current_setting('app.workspace_id'::text))::uuid NOT NULL
);


--
-- Name: ar_installment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ar_installment (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    receivable_id uuid NOT NULL,
    installment_number integer NOT NULL,
    amount double precision NOT NULL,
    due_date timestamp with time zone NOT NULL,
    status public.installment_status DEFAULT 'pending'::public.installment_status NOT NULL,
    paid_amount double precision DEFAULT 0,
    paid_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    workspace_id uuid DEFAULT (current_setting('app.workspace_id'::text))::uuid NOT NULL
);


--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_id uuid,
    actor_role public.user_role,
    actor_name character varying(256),
    action character varying(128) NOT NULL,
    entity character varying(64) NOT NULL,
    entity_id uuid,
    old_value jsonb,
    new_value jsonb,
    metadata jsonb,
    correlation_id uuid,
    ip_address character varying(45),
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    workspace_id uuid DEFAULT (current_setting('app.workspace_id'::text))::uuid NOT NULL
);


--
-- Name: brand; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.brand (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(256) NOT NULL,
    slug character varying(256) NOT NULL,
    logo_url text,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    workspace_id uuid DEFAULT (current_setting('app.workspace_id'::text))::uuid NOT NULL
);


--
-- Name: cash_closure; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cash_closure (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    closure_date timestamp with time zone NOT NULL,
    status public.closure_status DEFAULT 'open'::public.closure_status NOT NULL,
    total_sales double precision DEFAULT 0,
    total_cash double precision DEFAULT 0,
    total_digital double precision DEFAULT 0,
    expected_total double precision DEFAULT 0,
    actual_total double precision DEFAULT 0,
    discrepancy double precision DEFAULT 0,
    notes text,
    closed_by uuid,
    reviewed_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    workspace_id uuid DEFAULT (current_setting('app.workspace_id'::text))::uuid NOT NULL
);


--
-- Name: category; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.category (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(256) NOT NULL,
    slug character varying(256) NOT NULL,
    parent_id uuid,
    depth integer DEFAULT 0 NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    attributes_template jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    workspace_id uuid DEFAULT (current_setting('app.workspace_id'::text))::uuid NOT NULL
);


--
-- Name: category_alias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.category_alias (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    alias character varying(256) NOT NULL,
    category_id uuid NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    workspace_id uuid DEFAULT (current_setting('app.workspace_id'::text))::uuid NOT NULL
);


--
-- Name: channel_allocation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_allocation (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    channel public.sales_channel NOT NULL,
    quantity integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    workspace_id uuid DEFAULT (current_setting('app.workspace_id'::text))::uuid NOT NULL
);


--
-- Name: container; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.container (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    container_number character varying(64) NOT NULL,
    supplier_id uuid,
    status public.container_status DEFAULT 'created'::public.container_status NOT NULL,
    departure_date timestamp with time zone,
    arrival_date timestamp with time zone,
    cost_fob double precision,
    notes text,
    closed_by uuid,
    closed_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    packing_list_url text,
    packing_list_status character varying(32) DEFAULT 'none'::character varying NOT NULL,
    packing_list_processed_at timestamp with time zone,
    packing_list_item_count integer DEFAULT 0 NOT NULL,
    workspace_id uuid DEFAULT (current_setting('app.workspace_id'::text))::uuid NOT NULL
);


--
-- Name: container_document; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.container_document (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    container_id uuid NOT NULL,
    document_type character varying(64) NOT NULL,
    file_url text NOT NULL,
    file_name character varying(256),
    uploaded_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    workspace_id uuid DEFAULT (current_setting('app.workspace_id'::text))::uuid NOT NULL
);


--
-- Name: container_item; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.container_item (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    container_id uuid NOT NULL,
    product_id uuid,
    quantity_expected integer NOT NULL,
    quantity_received integer DEFAULT 0,
    unit_cost double precision,
    notes text,
    original_name text,
    translated_name text,
    weight_kg double precision,
    sku_hint character varying(128),
    category_hint character varying(256),
    is_matched boolean DEFAULT false NOT NULL,
    confidence double precision,
    suggested_product_id uuid,
    ai_corrected boolean DEFAULT false NOT NULL,
    image_url text,
    image_description text,
    match_type character varying(32),
    workspace_id uuid DEFAULT (current_setting('app.workspace_id'::text))::uuid NOT NULL
);


--
-- Name: customer; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(256) NOT NULL,
    legal_name character varying(512),
    identification character varying(32),
    customer_type public.customer_type DEFAULT 'retail'::public.customer_type NOT NULL,
    phone character varying(32),
    phone2 character varying(32),
    email character varying(256),
    address text,
    assigned_vendor_id uuid,
    credit_limit double precision DEFAULT 0,
    credit_days integer DEFAULT 0,
    balance double precision DEFAULT 0,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    workspace_id uuid DEFAULT (current_setting('app.workspace_id'::text))::uuid NOT NULL,
    person_key character varying(32) GENERATED ALWAYS AS (
CASE
    WHEN (((identification)::text ~ '^[VE]-[0-9]{8}-[0-9]$'::text) AND (substr((identification)::text, 3, 8) <> '00000000'::text)) THEN ((substr((identification)::text, 1, 2) || ltrim(substr((identification)::text, 3, 8), '0'::text)))::character varying
    ELSE identification
END) STORED
);


--
-- Name: customer_address; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_address (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    label character varying(64) DEFAULT 'principal'::character varying NOT NULL,
    address_line text NOT NULL,
    city character varying(128),
    state character varying(128),
    zip character varying(16),
    country character varying(64) DEFAULT 'VE'::character varying,
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    workspace_id uuid DEFAULT (current_setting('app.workspace_id'::text))::uuid NOT NULL
);


--
-- Name: delivery_note; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delivery_note (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    note_number character varying(32) NOT NULL,
    order_id uuid NOT NULL,
    status public.document_status DEFAULT 'draft'::public.document_status NOT NULL,
    delivery_address text,
    recipient_name character varying(256),
    recipient_id_doc character varying(32),
    dispatched_at timestamp with time zone,
    delivered_at timestamp with time zone,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    workspace_id uuid DEFAULT (current_setting('app.workspace_id'::text))::uuid NOT NULL
);


--
-- Name: delivery_note_item; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delivery_note_item (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    delivery_note_id uuid NOT NULL,
    product_id uuid NOT NULL,
    quantity_dispatched integer NOT NULL,
    quantity_delivered integer DEFAULT 0,
    notes text,
    workspace_id uuid DEFAULT (current_setting('app.workspace_id'::text))::uuid NOT NULL
);


--
-- Name: document_sequence; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_sequence (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid DEFAULT (current_setting('app.workspace_id'::text))::uuid NOT NULL,
    document_type character varying(32) NOT NULL,
    last_number integer DEFAULT 0 NOT NULL
);


--
-- Name: exchange_rate; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exchange_rate (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rate_type public.rate_type NOT NULL,
    rate double precision NOT NULL,
    source character varying(128),
    notes text,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    workspace_id uuid DEFAULT (current_setting('app.workspace_id'::text))::uuid NOT NULL
);


--
-- Name: import_session; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.import_session (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type character varying(32) DEFAULT 'catalog'::character varying NOT NULL,
    status public.import_session_status DEFAULT 'pending'::public.import_session_status NOT NULL,
    filename character varying(256),
    file_hash character varying(64),
    total_rows integer DEFAULT 0 NOT NULL,
    valid_rows integer DEFAULT 0 NOT NULL,
    error_rows integer DEFAULT 0 NOT NULL,
    inserted integer DEFAULT 0 NOT NULL,
    updated integer DEFAULT 0 NOT NULL,
    skipped integer DEFAULT 0 NOT NULL,
    failed integer DEFAULT 0 NOT NULL,
    idempotency_key uuid,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    committed_at timestamp with time zone,
    expires_at timestamp with time zone DEFAULT (now() + '24:00:00'::interval) NOT NULL,
    workspace_id uuid DEFAULT (current_setting('app.workspace_id'::text))::uuid NOT NULL
);


--
-- Name: import_session_row; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.import_session_row (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    import_session_id uuid NOT NULL,
    row_index integer NOT NULL,
    status public.import_session_row_status DEFAULT 'pending'::public.import_session_row_status NOT NULL,
    action public.import_session_row_action,
    raw_data jsonb NOT NULL,
    normalized_data jsonb,
    resolved_category_id uuid,
    resolved_brand_id uuid,
    resolved_product_id uuid,
    errors jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    workspace_id uuid DEFAULT (current_setting('app.workspace_id'::text))::uuid NOT NULL
);


--
-- Name: integration_failure; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.integration_failure (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source character varying(64) NOT NULL,
    error_code character varying(64),
    error_message text NOT NULL,
    payload jsonb,
    retry_count integer DEFAULT 0 NOT NULL,
    max_retries integer DEFAULT 3 NOT NULL,
    is_resolved boolean DEFAULT false NOT NULL,
    resolved_by uuid,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    workspace_id uuid DEFAULT (current_setting('app.workspace_id'::text))::uuid NOT NULL
);


--
-- Name: integration_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.integration_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source character varying(32) NOT NULL,
    level public.integration_log_level DEFAULT 'info'::public.integration_log_level NOT NULL,
    message text NOT NULL,
    payload text,
    is_resolved boolean DEFAULT false,
    resolved_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    workspace_id uuid DEFAULT (current_setting('app.workspace_id'::text))::uuid NOT NULL
);


--
-- Name: internal_invoice; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.internal_invoice (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_number character varying(32) NOT NULL,
    order_id uuid NOT NULL,
    customer_id uuid,
    status public.document_status DEFAULT 'draft'::public.document_status NOT NULL,
    subtotal double precision DEFAULT 0 NOT NULL,
    discount double precision DEFAULT 0,
    tax double precision DEFAULT 0,
    total double precision DEFAULT 0 NOT NULL,
    issued_at timestamp with time zone,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    workspace_id uuid DEFAULT (current_setting('app.workspace_id'::text))::uuid NOT NULL
);


--
-- Name: internal_invoice_item; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.internal_invoice_item (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_id uuid NOT NULL,
    product_id uuid NOT NULL,
    quantity integer NOT NULL,
    unit_price double precision NOT NULL,
    discount double precision DEFAULT 0,
    line_total double precision NOT NULL,
    workspace_id uuid DEFAULT (current_setting('app.workspace_id'::text))::uuid NOT NULL
);


--
-- Name: inventory_count; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_count (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    warehouse_id uuid NOT NULL,
    status public.count_status DEFAULT 'draft'::public.count_status NOT NULL,
    scheduled_at timestamp with time zone,
    completed_at timestamp with time zone,
    approved_by uuid,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    workspace_id uuid DEFAULT (current_setting('app.workspace_id'::text))::uuid NOT NULL
);


--
-- Name: inventory_count_item; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_count_item (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    count_id uuid NOT NULL,
    product_id uuid NOT NULL,
    system_qty integer DEFAULT 0 NOT NULL,
    counted_qty integer,
    difference integer,
    notes text,
    workspace_id uuid DEFAULT (current_setting('app.workspace_id'::text))::uuid NOT NULL
);


--
-- Name: inventory_discrepancy; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_discrepancy (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    count_id uuid NOT NULL,
    product_id uuid NOT NULL,
    system_qty integer NOT NULL,
    counted_qty integer NOT NULL,
    difference integer NOT NULL,
    resolution text,
    resolved_by uuid,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    workspace_id uuid DEFAULT (current_setting('app.workspace_id'::text))::uuid NOT NULL
);


--
-- Name: mercadolibre_account; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mercadolibre_account (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nickname character varying(128) NOT NULL,
    ml_user_id character varying(64),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    workspace_id uuid DEFAULT (current_setting('app.workspace_id'::text))::uuid NOT NULL
);


--
-- Name: mercadolibre_order_event; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mercadolibre_order_event (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ml_order_id uuid,
    event_type character varying(64) NOT NULL,
    payload jsonb,
    processed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    workspace_id uuid DEFAULT (current_setting('app.workspace_id'::text))::uuid NOT NULL
);


--
-- Name: ml_listing; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ml_listing (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    ml_item_id character varying(64) NOT NULL,
    title character varying(512) NOT NULL,
    status public.ml_listing_status DEFAULT 'active'::public.ml_listing_status NOT NULL,
    price double precision NOT NULL,
    stock_synced integer DEFAULT 0,
    permalink text,
    last_sync_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    workspace_id uuid DEFAULT (current_setting('app.workspace_id'::text))::uuid NOT NULL
);


--
-- Name: ml_order; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ml_order (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ml_order_id character varying(64) NOT NULL,
    ml_listing_id uuid,
    sales_order_id uuid,
    buyer_nickname character varying(128),
    quantity integer DEFAULT 1 NOT NULL,
    unit_price double precision NOT NULL,
    shipping_status character varying(64),
    tracking_number character varying(128),
    is_imported boolean DEFAULT false,
    imported_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    workspace_id uuid DEFAULT (current_setting('app.workspace_id'::text))::uuid NOT NULL
);


--
-- Name: notification_bucket; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_bucket (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid DEFAULT (current_setting('app.workspace_id'::text))::uuid NOT NULL,
    bucket public.notification_bucket_type NOT NULL,
    label character varying(128),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: notification_bucket_assignee; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_bucket_assignee (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid DEFAULT (current_setting('app.workspace_id'::text))::uuid NOT NULL,
    bucket_id uuid NOT NULL,
    member_id uuid NOT NULL
);


--
-- Name: notification_routing_rule; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_routing_rule (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid DEFAULT (current_setting('app.workspace_id'::text))::uuid NOT NULL,
    alert_type public.alert_type NOT NULL,
    bucket_id uuid NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: order_item; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_item (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    product_id uuid NOT NULL,
    quantity integer NOT NULL,
    unit_price double precision NOT NULL,
    discount double precision DEFAULT 0,
    line_total double precision NOT NULL,
    workspace_id uuid DEFAULT (current_setting('app.workspace_id'::text))::uuid NOT NULL
);


--
-- Name: organization; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(256) NOT NULL,
    legal_name character varying(512),
    rif character varying(32),
    currency character varying(3) DEFAULT 'USD'::character varying NOT NULL,
    timezone character varying(64) DEFAULT 'America/Caracas'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone
);


--
-- Name: payment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    method public.payment_method NOT NULL,
    amount double precision NOT NULL,
    reference character varying(128),
    bank_name character varying(128),
    payer_name character varying(256),
    payer_id_doc character varying(32),
    evidence_url text,
    is_validated boolean DEFAULT false,
    validated_by uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    workspace_id uuid DEFAULT (current_setting('app.workspace_id'::text))::uuid NOT NULL
);


--
-- Name: payment_allocation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_allocation (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    payment_id uuid NOT NULL,
    receivable_id uuid NOT NULL,
    amount double precision NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    workspace_id uuid DEFAULT (current_setting('app.workspace_id'::text))::uuid NOT NULL
);


--
-- Name: payment_evidence; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_evidence (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    payment_id uuid NOT NULL,
    evidence_url text NOT NULL,
    evidence_type character varying(32) DEFAULT 'image'::character varying NOT NULL,
    uploaded_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    workspace_id uuid DEFAULT (current_setting('app.workspace_id'::text))::uuid NOT NULL
);


--
-- Name: permission; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permission (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    module public.erp_module NOT NULL,
    action public.permission_action NOT NULL,
    description character varying(512)
);


--
-- Name: price_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.price_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    price_type public.price_type NOT NULL,
    old_amount_usd double precision,
    new_amount_usd double precision NOT NULL,
    old_amount_bs double precision,
    new_amount_bs double precision,
    rate_used double precision,
    trigger public.repricing_trigger NOT NULL,
    user_id uuid,
    repricing_event_id uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    workspace_id uuid DEFAULT (current_setting('app.workspace_id'::text))::uuid NOT NULL
);


--
-- Name: pricing_rule; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pricing_rule (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(128) NOT NULL,
    rule_type character varying(32) NOT NULL,
    conditions jsonb DEFAULT '{}'::jsonb NOT NULL,
    adjustments jsonb DEFAULT '{}'::jsonb NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    valid_from timestamp with time zone,
    valid_until timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    workspace_id uuid DEFAULT (current_setting('app.workspace_id'::text))::uuid NOT NULL
);


--
-- Name: product; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sku character varying(64) NOT NULL,
    barcode character varying(128),
    name character varying(512) NOT NULL,
    description_short character varying(512),
    description_long text,
    brand_id uuid,
    category_id uuid,
    supplier_id uuid,
    image_url text,
    weight double precision,
    volume double precision,
    cost_avg numeric(12,4) DEFAULT '0'::numeric,
    status public.product_status DEFAULT 'draft'::public.product_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    base_uom character varying(32) DEFAULT 'unit'::character varying NOT NULL,
    units_per_box integer,
    boxes_per_bulk integer,
    selling_unit character varying(32) DEFAULT 'unit'::character varying NOT NULL,
    presentation_qty integer DEFAULT 1 NOT NULL,
    workspace_id uuid DEFAULT (current_setting('app.workspace_id'::text))::uuid NOT NULL
);


--
-- Name: product_attribute; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_attribute (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    key character varying(128) NOT NULL,
    value character varying(512) NOT NULL,
    workspace_id uuid DEFAULT (current_setting('app.workspace_id'::text))::uuid NOT NULL
);


--
-- Name: product_price; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_price (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    price_type public.price_type NOT NULL,
    amount_usd double precision NOT NULL,
    amount_bs double precision,
    rate_used double precision,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    workspace_id uuid DEFAULT (current_setting('app.workspace_id'::text))::uuid NOT NULL
);


--
-- Name: product_supplier; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_supplier (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    supplier_id uuid NOT NULL,
    supplier_sku character varying(128),
    cost double precision,
    lead_time_days integer,
    is_primary boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    workspace_id uuid DEFAULT (current_setting('app.workspace_id'::text))::uuid NOT NULL
);


--
-- Name: product_uom_equivalence; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_uom_equivalence (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    base_uom character varying(32) DEFAULT 'unit'::character varying NOT NULL,
    alt_uom character varying(32) NOT NULL,
    conversion_factor double precision DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    workspace_id uuid DEFAULT (current_setting('app.workspace_id'::text))::uuid NOT NULL
);


--
-- Name: quote; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quote (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quote_number character varying(32) NOT NULL,
    customer_id uuid,
    status public.quote_status DEFAULT 'draft'::public.quote_status NOT NULL,
    channel public.sales_channel DEFAULT 'store'::public.sales_channel NOT NULL,
    subtotal double precision DEFAULT 0 NOT NULL,
    discount double precision DEFAULT 0,
    total double precision DEFAULT 0 NOT NULL,
    valid_until timestamp with time zone,
    converted_order_id uuid,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    workspace_id uuid DEFAULT (current_setting('app.workspace_id'::text))::uuid NOT NULL
);


--
-- Name: quote_item; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quote_item (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quote_id uuid NOT NULL,
    product_id uuid NOT NULL,
    quantity integer NOT NULL,
    unit_price double precision NOT NULL,
    discount double precision DEFAULT 0,
    line_total double precision NOT NULL,
    workspace_id uuid DEFAULT (current_setting('app.workspace_id'::text))::uuid NOT NULL
);


--
-- Name: rate_limit_bucket; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rate_limit_bucket (
    key text NOT NULL,
    window_start timestamp with time zone NOT NULL,
    count integer DEFAULT 1 NOT NULL,
    expires_at timestamp with time zone NOT NULL
);


--
-- Name: rate_limit_lockout; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rate_limit_lockout (
    key text NOT NULL,
    locked_until timestamp with time zone NOT NULL,
    reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: repricing_event; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.repricing_event (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    trigger public.repricing_trigger NOT NULL,
    rate_type public.rate_type,
    old_rate double precision,
    new_rate double precision,
    variation_pct double precision,
    products_affected integer DEFAULT 0 NOT NULL,
    is_approved boolean DEFAULT false,
    approved_by uuid,
    approved_at timestamp with time zone,
    expires_at timestamp with time zone,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    workspace_id uuid DEFAULT (current_setting('app.workspace_id'::text))::uuid NOT NULL
);


--
-- Name: role_permission; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_permission (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    role public.user_role NOT NULL,
    permission_id uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_by uuid
);


--
-- Name: sales_order; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_order (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_number character varying(32) NOT NULL,
    customer_id uuid,
    channel public.sales_channel DEFAULT 'store'::public.sales_channel NOT NULL,
    status public.order_status DEFAULT 'pending'::public.order_status NOT NULL,
    subtotal double precision DEFAULT 0 NOT NULL,
    discount double precision DEFAULT 0,
    total double precision DEFAULT 0 NOT NULL,
    total_paid double precision DEFAULT 0,
    notes text,
    closed_by uuid,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    stock_deducted boolean DEFAULT false NOT NULL,
    workspace_id uuid DEFAULT (current_setting('app.workspace_id'::text))::uuid NOT NULL
);


--
-- Name: signature; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.signature (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    approval_id uuid NOT NULL,
    signed_by uuid NOT NULL,
    role public.user_role NOT NULL,
    action character varying(32) NOT NULL,
    ip_address character varying(45),
    signed_at timestamp with time zone DEFAULT now() NOT NULL,
    workspace_id uuid DEFAULT (current_setting('app.workspace_id'::text))::uuid NOT NULL
);


--
-- Name: stock_ledger; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_ledger (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    warehouse_id uuid NOT NULL,
    quantity integer DEFAULT 0 NOT NULL,
    is_locked boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    workspace_id uuid DEFAULT (current_setting('app.workspace_id'::text))::uuid NOT NULL
);


--
-- Name: stock_movement; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_movement (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    movement_type public.movement_type NOT NULL,
    quantity integer NOT NULL,
    from_channel public.sales_channel,
    to_channel public.sales_channel,
    warehouse_id uuid,
    reference_id uuid,
    reference_type character varying(64),
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    workspace_id uuid DEFAULT (current_setting('app.workspace_id'::text))::uuid NOT NULL
);


--
-- Name: supplier; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supplier (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(256) NOT NULL,
    rif character varying(32),
    country character varying(3) DEFAULT 'CN'::character varying NOT NULL,
    contact_name character varying(256),
    contact_email character varying(256),
    contact_phone character varying(32),
    status public.supplier_status DEFAULT 'active'::public.supplier_status NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    workspace_id uuid DEFAULT (current_setting('app.workspace_id'::text))::uuid NOT NULL
);


--
-- Name: system_alert; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_alert (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    alert_type public.alert_type NOT NULL,
    title character varying(256) NOT NULL,
    message text NOT NULL,
    severity character varying(16) DEFAULT 'medium'::character varying NOT NULL,
    entity_type character varying(64),
    entity_id uuid,
    is_dismissed boolean DEFAULT false,
    dismissed_by uuid,
    dismissed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    workspace_id uuid DEFAULT (current_setting('app.workspace_id'::text))::uuid NOT NULL
);


--
-- Name: user_profile; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_profile (
    id uuid NOT NULL,
    email character varying(256) NOT NULL,
    full_name character varying(256) NOT NULL,
    role public.user_role DEFAULT 'employee'::public.user_role NOT NULL,
    status public.user_status DEFAULT 'active'::public.user_status NOT NULL,
    phone character varying(32),
    avatar_url text,
    organization_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    last_login_at timestamp with time zone,
    username character varying(128) NOT NULL,
    default_workspace_id uuid,
    ui_preferences jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: user_session_activity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_session_activity (
    session_id uuid NOT NULL,
    user_id uuid NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: vendor_commission; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vendor_commission (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vendor_id uuid NOT NULL,
    order_id uuid NOT NULL,
    order_total double precision NOT NULL,
    commission_pct double precision DEFAULT 0 NOT NULL,
    commission_amount double precision DEFAULT 0 NOT NULL,
    is_paid boolean DEFAULT false,
    paid_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    workspace_id uuid DEFAULT (current_setting('app.workspace_id'::text))::uuid NOT NULL
);


--
-- Name: warehouse; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.warehouse (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(256) NOT NULL,
    type public.warehouse_type NOT NULL,
    location character varying(512),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    workspace_id uuid DEFAULT (current_setting('app.workspace_id'::text))::uuid NOT NULL
);


--
-- Name: warehouse_location; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.warehouse_location (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    warehouse_id uuid NOT NULL,
    code character varying(32) NOT NULL,
    description character varying(256),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    workspace_id uuid DEFAULT (current_setting('app.workspace_id'::text))::uuid NOT NULL
);


--
-- Name: workspace; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    name character varying(256) NOT NULL,
    slug character varying(128) NOT NULL,
    plan public.workspace_plan DEFAULT 'starter'::public.workspace_plan NOT NULL,
    status public.workspace_status DEFAULT 'active'::public.workspace_status NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone
);


--
-- Name: workspace_member; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_member (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid DEFAULT (current_setting('app.workspace_id'::text))::uuid NOT NULL,
    user_id uuid NOT NULL,
    role public.user_role DEFAULT 'employee'::public.user_role NOT NULL,
    status public.member_status DEFAULT 'active'::public.member_status NOT NULL,
    invited_by uuid,
    joined_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: workspace_module; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_module (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid DEFAULT (current_setting('app.workspace_id'::text))::uuid NOT NULL,
    module public.erp_module NOT NULL,
    enabled_at timestamp with time zone DEFAULT now() NOT NULL,
    enabled_by uuid
);


--
-- Name: workspace_profile; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_profile (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid DEFAULT (current_setting('app.workspace_id'::text))::uuid NOT NULL,
    display_name character varying(256),
    legal_name character varying(512),
    tax_id character varying(64),
    logo_url text,
    address_line text,
    city character varying(128),
    state character varying(128),
    country character varying(64) DEFAULT 'VE'::character varying,
    phone character varying(32),
    support_email character varying(256),
    base_currency character varying(3) DEFAULT 'USD'::character varying NOT NULL,
    updated_at timestamp with time zone
);


--
-- Name: workspace_quota; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_quota (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid DEFAULT (current_setting('app.workspace_id'::text))::uuid NOT NULL,
    max_users integer DEFAULT 1 NOT NULL,
    max_products integer DEFAULT 500 NOT NULL,
    max_customers integer DEFAULT 50 NOT NULL,
    max_warehouses integer DEFAULT 1 NOT NULL,
    max_storage_mb integer DEFAULT 500 NOT NULL,
    max_users_per_role jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: account_receivable account_receivable_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_receivable
    ADD CONSTRAINT account_receivable_pkey PRIMARY KEY (id);


--
-- Name: ai_prompt_config ai_prompt_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_prompt_config
    ADD CONSTRAINT ai_prompt_config_pkey PRIMARY KEY (id);


--
-- Name: approval approval_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval
    ADD CONSTRAINT approval_pkey PRIMARY KEY (id);


--
-- Name: ar_installment ar_installment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ar_installment
    ADD CONSTRAINT ar_installment_pkey PRIMARY KEY (id);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: brand brand_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand
    ADD CONSTRAINT brand_pkey PRIMARY KEY (id);


--
-- Name: cash_closure cash_closure_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_closure
    ADD CONSTRAINT cash_closure_pkey PRIMARY KEY (id);


--
-- Name: category_alias category_alias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_alias
    ADD CONSTRAINT category_alias_pkey PRIMARY KEY (id);


--
-- Name: category category_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category
    ADD CONSTRAINT category_pkey PRIMARY KEY (id);


--
-- Name: channel_allocation channel_allocation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_allocation
    ADD CONSTRAINT channel_allocation_pkey PRIMARY KEY (id);


--
-- Name: container_document container_document_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.container_document
    ADD CONSTRAINT container_document_pkey PRIMARY KEY (id);


--
-- Name: container_item container_item_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.container_item
    ADD CONSTRAINT container_item_pkey PRIMARY KEY (id);


--
-- Name: container container_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.container
    ADD CONSTRAINT container_pkey PRIMARY KEY (id);


--
-- Name: customer_address customer_address_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_address
    ADD CONSTRAINT customer_address_pkey PRIMARY KEY (id);


--
-- Name: customer customer_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer
    ADD CONSTRAINT customer_pkey PRIMARY KEY (id);


--
-- Name: delivery_note_item delivery_note_item_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_note_item
    ADD CONSTRAINT delivery_note_item_pkey PRIMARY KEY (id);


--
-- Name: delivery_note delivery_note_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_note
    ADD CONSTRAINT delivery_note_pkey PRIMARY KEY (id);


--
-- Name: document_sequence document_sequence_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_sequence
    ADD CONSTRAINT document_sequence_pkey PRIMARY KEY (id);


--
-- Name: exchange_rate exchange_rate_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exchange_rate
    ADD CONSTRAINT exchange_rate_pkey PRIMARY KEY (id);


--
-- Name: import_session import_session_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.import_session
    ADD CONSTRAINT import_session_pkey PRIMARY KEY (id);


--
-- Name: import_session_row import_session_row_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.import_session_row
    ADD CONSTRAINT import_session_row_pkey PRIMARY KEY (id);


--
-- Name: integration_failure integration_failure_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_failure
    ADD CONSTRAINT integration_failure_pkey PRIMARY KEY (id);


--
-- Name: integration_log integration_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_log
    ADD CONSTRAINT integration_log_pkey PRIMARY KEY (id);


--
-- Name: internal_invoice_item internal_invoice_item_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internal_invoice_item
    ADD CONSTRAINT internal_invoice_item_pkey PRIMARY KEY (id);


--
-- Name: internal_invoice internal_invoice_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internal_invoice
    ADD CONSTRAINT internal_invoice_pkey PRIMARY KEY (id);


--
-- Name: inventory_count_item inventory_count_item_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_count_item
    ADD CONSTRAINT inventory_count_item_pkey PRIMARY KEY (id);


--
-- Name: inventory_count inventory_count_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_count
    ADD CONSTRAINT inventory_count_pkey PRIMARY KEY (id);


--
-- Name: inventory_discrepancy inventory_discrepancy_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_discrepancy
    ADD CONSTRAINT inventory_discrepancy_pkey PRIMARY KEY (id);


--
-- Name: mercadolibre_account mercadolibre_account_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mercadolibre_account
    ADD CONSTRAINT mercadolibre_account_pkey PRIMARY KEY (id);


--
-- Name: mercadolibre_order_event mercadolibre_order_event_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mercadolibre_order_event
    ADD CONSTRAINT mercadolibre_order_event_pkey PRIMARY KEY (id);


--
-- Name: ml_listing ml_listing_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ml_listing
    ADD CONSTRAINT ml_listing_pkey PRIMARY KEY (id);


--
-- Name: ml_order ml_order_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ml_order
    ADD CONSTRAINT ml_order_pkey PRIMARY KEY (id);


--
-- Name: notification_bucket_assignee notification_bucket_assignee_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_bucket_assignee
    ADD CONSTRAINT notification_bucket_assignee_pkey PRIMARY KEY (id);


--
-- Name: notification_bucket notification_bucket_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_bucket
    ADD CONSTRAINT notification_bucket_pkey PRIMARY KEY (id);


--
-- Name: notification_routing_rule notification_routing_rule_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_routing_rule
    ADD CONSTRAINT notification_routing_rule_pkey PRIMARY KEY (id);


--
-- Name: order_item order_item_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_item
    ADD CONSTRAINT order_item_pkey PRIMARY KEY (id);


--
-- Name: organization organization_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization
    ADD CONSTRAINT organization_pkey PRIMARY KEY (id);


--
-- Name: payment_allocation payment_allocation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_allocation
    ADD CONSTRAINT payment_allocation_pkey PRIMARY KEY (id);


--
-- Name: payment_evidence payment_evidence_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_evidence
    ADD CONSTRAINT payment_evidence_pkey PRIMARY KEY (id);


--
-- Name: payment payment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment
    ADD CONSTRAINT payment_pkey PRIMARY KEY (id);


--
-- Name: permission permission_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission
    ADD CONSTRAINT permission_pkey PRIMARY KEY (id);


--
-- Name: price_history price_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_history
    ADD CONSTRAINT price_history_pkey PRIMARY KEY (id);


--
-- Name: pricing_rule pricing_rule_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_rule
    ADD CONSTRAINT pricing_rule_pkey PRIMARY KEY (id);


--
-- Name: product_attribute product_attribute_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_attribute
    ADD CONSTRAINT product_attribute_pkey PRIMARY KEY (id);


--
-- Name: product product_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product
    ADD CONSTRAINT product_pkey PRIMARY KEY (id);


--
-- Name: product_price product_price_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_price
    ADD CONSTRAINT product_price_pkey PRIMARY KEY (id);


--
-- Name: product_supplier product_supplier_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_supplier
    ADD CONSTRAINT product_supplier_pkey PRIMARY KEY (id);


--
-- Name: product_uom_equivalence product_uom_equivalence_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_uom_equivalence
    ADD CONSTRAINT product_uom_equivalence_pkey PRIMARY KEY (id);


--
-- Name: quote_item quote_item_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_item
    ADD CONSTRAINT quote_item_pkey PRIMARY KEY (id);


--
-- Name: quote quote_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote
    ADD CONSTRAINT quote_pkey PRIMARY KEY (id);


--
-- Name: rate_limit_bucket rate_limit_bucket_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_limit_bucket
    ADD CONSTRAINT rate_limit_bucket_pkey PRIMARY KEY (key, window_start);


--
-- Name: rate_limit_lockout rate_limit_lockout_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_limit_lockout
    ADD CONSTRAINT rate_limit_lockout_pkey PRIMARY KEY (key);


--
-- Name: repricing_event repricing_event_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repricing_event
    ADD CONSTRAINT repricing_event_pkey PRIMARY KEY (id);


--
-- Name: role_permission role_permission_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permission
    ADD CONSTRAINT role_permission_pkey PRIMARY KEY (id);


--
-- Name: sales_order sales_order_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_order
    ADD CONSTRAINT sales_order_pkey PRIMARY KEY (id);


--
-- Name: signature signature_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signature
    ADD CONSTRAINT signature_pkey PRIMARY KEY (id);


--
-- Name: stock_ledger stock_ledger_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_ledger
    ADD CONSTRAINT stock_ledger_pkey PRIMARY KEY (id);


--
-- Name: stock_movement stock_movement_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movement
    ADD CONSTRAINT stock_movement_pkey PRIMARY KEY (id);


--
-- Name: supplier supplier_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier
    ADD CONSTRAINT supplier_pkey PRIMARY KEY (id);


--
-- Name: system_alert system_alert_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_alert
    ADD CONSTRAINT system_alert_pkey PRIMARY KEY (id);


--
-- Name: ai_prompt_config uq_ai_prompt_config_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_prompt_config
    ADD CONSTRAINT uq_ai_prompt_config_key UNIQUE (workspace_id, config_key);


--
-- Name: brand uq_brand_slug; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand
    ADD CONSTRAINT uq_brand_slug UNIQUE (workspace_id, slug);


--
-- Name: category_alias uq_category_alias_alias; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_alias
    ADD CONSTRAINT uq_category_alias_alias UNIQUE (workspace_id, alias);


--
-- Name: category uq_category_slug; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category
    ADD CONSTRAINT uq_category_slug UNIQUE (workspace_id, slug);


--
-- Name: channel_allocation uq_channel_product; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_allocation
    ADD CONSTRAINT uq_channel_product UNIQUE (workspace_id, product_id, channel);


--
-- Name: container uq_container_number; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.container
    ADD CONSTRAINT uq_container_number UNIQUE (workspace_id, container_number);


--
-- Name: customer uq_customer_workspace_person_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer
    ADD CONSTRAINT uq_customer_workspace_person_key UNIQUE (workspace_id, person_key);


--
-- Name: delivery_note uq_delivery_note_number; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_note
    ADD CONSTRAINT uq_delivery_note_number UNIQUE (workspace_id, note_number);


--
-- Name: document_sequence uq_doc_seq_ws_type; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_sequence
    ADD CONSTRAINT uq_doc_seq_ws_type UNIQUE (workspace_id, document_type);


--
-- Name: import_session uq_import_session_idempotency; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.import_session
    ADD CONSTRAINT uq_import_session_idempotency UNIQUE (workspace_id, idempotency_key);


--
-- Name: internal_invoice uq_invoice_number; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internal_invoice
    ADD CONSTRAINT uq_invoice_number UNIQUE (workspace_id, invoice_number);


--
-- Name: ml_listing uq_ml_item; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ml_listing
    ADD CONSTRAINT uq_ml_item UNIQUE (workspace_id, ml_item_id);


--
-- Name: ml_order uq_ml_order; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ml_order
    ADD CONSTRAINT uq_ml_order UNIQUE (workspace_id, ml_order_id);


--
-- Name: mercadolibre_account uq_ml_user; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mercadolibre_account
    ADD CONSTRAINT uq_ml_user UNIQUE (workspace_id, ml_user_id);


--
-- Name: notification_bucket_assignee uq_nba_bucket_member; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_bucket_assignee
    ADD CONSTRAINT uq_nba_bucket_member UNIQUE (bucket_id, member_id);


--
-- Name: notification_bucket uq_notification_bucket; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_bucket
    ADD CONSTRAINT uq_notification_bucket UNIQUE (workspace_id, bucket);


--
-- Name: notification_routing_rule uq_nrr_workspace_alert; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_routing_rule
    ADD CONSTRAINT uq_nrr_workspace_alert UNIQUE (workspace_id, alert_type);


--
-- Name: sales_order uq_order_number; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_order
    ADD CONSTRAINT uq_order_number UNIQUE (workspace_id, order_number);


--
-- Name: permission uq_permission_module_action; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission
    ADD CONSTRAINT uq_permission_module_action UNIQUE (module, action);


--
-- Name: product_attribute uq_product_attr_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_attribute
    ADD CONSTRAINT uq_product_attr_key UNIQUE (workspace_id, product_id, key);


--
-- Name: product_price uq_product_price_type; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_price
    ADD CONSTRAINT uq_product_price_type UNIQUE (workspace_id, product_id, price_type);


--
-- Name: product uq_product_sku; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product
    ADD CONSTRAINT uq_product_sku UNIQUE (workspace_id, sku);


--
-- Name: product_supplier uq_product_supplier; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_supplier
    ADD CONSTRAINT uq_product_supplier UNIQUE (workspace_id, product_id, supplier_id);


--
-- Name: quote uq_quote_number; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote
    ADD CONSTRAINT uq_quote_number UNIQUE (workspace_id, quote_number);


--
-- Name: role_permission uq_role_permission; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permission
    ADD CONSTRAINT uq_role_permission UNIQUE (role, permission_id);


--
-- Name: stock_ledger uq_stock_product_warehouse; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_ledger
    ADD CONSTRAINT uq_stock_product_warehouse UNIQUE (workspace_id, product_id, warehouse_id);


--
-- Name: warehouse_location uq_wl_warehouse_code; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_location
    ADD CONSTRAINT uq_wl_warehouse_code UNIQUE (workspace_id, warehouse_id, code);


--
-- Name: workspace_member uq_workspace_member; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_member
    ADD CONSTRAINT uq_workspace_member UNIQUE (workspace_id, user_id);


--
-- Name: workspace_module uq_workspace_module; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_module
    ADD CONSTRAINT uq_workspace_module UNIQUE (workspace_id, module);


--
-- Name: workspace_profile uq_workspace_profile_ws; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_profile
    ADD CONSTRAINT uq_workspace_profile_ws UNIQUE (workspace_id);


--
-- Name: workspace_quota uq_workspace_quota_ws; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_quota
    ADD CONSTRAINT uq_workspace_quota_ws UNIQUE (workspace_id);


--
-- Name: workspace uq_workspace_slug; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace
    ADD CONSTRAINT uq_workspace_slug UNIQUE (slug);


--
-- Name: user_profile user_profile_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profile
    ADD CONSTRAINT user_profile_pkey PRIMARY KEY (id);


--
-- Name: user_session_activity user_session_activity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_session_activity
    ADD CONSTRAINT user_session_activity_pkey PRIMARY KEY (session_id);


--
-- Name: vendor_commission vendor_commission_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_commission
    ADD CONSTRAINT vendor_commission_pkey PRIMARY KEY (id);


--
-- Name: warehouse_location warehouse_location_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_location
    ADD CONSTRAINT warehouse_location_pkey PRIMARY KEY (id);


--
-- Name: warehouse warehouse_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse
    ADD CONSTRAINT warehouse_pkey PRIMARY KEY (id);


--
-- Name: workspace_member workspace_member_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_member
    ADD CONSTRAINT workspace_member_pkey PRIMARY KEY (id);


--
-- Name: workspace_module workspace_module_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_module
    ADD CONSTRAINT workspace_module_pkey PRIMARY KEY (id);


--
-- Name: workspace workspace_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace
    ADD CONSTRAINT workspace_pkey PRIMARY KEY (id);


--
-- Name: workspace_profile workspace_profile_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_profile
    ADD CONSTRAINT workspace_profile_pkey PRIMARY KEY (id);


--
-- Name: workspace_quota workspace_quota_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_quota
    ADD CONSTRAINT workspace_quota_pkey PRIMARY KEY (id);


--
-- Name: idx_account_receivable_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_account_receivable_order_id ON public.account_receivable USING btree (order_id);


--
-- Name: idx_account_receivable_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_account_receivable_workspace_id ON public.account_receivable USING btree (workspace_id);


--
-- Name: idx_alert_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alert_created ON public.system_alert USING btree (created_at);


--
-- Name: idx_alert_dismissed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alert_dismissed ON public.system_alert USING btree (is_dismissed);


--
-- Name: idx_alert_severity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alert_severity ON public.system_alert USING btree (severity);


--
-- Name: idx_alert_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alert_type ON public.system_alert USING btree (alert_type);


--
-- Name: idx_approval_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_approval_entity ON public.approval USING btree (entity_type, entity_id);


--
-- Name: idx_approval_requested; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_approval_requested ON public.approval USING btree (requested_by);


--
-- Name: idx_approval_resolved; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_approval_resolved ON public.approval USING btree (resolved_by);


--
-- Name: idx_approval_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_approval_status ON public.approval USING btree (status);


--
-- Name: idx_approval_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_approval_type ON public.approval USING btree (approval_type);


--
-- Name: idx_approval_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_approval_workspace_id ON public.approval USING btree (workspace_id);


--
-- Name: idx_ar_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ar_customer ON public.account_receivable USING btree (customer_id);


--
-- Name: idx_ar_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ar_due ON public.account_receivable USING btree (due_date);


--
-- Name: idx_ar_installment_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ar_installment_workspace_id ON public.ar_installment USING btree (workspace_id);


--
-- Name: idx_ar_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ar_status ON public.account_receivable USING btree (status);


--
-- Name: idx_ari_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ari_due ON public.ar_installment USING btree (due_date);


--
-- Name: idx_ari_receivable; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ari_receivable ON public.ar_installment USING btree (receivable_id);


--
-- Name: idx_ari_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ari_status ON public.ar_installment USING btree (status);


--
-- Name: idx_audit_log_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_action ON public.audit_log USING btree (action);


--
-- Name: idx_audit_log_actor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_actor ON public.audit_log USING btree (actor_id);


--
-- Name: idx_audit_log_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_created ON public.audit_log USING btree (created_at);


--
-- Name: idx_audit_log_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_entity ON public.audit_log USING btree (entity, entity_id);


--
-- Name: idx_audit_log_import_idempotency; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_import_idempotency ON public.audit_log USING btree (workspace_id, action, ((new_value ->> 'idempotencyKey'::text))) WHERE ((entity)::text = 'inventory_import'::text);


--
-- Name: idx_audit_log_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_workspace_id ON public.audit_log USING btree (workspace_id);


--
-- Name: idx_brand_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_brand_name ON public.brand USING btree (name);


--
-- Name: idx_ca_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ca_customer ON public.customer_address USING btree (customer_id);


--
-- Name: idx_cash_closure_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cash_closure_workspace_id ON public.cash_closure USING btree (workspace_id);


--
-- Name: idx_category_alias_alias; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_category_alias_alias ON public.category_alias USING btree (alias);


--
-- Name: idx_category_alias_category_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_category_alias_category_id ON public.category_alias USING btree (category_id);


--
-- Name: idx_category_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_category_parent ON public.category USING btree (parent_id);


--
-- Name: idx_cd_container; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cd_container ON public.container_document USING btree (container_id);


--
-- Name: idx_channel_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_channel ON public.channel_allocation USING btree (channel);


--
-- Name: idx_channel_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_product ON public.channel_allocation USING btree (product_id);


--
-- Name: idx_citem_container; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_citem_container ON public.container_item USING btree (container_id);


--
-- Name: idx_citem_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_citem_product ON public.container_item USING btree (product_id);


--
-- Name: idx_closure_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_closure_date ON public.cash_closure USING btree (closure_date);


--
-- Name: idx_closure_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_closure_status ON public.cash_closure USING btree (status);


--
-- Name: idx_container_document_uploaded_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_container_document_uploaded_by ON public.container_document USING btree (uploaded_by);


--
-- Name: idx_container_document_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_container_document_workspace_id ON public.container_document USING btree (workspace_id);


--
-- Name: idx_container_item_suggested_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_container_item_suggested_product_id ON public.container_item USING btree (suggested_product_id);


--
-- Name: idx_container_item_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_container_item_workspace_id ON public.container_item USING btree (workspace_id);


--
-- Name: idx_container_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_container_status ON public.container USING btree (status);


--
-- Name: idx_container_supplier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_container_supplier ON public.container USING btree (supplier_id);


--
-- Name: idx_count_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_count_status ON public.inventory_count USING btree (status);


--
-- Name: idx_count_warehouse; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_count_warehouse ON public.inventory_count USING btree (warehouse_id);


--
-- Name: idx_customer_address_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_address_workspace_id ON public.customer_address USING btree (workspace_id);


--
-- Name: idx_customer_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_name ON public.customer USING btree (name);


--
-- Name: idx_customer_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_type ON public.customer USING btree (customer_type);


--
-- Name: idx_customer_vendor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_vendor ON public.customer USING btree (assigned_vendor_id);


--
-- Name: idx_customer_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_workspace_id ON public.customer USING btree (workspace_id);


--
-- Name: idx_delivery_note_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delivery_note_created_by ON public.delivery_note USING btree (created_by);


--
-- Name: idx_delivery_note_item_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delivery_note_item_workspace_id ON public.delivery_note_item USING btree (workspace_id);


--
-- Name: idx_dn_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dn_order ON public.delivery_note USING btree (order_id);


--
-- Name: idx_dn_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dn_status ON public.delivery_note USING btree (status);


--
-- Name: idx_dni_note; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dni_note ON public.delivery_note_item USING btree (delivery_note_id);


--
-- Name: idx_dni_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dni_product ON public.delivery_note_item USING btree (product_id);


--
-- Name: idx_exchange_rate_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exchange_rate_workspace_id ON public.exchange_rate USING btree (workspace_id);


--
-- Name: idx_ici_count; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ici_count ON public.inventory_count_item USING btree (count_id);


--
-- Name: idx_ici_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ici_product ON public.inventory_count_item USING btree (product_id);


--
-- Name: idx_id_count; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_id_count ON public.inventory_discrepancy USING btree (count_id);


--
-- Name: idx_id_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_id_product ON public.inventory_discrepancy USING btree (product_id);


--
-- Name: idx_if_resolved; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_if_resolved ON public.integration_failure USING btree (is_resolved);


--
-- Name: idx_if_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_if_source ON public.integration_failure USING btree (source);


--
-- Name: idx_iii_invoice; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_iii_invoice ON public.internal_invoice_item USING btree (invoice_id);


--
-- Name: idx_iii_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_iii_product ON public.internal_invoice_item USING btree (product_id);


--
-- Name: idx_ilog_level; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ilog_level ON public.integration_log USING btree (level);


--
-- Name: idx_ilog_resolved; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ilog_resolved ON public.integration_log USING btree (is_resolved);


--
-- Name: idx_ilog_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ilog_source ON public.integration_log USING btree (source);


--
-- Name: idx_import_session_row_resolved_brand_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_import_session_row_resolved_brand_id ON public.import_session_row USING btree (resolved_brand_id);


--
-- Name: idx_import_session_row_resolved_category_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_import_session_row_resolved_category_id ON public.import_session_row USING btree (resolved_category_id);


--
-- Name: idx_import_session_row_resolved_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_import_session_row_resolved_product_id ON public.import_session_row USING btree (resolved_product_id);


--
-- Name: idx_import_session_row_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_import_session_row_workspace_id ON public.import_session_row USING btree (workspace_id);


--
-- Name: idx_import_session_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_import_session_status ON public.import_session USING btree (status);


--
-- Name: idx_import_session_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_import_session_user ON public.import_session USING btree (user_id);


--
-- Name: idx_integration_failure_resolved_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_integration_failure_resolved_by ON public.integration_failure USING btree (resolved_by);


--
-- Name: idx_integration_failure_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_integration_failure_workspace_id ON public.integration_failure USING btree (workspace_id);


--
-- Name: idx_integration_log_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_integration_log_workspace_id ON public.integration_log USING btree (workspace_id);


--
-- Name: idx_internal_invoice_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_internal_invoice_created_by ON public.internal_invoice USING btree (created_by);


--
-- Name: idx_internal_invoice_item_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_internal_invoice_item_workspace_id ON public.internal_invoice_item USING btree (workspace_id);


--
-- Name: idx_inv_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inv_customer ON public.internal_invoice USING btree (customer_id);


--
-- Name: idx_inv_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inv_order ON public.internal_invoice USING btree (order_id);


--
-- Name: idx_inv_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inv_status ON public.internal_invoice USING btree (status);


--
-- Name: idx_inventory_count_item_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_count_item_workspace_id ON public.inventory_count_item USING btree (workspace_id);


--
-- Name: idx_inventory_count_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_count_workspace_id ON public.inventory_count USING btree (workspace_id);


--
-- Name: idx_inventory_discrepancy_resolved_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_discrepancy_resolved_by ON public.inventory_discrepancy USING btree (resolved_by);


--
-- Name: idx_inventory_discrepancy_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_discrepancy_workspace_id ON public.inventory_discrepancy USING btree (workspace_id);


--
-- Name: idx_isr_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_isr_session ON public.import_session_row USING btree (import_session_id);


--
-- Name: idx_isr_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_isr_status ON public.import_session_row USING btree (status);


--
-- Name: idx_mercadolibre_order_event_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mercadolibre_order_event_workspace_id ON public.mercadolibre_order_event USING btree (workspace_id);


--
-- Name: idx_ml_order_sales_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ml_order_sales_order_id ON public.ml_order USING btree (sales_order_id);


--
-- Name: idx_ml_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ml_product ON public.ml_listing USING btree (product_id);


--
-- Name: idx_ml_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ml_status ON public.ml_listing USING btree (status);


--
-- Name: idx_mlo_imported; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mlo_imported ON public.ml_order USING btree (is_imported);


--
-- Name: idx_mlo_listing; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mlo_listing ON public.ml_order USING btree (ml_listing_id);


--
-- Name: idx_moe_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_moe_order ON public.mercadolibre_order_event USING btree (ml_order_id);


--
-- Name: idx_moe_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_moe_type ON public.mercadolibre_order_event USING btree (event_type);


--
-- Name: idx_movement_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_movement_created ON public.stock_movement USING btree (created_at);


--
-- Name: idx_movement_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_movement_product ON public.stock_movement USING btree (product_id);


--
-- Name: idx_movement_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_movement_type ON public.stock_movement USING btree (movement_type);


--
-- Name: idx_notification_bucket_assignee_member_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_bucket_assignee_member_id ON public.notification_bucket_assignee USING btree (member_id);


--
-- Name: idx_notification_bucket_assignee_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_bucket_assignee_workspace_id ON public.notification_bucket_assignee USING btree (workspace_id);


--
-- Name: idx_notification_routing_rule_bucket_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_routing_rule_bucket_id ON public.notification_routing_rule USING btree (bucket_id);


--
-- Name: idx_oitem_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oitem_order ON public.order_item USING btree (order_id);


--
-- Name: idx_oitem_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oitem_product ON public.order_item USING btree (product_id);


--
-- Name: idx_order_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_channel ON public.sales_order USING btree (channel);


--
-- Name: idx_order_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_created ON public.sales_order USING btree (created_at);


--
-- Name: idx_order_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_customer ON public.sales_order USING btree (customer_id);


--
-- Name: idx_order_item_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_item_workspace_id ON public.order_item USING btree (workspace_id);


--
-- Name: idx_order_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_status ON public.sales_order USING btree (status);


--
-- Name: idx_pa_payment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pa_payment ON public.payment_allocation USING btree (payment_id);


--
-- Name: idx_pa_receivable; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pa_receivable ON public.payment_allocation USING btree (receivable_id);


--
-- Name: idx_payment_allocation_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_allocation_workspace_id ON public.payment_allocation USING btree (workspace_id);


--
-- Name: idx_payment_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_created ON public.payment USING btree (created_at);


--
-- Name: idx_payment_evidence_uploaded_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_evidence_uploaded_by ON public.payment_evidence USING btree (uploaded_by);


--
-- Name: idx_payment_evidence_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_evidence_workspace_id ON public.payment_evidence USING btree (workspace_id);


--
-- Name: idx_payment_method; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_method ON public.payment USING btree (method);


--
-- Name: idx_payment_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_order ON public.payment USING btree (order_id);


--
-- Name: idx_payment_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_workspace_id ON public.payment USING btree (workspace_id);


--
-- Name: idx_pe_payment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pe_payment ON public.payment_evidence USING btree (payment_id);


--
-- Name: idx_ph_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ph_created ON public.price_history USING btree (created_at);


--
-- Name: idx_ph_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ph_product ON public.price_history USING btree (product_id);


--
-- Name: idx_ph_trigger; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ph_trigger ON public.price_history USING btree (trigger);


--
-- Name: idx_pr_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pr_active ON public.pricing_rule USING btree (is_active);


--
-- Name: idx_pr_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pr_type ON public.pricing_rule USING btree (rule_type);


--
-- Name: idx_price_history_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_price_history_workspace_id ON public.price_history USING btree (workspace_id);


--
-- Name: idx_pricing_rule_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pricing_rule_created_by ON public.pricing_rule USING btree (created_by);


--
-- Name: idx_pricing_rule_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pricing_rule_workspace_id ON public.pricing_rule USING btree (workspace_id);


--
-- Name: idx_product_attr_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_attr_product ON public.product_attribute USING btree (product_id);


--
-- Name: idx_product_barcode; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_barcode ON public.product USING btree (barcode);


--
-- Name: idx_product_barcode_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_barcode_trgm ON public.product USING gin (barcode extensions.gin_trgm_ops);


--
-- Name: idx_product_brand; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_brand ON public.product USING btree (brand_id);


--
-- Name: idx_product_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_category ON public.product USING btree (category_id);


--
-- Name: idx_product_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_name ON public.product USING btree (name);


--
-- Name: idx_product_name_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_name_trgm ON public.product USING gin (name extensions.gin_trgm_ops);


--
-- Name: idx_product_price_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_price_product ON public.product_price USING btree (product_id);


--
-- Name: idx_product_price_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_price_type ON public.product_price USING btree (price_type);


--
-- Name: idx_product_sku_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_sku_trgm ON public.product USING gin (sku extensions.gin_trgm_ops);


--
-- Name: idx_product_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_status ON public.product USING btree (status);


--
-- Name: idx_product_supplier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_supplier ON public.product USING btree (supplier_id);


--
-- Name: idx_product_uom_equivalence_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_uom_equivalence_workspace_id ON public.product_uom_equivalence USING btree (workspace_id);


--
-- Name: idx_ps_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ps_product ON public.product_supplier USING btree (product_id);


--
-- Name: idx_ps_supplier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ps_supplier ON public.product_supplier USING btree (supplier_id);


--
-- Name: idx_puom_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_puom_product ON public.product_uom_equivalence USING btree (product_id);


--
-- Name: idx_qi_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qi_product ON public.quote_item USING btree (product_id);


--
-- Name: idx_qi_quote; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qi_quote ON public.quote_item USING btree (quote_id);


--
-- Name: idx_quote_converted_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_converted_order_id ON public.quote USING btree (converted_order_id);


--
-- Name: idx_quote_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_created_by ON public.quote USING btree (created_by);


--
-- Name: idx_quote_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_customer ON public.quote USING btree (customer_id);


--
-- Name: idx_quote_item_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_item_workspace_id ON public.quote_item USING btree (workspace_id);


--
-- Name: idx_quote_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_status ON public.quote USING btree (status);


--
-- Name: idx_rate_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rate_created ON public.exchange_rate USING btree (created_at);


--
-- Name: idx_rate_limit_bucket_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rate_limit_bucket_expires ON public.rate_limit_bucket USING btree (expires_at);


--
-- Name: idx_rate_limit_lockout_until; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rate_limit_lockout_until ON public.rate_limit_lockout USING btree (locked_until);


--
-- Name: idx_rate_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rate_type ON public.exchange_rate USING btree (rate_type);


--
-- Name: idx_reprice_approved; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reprice_approved ON public.repricing_event USING btree (is_approved);


--
-- Name: idx_reprice_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reprice_created ON public.repricing_event USING btree (created_at);


--
-- Name: idx_reprice_trigger; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reprice_trigger ON public.repricing_event USING btree (trigger);


--
-- Name: idx_repricing_event_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_repricing_event_workspace_id ON public.repricing_event USING btree (workspace_id);


--
-- Name: idx_role_permission_permission_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_role_permission_permission_id ON public.role_permission USING btree (permission_id);


--
-- Name: idx_role_permission_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_role_permission_role ON public.role_permission USING btree (role);


--
-- Name: idx_sales_order_closed_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_order_closed_by ON public.sales_order USING btree (closed_by);


--
-- Name: idx_sales_order_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_order_created_by ON public.sales_order USING btree (created_by);


--
-- Name: idx_sig_approval; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sig_approval ON public.signature USING btree (approval_id);


--
-- Name: idx_sig_signed_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sig_signed_by ON public.signature USING btree (signed_by);


--
-- Name: idx_signature_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_signature_workspace_id ON public.signature USING btree (workspace_id);


--
-- Name: idx_stock_movement_warehouse_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_movement_warehouse_id ON public.stock_movement USING btree (warehouse_id);


--
-- Name: idx_stock_movement_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_movement_workspace_id ON public.stock_movement USING btree (workspace_id);


--
-- Name: idx_stock_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_product ON public.stock_ledger USING btree (product_id);


--
-- Name: idx_stock_warehouse; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_warehouse ON public.stock_ledger USING btree (warehouse_id);


--
-- Name: idx_supplier_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_supplier_name ON public.supplier USING btree (name);


--
-- Name: idx_supplier_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_supplier_status ON public.supplier USING btree (status);


--
-- Name: idx_supplier_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_supplier_workspace_id ON public.supplier USING btree (workspace_id);


--
-- Name: idx_system_alert_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_alert_workspace_id ON public.system_alert USING btree (workspace_id);


--
-- Name: idx_user_profile_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_profile_email ON public.user_profile USING btree (email);


--
-- Name: idx_user_profile_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_profile_organization_id ON public.user_profile USING btree (organization_id);


--
-- Name: idx_user_profile_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_profile_role ON public.user_profile USING btree (role);


--
-- Name: idx_user_profile_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_profile_status ON public.user_profile USING btree (status);


--
-- Name: idx_user_session_activity_last_seen; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_session_activity_last_seen ON public.user_session_activity USING btree (last_seen_at);


--
-- Name: idx_user_session_activity_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_session_activity_user ON public.user_session_activity USING btree (user_id);


--
-- Name: idx_vc_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vc_order ON public.vendor_commission USING btree (order_id);


--
-- Name: idx_vc_paid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vc_paid ON public.vendor_commission USING btree (is_paid);


--
-- Name: idx_vc_vendor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vc_vendor ON public.vendor_commission USING btree (vendor_id);


--
-- Name: idx_vendor_commission_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendor_commission_workspace_id ON public.vendor_commission USING btree (workspace_id);


--
-- Name: idx_warehouse_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_warehouse_type ON public.warehouse USING btree (type);


--
-- Name: idx_warehouse_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_warehouse_workspace_id ON public.warehouse USING btree (workspace_id);


--
-- Name: idx_wl_warehouse; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wl_warehouse ON public.warehouse_location USING btree (warehouse_id);


--
-- Name: idx_wm_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wm_user ON public.workspace_member USING btree (user_id);


--
-- Name: idx_wm_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wm_workspace ON public.workspace_member USING btree (workspace_id);


--
-- Name: idx_workspace_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_created_by ON public.workspace USING btree (created_by);


--
-- Name: idx_workspace_member_invited_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_member_invited_by ON public.workspace_member USING btree (invited_by);


--
-- Name: idx_workspace_module_enabled_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_module_enabled_by ON public.workspace_module USING btree (enabled_by);


--
-- Name: idx_workspace_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_org ON public.workspace USING btree (organization_id);


--
-- Name: idx_workspace_plan; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_plan ON public.workspace USING btree (plan);


--
-- Name: idx_workspace_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_status ON public.workspace USING btree (status);


--
-- Name: idx_wsm_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wsm_workspace ON public.workspace_module USING btree (workspace_id);


--
-- Name: payment trg_ar_payment; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ar_payment AFTER INSERT ON public.payment FOR EACH ROW EXECUTE FUNCTION public.update_ar_on_payment();


--
-- Name: workspace_member trg_enforce_workspace_quota; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_enforce_workspace_quota BEFORE INSERT ON public.workspace_member FOR EACH ROW WHEN ((new.status = 'active'::public.member_status)) EXECUTE FUNCTION public.enforce_workspace_quota();


--
-- Name: sales_order trg_order_number; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_order_number BEFORE INSERT ON public.sales_order FOR EACH ROW EXECUTE FUNCTION public.generate_order_number();


--
-- Name: product_price trg_price_history; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_price_history AFTER UPDATE ON public.product_price FOR EACH ROW EXECUTE FUNCTION public.record_price_change();


--
-- Name: channel_allocation trg_updated_at_channel_allocation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_updated_at_channel_allocation BEFORE UPDATE ON public.channel_allocation FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: organization trg_updated_at_organization; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_updated_at_organization BEFORE UPDATE ON public.organization FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: product trg_updated_at_product; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_updated_at_product BEFORE UPDATE ON public.product FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: product_price trg_updated_at_product_price; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_updated_at_product_price BEFORE UPDATE ON public.product_price FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: sales_order trg_updated_at_sales_order; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_updated_at_sales_order BEFORE UPDATE ON public.sales_order FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: stock_ledger trg_updated_at_stock_ledger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_updated_at_stock_ledger BEFORE UPDATE ON public.stock_ledger FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: user_profile trg_updated_at_user_profile; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_updated_at_user_profile BEFORE UPDATE ON public.user_profile FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: stock_ledger trg_validate_stock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validate_stock BEFORE INSERT OR UPDATE ON public.stock_ledger FOR EACH ROW EXECUTE FUNCTION public.validate_stock_quantity();


--
-- Name: account_receivable account_receivable_customer_id_customer_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_receivable
    ADD CONSTRAINT account_receivable_customer_id_customer_id_fk FOREIGN KEY (customer_id) REFERENCES public.customer(id);


--
-- Name: account_receivable account_receivable_order_id_sales_order_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_receivable
    ADD CONSTRAINT account_receivable_order_id_sales_order_id_fk FOREIGN KEY (order_id) REFERENCES public.sales_order(id);


--
-- Name: account_receivable account_receivable_workspace_id_workspace_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_receivable
    ADD CONSTRAINT account_receivable_workspace_id_workspace_id_fk FOREIGN KEY (workspace_id) REFERENCES public.workspace(id);


--
-- Name: ai_prompt_config ai_prompt_config_workspace_id_workspace_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_prompt_config
    ADD CONSTRAINT ai_prompt_config_workspace_id_workspace_id_fk FOREIGN KEY (workspace_id) REFERENCES public.workspace(id);


--
-- Name: approval approval_requested_by_user_profile_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval
    ADD CONSTRAINT approval_requested_by_user_profile_id_fk FOREIGN KEY (requested_by) REFERENCES public.user_profile(id);


--
-- Name: approval approval_resolved_by_user_profile_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval
    ADD CONSTRAINT approval_resolved_by_user_profile_id_fk FOREIGN KEY (resolved_by) REFERENCES public.user_profile(id);


--
-- Name: approval approval_workspace_id_workspace_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval
    ADD CONSTRAINT approval_workspace_id_workspace_id_fk FOREIGN KEY (workspace_id) REFERENCES public.workspace(id);


--
-- Name: ar_installment ar_installment_receivable_id_account_receivable_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ar_installment
    ADD CONSTRAINT ar_installment_receivable_id_account_receivable_id_fk FOREIGN KEY (receivable_id) REFERENCES public.account_receivable(id) ON DELETE CASCADE;


--
-- Name: ar_installment ar_installment_workspace_id_workspace_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ar_installment
    ADD CONSTRAINT ar_installment_workspace_id_workspace_id_fk FOREIGN KEY (workspace_id) REFERENCES public.workspace(id);


--
-- Name: audit_log audit_log_workspace_id_workspace_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_workspace_id_workspace_id_fk FOREIGN KEY (workspace_id) REFERENCES public.workspace(id);


--
-- Name: brand brand_workspace_id_workspace_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand
    ADD CONSTRAINT brand_workspace_id_workspace_id_fk FOREIGN KEY (workspace_id) REFERENCES public.workspace(id);


--
-- Name: cash_closure cash_closure_workspace_id_workspace_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_closure
    ADD CONSTRAINT cash_closure_workspace_id_workspace_id_fk FOREIGN KEY (workspace_id) REFERENCES public.workspace(id);


--
-- Name: category_alias category_alias_category_id_category_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_alias
    ADD CONSTRAINT category_alias_category_id_category_id_fk FOREIGN KEY (category_id) REFERENCES public.category(id);


--
-- Name: category_alias category_alias_workspace_id_workspace_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_alias
    ADD CONSTRAINT category_alias_workspace_id_workspace_id_fk FOREIGN KEY (workspace_id) REFERENCES public.workspace(id);


--
-- Name: category category_workspace_id_workspace_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category
    ADD CONSTRAINT category_workspace_id_workspace_id_fk FOREIGN KEY (workspace_id) REFERENCES public.workspace(id);


--
-- Name: channel_allocation channel_allocation_product_id_product_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_allocation
    ADD CONSTRAINT channel_allocation_product_id_product_id_fk FOREIGN KEY (product_id) REFERENCES public.product(id);


--
-- Name: channel_allocation channel_allocation_workspace_id_workspace_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_allocation
    ADD CONSTRAINT channel_allocation_workspace_id_workspace_id_fk FOREIGN KEY (workspace_id) REFERENCES public.workspace(id);


--
-- Name: container_document container_document_container_id_container_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.container_document
    ADD CONSTRAINT container_document_container_id_container_id_fk FOREIGN KEY (container_id) REFERENCES public.container(id) ON DELETE CASCADE;


--
-- Name: container_document container_document_uploaded_by_user_profile_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.container_document
    ADD CONSTRAINT container_document_uploaded_by_user_profile_id_fk FOREIGN KEY (uploaded_by) REFERENCES public.user_profile(id);


--
-- Name: container_document container_document_workspace_id_workspace_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.container_document
    ADD CONSTRAINT container_document_workspace_id_workspace_id_fk FOREIGN KEY (workspace_id) REFERENCES public.workspace(id);


--
-- Name: container_item container_item_container_id_container_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.container_item
    ADD CONSTRAINT container_item_container_id_container_id_fk FOREIGN KEY (container_id) REFERENCES public.container(id) ON DELETE CASCADE;


--
-- Name: container_item container_item_product_id_product_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.container_item
    ADD CONSTRAINT container_item_product_id_product_id_fk FOREIGN KEY (product_id) REFERENCES public.product(id);


--
-- Name: container_item container_item_suggested_product_id_product_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.container_item
    ADD CONSTRAINT container_item_suggested_product_id_product_id_fk FOREIGN KEY (suggested_product_id) REFERENCES public.product(id);


--
-- Name: container_item container_item_workspace_id_workspace_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.container_item
    ADD CONSTRAINT container_item_workspace_id_workspace_id_fk FOREIGN KEY (workspace_id) REFERENCES public.workspace(id);


--
-- Name: container container_supplier_id_supplier_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.container
    ADD CONSTRAINT container_supplier_id_supplier_id_fk FOREIGN KEY (supplier_id) REFERENCES public.supplier(id);


--
-- Name: container container_workspace_id_workspace_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.container
    ADD CONSTRAINT container_workspace_id_workspace_id_fk FOREIGN KEY (workspace_id) REFERENCES public.workspace(id);


--
-- Name: customer_address customer_address_customer_id_customer_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_address
    ADD CONSTRAINT customer_address_customer_id_customer_id_fk FOREIGN KEY (customer_id) REFERENCES public.customer(id) ON DELETE CASCADE;


--
-- Name: customer_address customer_address_workspace_id_workspace_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_address
    ADD CONSTRAINT customer_address_workspace_id_workspace_id_fk FOREIGN KEY (workspace_id) REFERENCES public.workspace(id);


--
-- Name: customer customer_assigned_vendor_id_user_profile_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer
    ADD CONSTRAINT customer_assigned_vendor_id_user_profile_id_fk FOREIGN KEY (assigned_vendor_id) REFERENCES public.user_profile(id);


--
-- Name: customer customer_workspace_id_workspace_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer
    ADD CONSTRAINT customer_workspace_id_workspace_id_fk FOREIGN KEY (workspace_id) REFERENCES public.workspace(id);


--
-- Name: delivery_note delivery_note_created_by_user_profile_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_note
    ADD CONSTRAINT delivery_note_created_by_user_profile_id_fk FOREIGN KEY (created_by) REFERENCES public.user_profile(id);


--
-- Name: delivery_note_item delivery_note_item_delivery_note_id_delivery_note_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_note_item
    ADD CONSTRAINT delivery_note_item_delivery_note_id_delivery_note_id_fk FOREIGN KEY (delivery_note_id) REFERENCES public.delivery_note(id) ON DELETE CASCADE;


--
-- Name: delivery_note_item delivery_note_item_product_id_product_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_note_item
    ADD CONSTRAINT delivery_note_item_product_id_product_id_fk FOREIGN KEY (product_id) REFERENCES public.product(id);


--
-- Name: delivery_note_item delivery_note_item_workspace_id_workspace_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_note_item
    ADD CONSTRAINT delivery_note_item_workspace_id_workspace_id_fk FOREIGN KEY (workspace_id) REFERENCES public.workspace(id);


--
-- Name: delivery_note delivery_note_order_id_sales_order_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_note
    ADD CONSTRAINT delivery_note_order_id_sales_order_id_fk FOREIGN KEY (order_id) REFERENCES public.sales_order(id);


--
-- Name: delivery_note delivery_note_workspace_id_workspace_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_note
    ADD CONSTRAINT delivery_note_workspace_id_workspace_id_fk FOREIGN KEY (workspace_id) REFERENCES public.workspace(id);


--
-- Name: document_sequence document_sequence_workspace_id_workspace_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_sequence
    ADD CONSTRAINT document_sequence_workspace_id_workspace_id_fk FOREIGN KEY (workspace_id) REFERENCES public.workspace(id) ON DELETE CASCADE;


--
-- Name: exchange_rate exchange_rate_workspace_id_workspace_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exchange_rate
    ADD CONSTRAINT exchange_rate_workspace_id_workspace_id_fk FOREIGN KEY (workspace_id) REFERENCES public.workspace(id);


--
-- Name: import_session_row import_session_row_import_session_id_import_session_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.import_session_row
    ADD CONSTRAINT import_session_row_import_session_id_import_session_id_fk FOREIGN KEY (import_session_id) REFERENCES public.import_session(id) ON DELETE CASCADE;


--
-- Name: import_session_row import_session_row_resolved_brand_id_brand_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.import_session_row
    ADD CONSTRAINT import_session_row_resolved_brand_id_brand_id_fk FOREIGN KEY (resolved_brand_id) REFERENCES public.brand(id);


--
-- Name: import_session_row import_session_row_resolved_category_id_category_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.import_session_row
    ADD CONSTRAINT import_session_row_resolved_category_id_category_id_fk FOREIGN KEY (resolved_category_id) REFERENCES public.category(id);


--
-- Name: import_session_row import_session_row_resolved_product_id_product_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.import_session_row
    ADD CONSTRAINT import_session_row_resolved_product_id_product_id_fk FOREIGN KEY (resolved_product_id) REFERENCES public.product(id);


--
-- Name: import_session_row import_session_row_workspace_id_workspace_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.import_session_row
    ADD CONSTRAINT import_session_row_workspace_id_workspace_id_fk FOREIGN KEY (workspace_id) REFERENCES public.workspace(id);


--
-- Name: import_session import_session_workspace_id_workspace_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.import_session
    ADD CONSTRAINT import_session_workspace_id_workspace_id_fk FOREIGN KEY (workspace_id) REFERENCES public.workspace(id);


--
-- Name: integration_failure integration_failure_resolved_by_user_profile_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_failure
    ADD CONSTRAINT integration_failure_resolved_by_user_profile_id_fk FOREIGN KEY (resolved_by) REFERENCES public.user_profile(id);


--
-- Name: integration_failure integration_failure_workspace_id_workspace_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_failure
    ADD CONSTRAINT integration_failure_workspace_id_workspace_id_fk FOREIGN KEY (workspace_id) REFERENCES public.workspace(id);


--
-- Name: integration_log integration_log_workspace_id_workspace_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_log
    ADD CONSTRAINT integration_log_workspace_id_workspace_id_fk FOREIGN KEY (workspace_id) REFERENCES public.workspace(id);


--
-- Name: internal_invoice internal_invoice_created_by_user_profile_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internal_invoice
    ADD CONSTRAINT internal_invoice_created_by_user_profile_id_fk FOREIGN KEY (created_by) REFERENCES public.user_profile(id);


--
-- Name: internal_invoice internal_invoice_customer_id_customer_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internal_invoice
    ADD CONSTRAINT internal_invoice_customer_id_customer_id_fk FOREIGN KEY (customer_id) REFERENCES public.customer(id);


--
-- Name: internal_invoice_item internal_invoice_item_invoice_id_internal_invoice_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internal_invoice_item
    ADD CONSTRAINT internal_invoice_item_invoice_id_internal_invoice_id_fk FOREIGN KEY (invoice_id) REFERENCES public.internal_invoice(id) ON DELETE CASCADE;


--
-- Name: internal_invoice_item internal_invoice_item_product_id_product_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internal_invoice_item
    ADD CONSTRAINT internal_invoice_item_product_id_product_id_fk FOREIGN KEY (product_id) REFERENCES public.product(id);


--
-- Name: internal_invoice_item internal_invoice_item_workspace_id_workspace_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internal_invoice_item
    ADD CONSTRAINT internal_invoice_item_workspace_id_workspace_id_fk FOREIGN KEY (workspace_id) REFERENCES public.workspace(id);


--
-- Name: internal_invoice internal_invoice_order_id_sales_order_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internal_invoice
    ADD CONSTRAINT internal_invoice_order_id_sales_order_id_fk FOREIGN KEY (order_id) REFERENCES public.sales_order(id);


--
-- Name: internal_invoice internal_invoice_workspace_id_workspace_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internal_invoice
    ADD CONSTRAINT internal_invoice_workspace_id_workspace_id_fk FOREIGN KEY (workspace_id) REFERENCES public.workspace(id);


--
-- Name: inventory_count_item inventory_count_item_count_id_inventory_count_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_count_item
    ADD CONSTRAINT inventory_count_item_count_id_inventory_count_id_fk FOREIGN KEY (count_id) REFERENCES public.inventory_count(id) ON DELETE CASCADE;


--
-- Name: inventory_count_item inventory_count_item_product_id_product_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_count_item
    ADD CONSTRAINT inventory_count_item_product_id_product_id_fk FOREIGN KEY (product_id) REFERENCES public.product(id);


--
-- Name: inventory_count_item inventory_count_item_workspace_id_workspace_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_count_item
    ADD CONSTRAINT inventory_count_item_workspace_id_workspace_id_fk FOREIGN KEY (workspace_id) REFERENCES public.workspace(id);


--
-- Name: inventory_count inventory_count_warehouse_id_warehouse_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_count
    ADD CONSTRAINT inventory_count_warehouse_id_warehouse_id_fk FOREIGN KEY (warehouse_id) REFERENCES public.warehouse(id);


--
-- Name: inventory_count inventory_count_workspace_id_workspace_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_count
    ADD CONSTRAINT inventory_count_workspace_id_workspace_id_fk FOREIGN KEY (workspace_id) REFERENCES public.workspace(id);


--
-- Name: inventory_discrepancy inventory_discrepancy_count_id_inventory_count_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_discrepancy
    ADD CONSTRAINT inventory_discrepancy_count_id_inventory_count_id_fk FOREIGN KEY (count_id) REFERENCES public.inventory_count(id);


--
-- Name: inventory_discrepancy inventory_discrepancy_product_id_product_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_discrepancy
    ADD CONSTRAINT inventory_discrepancy_product_id_product_id_fk FOREIGN KEY (product_id) REFERENCES public.product(id);


--
-- Name: inventory_discrepancy inventory_discrepancy_resolved_by_user_profile_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_discrepancy
    ADD CONSTRAINT inventory_discrepancy_resolved_by_user_profile_id_fk FOREIGN KEY (resolved_by) REFERENCES public.user_profile(id);


--
-- Name: inventory_discrepancy inventory_discrepancy_workspace_id_workspace_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_discrepancy
    ADD CONSTRAINT inventory_discrepancy_workspace_id_workspace_id_fk FOREIGN KEY (workspace_id) REFERENCES public.workspace(id);


--
-- Name: mercadolibre_account mercadolibre_account_workspace_id_workspace_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mercadolibre_account
    ADD CONSTRAINT mercadolibre_account_workspace_id_workspace_id_fk FOREIGN KEY (workspace_id) REFERENCES public.workspace(id);


--
-- Name: mercadolibre_order_event mercadolibre_order_event_ml_order_id_ml_order_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mercadolibre_order_event
    ADD CONSTRAINT mercadolibre_order_event_ml_order_id_ml_order_id_fk FOREIGN KEY (ml_order_id) REFERENCES public.ml_order(id);


--
-- Name: mercadolibre_order_event mercadolibre_order_event_workspace_id_workspace_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mercadolibre_order_event
    ADD CONSTRAINT mercadolibre_order_event_workspace_id_workspace_id_fk FOREIGN KEY (workspace_id) REFERENCES public.workspace(id);


--
-- Name: ml_listing ml_listing_product_id_product_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ml_listing
    ADD CONSTRAINT ml_listing_product_id_product_id_fk FOREIGN KEY (product_id) REFERENCES public.product(id);


--
-- Name: ml_listing ml_listing_workspace_id_workspace_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ml_listing
    ADD CONSTRAINT ml_listing_workspace_id_workspace_id_fk FOREIGN KEY (workspace_id) REFERENCES public.workspace(id);


--
-- Name: ml_order ml_order_ml_listing_id_ml_listing_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ml_order
    ADD CONSTRAINT ml_order_ml_listing_id_ml_listing_id_fk FOREIGN KEY (ml_listing_id) REFERENCES public.ml_listing(id);


--
-- Name: ml_order ml_order_sales_order_id_sales_order_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ml_order
    ADD CONSTRAINT ml_order_sales_order_id_sales_order_id_fk FOREIGN KEY (sales_order_id) REFERENCES public.sales_order(id);


--
-- Name: ml_order ml_order_workspace_id_workspace_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ml_order
    ADD CONSTRAINT ml_order_workspace_id_workspace_id_fk FOREIGN KEY (workspace_id) REFERENCES public.workspace(id);


--
-- Name: notification_bucket_assignee notification_bucket_assignee_bucket_id_notification_bucket_id_f; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_bucket_assignee
    ADD CONSTRAINT notification_bucket_assignee_bucket_id_notification_bucket_id_f FOREIGN KEY (bucket_id) REFERENCES public.notification_bucket(id) ON DELETE CASCADE;


--
-- Name: notification_bucket_assignee notification_bucket_assignee_member_id_workspace_member_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_bucket_assignee
    ADD CONSTRAINT notification_bucket_assignee_member_id_workspace_member_id_fk FOREIGN KEY (member_id) REFERENCES public.workspace_member(id) ON DELETE CASCADE;


--
-- Name: notification_bucket_assignee notification_bucket_assignee_workspace_id_workspace_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_bucket_assignee
    ADD CONSTRAINT notification_bucket_assignee_workspace_id_workspace_id_fk FOREIGN KEY (workspace_id) REFERENCES public.workspace(id) ON DELETE CASCADE;


--
-- Name: notification_bucket notification_bucket_workspace_id_workspace_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_bucket
    ADD CONSTRAINT notification_bucket_workspace_id_workspace_id_fk FOREIGN KEY (workspace_id) REFERENCES public.workspace(id) ON DELETE CASCADE;


--
-- Name: notification_routing_rule notification_routing_rule_bucket_id_notification_bucket_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_routing_rule
    ADD CONSTRAINT notification_routing_rule_bucket_id_notification_bucket_id_fk FOREIGN KEY (bucket_id) REFERENCES public.notification_bucket(id) ON DELETE CASCADE;


--
-- Name: notification_routing_rule notification_routing_rule_workspace_id_workspace_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_routing_rule
    ADD CONSTRAINT notification_routing_rule_workspace_id_workspace_id_fk FOREIGN KEY (workspace_id) REFERENCES public.workspace(id) ON DELETE CASCADE;


--
-- Name: order_item order_item_order_id_sales_order_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_item
    ADD CONSTRAINT order_item_order_id_sales_order_id_fk FOREIGN KEY (order_id) REFERENCES public.sales_order(id) ON DELETE CASCADE;


--
-- Name: order_item order_item_product_id_product_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_item
    ADD CONSTRAINT order_item_product_id_product_id_fk FOREIGN KEY (product_id) REFERENCES public.product(id);


--
-- Name: order_item order_item_workspace_id_workspace_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_item
    ADD CONSTRAINT order_item_workspace_id_workspace_id_fk FOREIGN KEY (workspace_id) REFERENCES public.workspace(id);


--
-- Name: payment_allocation payment_allocation_payment_id_payment_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_allocation
    ADD CONSTRAINT payment_allocation_payment_id_payment_id_fk FOREIGN KEY (payment_id) REFERENCES public.payment(id);


--
-- Name: payment_allocation payment_allocation_receivable_id_account_receivable_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_allocation
    ADD CONSTRAINT payment_allocation_receivable_id_account_receivable_id_fk FOREIGN KEY (receivable_id) REFERENCES public.account_receivable(id);


--
-- Name: payment_allocation payment_allocation_workspace_id_workspace_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_allocation
    ADD CONSTRAINT payment_allocation_workspace_id_workspace_id_fk FOREIGN KEY (workspace_id) REFERENCES public.workspace(id);


--
-- Name: payment_evidence payment_evidence_payment_id_payment_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_evidence
    ADD CONSTRAINT payment_evidence_payment_id_payment_id_fk FOREIGN KEY (payment_id) REFERENCES public.payment(id) ON DELETE CASCADE;


--
-- Name: payment_evidence payment_evidence_uploaded_by_user_profile_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_evidence
    ADD CONSTRAINT payment_evidence_uploaded_by_user_profile_id_fk FOREIGN KEY (uploaded_by) REFERENCES public.user_profile(id);


--
-- Name: payment_evidence payment_evidence_workspace_id_workspace_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_evidence
    ADD CONSTRAINT payment_evidence_workspace_id_workspace_id_fk FOREIGN KEY (workspace_id) REFERENCES public.workspace(id);


--
-- Name: payment payment_order_id_sales_order_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment
    ADD CONSTRAINT payment_order_id_sales_order_id_fk FOREIGN KEY (order_id) REFERENCES public.sales_order(id);


--
-- Name: payment payment_workspace_id_workspace_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment
    ADD CONSTRAINT payment_workspace_id_workspace_id_fk FOREIGN KEY (workspace_id) REFERENCES public.workspace(id);


--
-- Name: price_history price_history_product_id_product_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_history
    ADD CONSTRAINT price_history_product_id_product_id_fk FOREIGN KEY (product_id) REFERENCES public.product(id);


--
-- Name: price_history price_history_workspace_id_workspace_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_history
    ADD CONSTRAINT price_history_workspace_id_workspace_id_fk FOREIGN KEY (workspace_id) REFERENCES public.workspace(id);


--
-- Name: pricing_rule pricing_rule_created_by_user_profile_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_rule
    ADD CONSTRAINT pricing_rule_created_by_user_profile_id_fk FOREIGN KEY (created_by) REFERENCES public.user_profile(id);


--
-- Name: pricing_rule pricing_rule_workspace_id_workspace_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_rule
    ADD CONSTRAINT pricing_rule_workspace_id_workspace_id_fk FOREIGN KEY (workspace_id) REFERENCES public.workspace(id);


--
-- Name: product_attribute product_attribute_product_id_product_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_attribute
    ADD CONSTRAINT product_attribute_product_id_product_id_fk FOREIGN KEY (product_id) REFERENCES public.product(id) ON DELETE CASCADE;


--
-- Name: product_attribute product_attribute_workspace_id_workspace_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_attribute
    ADD CONSTRAINT product_attribute_workspace_id_workspace_id_fk FOREIGN KEY (workspace_id) REFERENCES public.workspace(id);


--
-- Name: product product_brand_id_brand_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product
    ADD CONSTRAINT product_brand_id_brand_id_fk FOREIGN KEY (brand_id) REFERENCES public.brand(id);


--
-- Name: product product_category_id_category_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product
    ADD CONSTRAINT product_category_id_category_id_fk FOREIGN KEY (category_id) REFERENCES public.category(id);


--
-- Name: product_price product_price_product_id_product_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_price
    ADD CONSTRAINT product_price_product_id_product_id_fk FOREIGN KEY (product_id) REFERENCES public.product(id) ON DELETE CASCADE;


--
-- Name: product_price product_price_workspace_id_workspace_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_price
    ADD CONSTRAINT product_price_workspace_id_workspace_id_fk FOREIGN KEY (workspace_id) REFERENCES public.workspace(id);


--
-- Name: product product_supplier_id_supplier_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product
    ADD CONSTRAINT product_supplier_id_supplier_id_fk FOREIGN KEY (supplier_id) REFERENCES public.supplier(id);


--
-- Name: product_supplier product_supplier_product_id_product_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_supplier
    ADD CONSTRAINT product_supplier_product_id_product_id_fk FOREIGN KEY (product_id) REFERENCES public.product(id) ON DELETE CASCADE;


--
-- Name: product_supplier product_supplier_supplier_id_supplier_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_supplier
    ADD CONSTRAINT product_supplier_supplier_id_supplier_id_fk FOREIGN KEY (supplier_id) REFERENCES public.supplier(id);


--
-- Name: product_supplier product_supplier_workspace_id_workspace_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_supplier
    ADD CONSTRAINT product_supplier_workspace_id_workspace_id_fk FOREIGN KEY (workspace_id) REFERENCES public.workspace(id);


--
-- Name: product_uom_equivalence product_uom_equivalence_product_id_product_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_uom_equivalence
    ADD CONSTRAINT product_uom_equivalence_product_id_product_id_fk FOREIGN KEY (product_id) REFERENCES public.product(id) ON DELETE CASCADE;


--
-- Name: product_uom_equivalence product_uom_equivalence_workspace_id_workspace_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_uom_equivalence
    ADD CONSTRAINT product_uom_equivalence_workspace_id_workspace_id_fk FOREIGN KEY (workspace_id) REFERENCES public.workspace(id);


--
-- Name: product product_workspace_id_workspace_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product
    ADD CONSTRAINT product_workspace_id_workspace_id_fk FOREIGN KEY (workspace_id) REFERENCES public.workspace(id);


--
-- Name: quote quote_converted_order_id_sales_order_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote
    ADD CONSTRAINT quote_converted_order_id_sales_order_id_fk FOREIGN KEY (converted_order_id) REFERENCES public.sales_order(id);


--
-- Name: quote quote_created_by_user_profile_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote
    ADD CONSTRAINT quote_created_by_user_profile_id_fk FOREIGN KEY (created_by) REFERENCES public.user_profile(id);


--
-- Name: quote quote_customer_id_customer_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote
    ADD CONSTRAINT quote_customer_id_customer_id_fk FOREIGN KEY (customer_id) REFERENCES public.customer(id);


--
-- Name: quote_item quote_item_product_id_product_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_item
    ADD CONSTRAINT quote_item_product_id_product_id_fk FOREIGN KEY (product_id) REFERENCES public.product(id);


--
-- Name: quote_item quote_item_quote_id_quote_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_item
    ADD CONSTRAINT quote_item_quote_id_quote_id_fk FOREIGN KEY (quote_id) REFERENCES public.quote(id) ON DELETE CASCADE;


--
-- Name: quote_item quote_item_workspace_id_workspace_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_item
    ADD CONSTRAINT quote_item_workspace_id_workspace_id_fk FOREIGN KEY (workspace_id) REFERENCES public.workspace(id);


--
-- Name: quote quote_workspace_id_workspace_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote
    ADD CONSTRAINT quote_workspace_id_workspace_id_fk FOREIGN KEY (workspace_id) REFERENCES public.workspace(id);


--
-- Name: repricing_event repricing_event_workspace_id_workspace_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repricing_event
    ADD CONSTRAINT repricing_event_workspace_id_workspace_id_fk FOREIGN KEY (workspace_id) REFERENCES public.workspace(id);


--
-- Name: role_permission role_permission_permission_id_permission_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permission
    ADD CONSTRAINT role_permission_permission_id_permission_id_fk FOREIGN KEY (permission_id) REFERENCES public.permission(id) ON DELETE CASCADE;


--
-- Name: sales_order sales_order_closed_by_user_profile_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_order
    ADD CONSTRAINT sales_order_closed_by_user_profile_id_fk FOREIGN KEY (closed_by) REFERENCES public.user_profile(id);


--
-- Name: sales_order sales_order_created_by_user_profile_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_order
    ADD CONSTRAINT sales_order_created_by_user_profile_id_fk FOREIGN KEY (created_by) REFERENCES public.user_profile(id);


--
-- Name: sales_order sales_order_customer_id_customer_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_order
    ADD CONSTRAINT sales_order_customer_id_customer_id_fk FOREIGN KEY (customer_id) REFERENCES public.customer(id);


--
-- Name: sales_order sales_order_workspace_id_workspace_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_order
    ADD CONSTRAINT sales_order_workspace_id_workspace_id_fk FOREIGN KEY (workspace_id) REFERENCES public.workspace(id);


--
-- Name: signature signature_approval_id_approval_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signature
    ADD CONSTRAINT signature_approval_id_approval_id_fk FOREIGN KEY (approval_id) REFERENCES public.approval(id) ON DELETE CASCADE;


--
-- Name: signature signature_signed_by_user_profile_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signature
    ADD CONSTRAINT signature_signed_by_user_profile_id_fk FOREIGN KEY (signed_by) REFERENCES public.user_profile(id);


--
-- Name: signature signature_workspace_id_workspace_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signature
    ADD CONSTRAINT signature_workspace_id_workspace_id_fk FOREIGN KEY (workspace_id) REFERENCES public.workspace(id);


--
-- Name: stock_ledger stock_ledger_product_id_product_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_ledger
    ADD CONSTRAINT stock_ledger_product_id_product_id_fk FOREIGN KEY (product_id) REFERENCES public.product(id);


--
-- Name: stock_ledger stock_ledger_warehouse_id_warehouse_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_ledger
    ADD CONSTRAINT stock_ledger_warehouse_id_warehouse_id_fk FOREIGN KEY (warehouse_id) REFERENCES public.warehouse(id);


--
-- Name: stock_ledger stock_ledger_workspace_id_workspace_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_ledger
    ADD CONSTRAINT stock_ledger_workspace_id_workspace_id_fk FOREIGN KEY (workspace_id) REFERENCES public.workspace(id);


--
-- Name: stock_movement stock_movement_product_id_product_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movement
    ADD CONSTRAINT stock_movement_product_id_product_id_fk FOREIGN KEY (product_id) REFERENCES public.product(id);


--
-- Name: stock_movement stock_movement_warehouse_id_warehouse_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movement
    ADD CONSTRAINT stock_movement_warehouse_id_warehouse_id_fk FOREIGN KEY (warehouse_id) REFERENCES public.warehouse(id);


--
-- Name: stock_movement stock_movement_workspace_id_workspace_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movement
    ADD CONSTRAINT stock_movement_workspace_id_workspace_id_fk FOREIGN KEY (workspace_id) REFERENCES public.workspace(id);


--
-- Name: supplier supplier_workspace_id_workspace_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier
    ADD CONSTRAINT supplier_workspace_id_workspace_id_fk FOREIGN KEY (workspace_id) REFERENCES public.workspace(id);


--
-- Name: system_alert system_alert_workspace_id_workspace_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_alert
    ADD CONSTRAINT system_alert_workspace_id_workspace_id_fk FOREIGN KEY (workspace_id) REFERENCES public.workspace(id);


--
-- Name: user_profile user_profile_organization_id_organization_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profile
    ADD CONSTRAINT user_profile_organization_id_organization_id_fk FOREIGN KEY (organization_id) REFERENCES public.organization(id);


--
-- Name: vendor_commission vendor_commission_order_id_sales_order_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_commission
    ADD CONSTRAINT vendor_commission_order_id_sales_order_id_fk FOREIGN KEY (order_id) REFERENCES public.sales_order(id);


--
-- Name: vendor_commission vendor_commission_vendor_id_user_profile_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_commission
    ADD CONSTRAINT vendor_commission_vendor_id_user_profile_id_fk FOREIGN KEY (vendor_id) REFERENCES public.user_profile(id);


--
-- Name: vendor_commission vendor_commission_workspace_id_workspace_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_commission
    ADD CONSTRAINT vendor_commission_workspace_id_workspace_id_fk FOREIGN KEY (workspace_id) REFERENCES public.workspace(id);


--
-- Name: warehouse_location warehouse_location_warehouse_id_warehouse_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_location
    ADD CONSTRAINT warehouse_location_warehouse_id_warehouse_id_fk FOREIGN KEY (warehouse_id) REFERENCES public.warehouse(id) ON DELETE CASCADE;


--
-- Name: warehouse_location warehouse_location_workspace_id_workspace_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_location
    ADD CONSTRAINT warehouse_location_workspace_id_workspace_id_fk FOREIGN KEY (workspace_id) REFERENCES public.workspace(id);


--
-- Name: warehouse warehouse_workspace_id_workspace_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse
    ADD CONSTRAINT warehouse_workspace_id_workspace_id_fk FOREIGN KEY (workspace_id) REFERENCES public.workspace(id);


--
-- Name: workspace workspace_created_by_user_profile_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace
    ADD CONSTRAINT workspace_created_by_user_profile_id_fk FOREIGN KEY (created_by) REFERENCES public.user_profile(id);


--
-- Name: workspace_member workspace_member_invited_by_user_profile_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_member
    ADD CONSTRAINT workspace_member_invited_by_user_profile_id_fk FOREIGN KEY (invited_by) REFERENCES public.user_profile(id);


--
-- Name: workspace_member workspace_member_user_id_user_profile_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_member
    ADD CONSTRAINT workspace_member_user_id_user_profile_id_fk FOREIGN KEY (user_id) REFERENCES public.user_profile(id) ON DELETE CASCADE;


--
-- Name: workspace_member workspace_member_workspace_id_workspace_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_member
    ADD CONSTRAINT workspace_member_workspace_id_workspace_id_fk FOREIGN KEY (workspace_id) REFERENCES public.workspace(id) ON DELETE CASCADE;


--
-- Name: workspace_module workspace_module_enabled_by_user_profile_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_module
    ADD CONSTRAINT workspace_module_enabled_by_user_profile_id_fk FOREIGN KEY (enabled_by) REFERENCES public.user_profile(id);


--
-- Name: workspace_module workspace_module_workspace_id_workspace_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_module
    ADD CONSTRAINT workspace_module_workspace_id_workspace_id_fk FOREIGN KEY (workspace_id) REFERENCES public.workspace(id) ON DELETE CASCADE;


--
-- Name: workspace workspace_organization_id_organization_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace
    ADD CONSTRAINT workspace_organization_id_organization_id_fk FOREIGN KEY (organization_id) REFERENCES public.organization(id);


--
-- Name: workspace_profile workspace_profile_workspace_id_workspace_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_profile
    ADD CONSTRAINT workspace_profile_workspace_id_workspace_id_fk FOREIGN KEY (workspace_id) REFERENCES public.workspace(id) ON DELETE CASCADE;


--
-- Name: workspace_quota workspace_quota_workspace_id_workspace_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_quota
    ADD CONSTRAINT workspace_quota_workspace_id_workspace_id_fk FOREIGN KEY (workspace_id) REFERENCES public.workspace(id) ON DELETE CASCADE;


--
-- Name: account_receivable; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.account_receivable ENABLE ROW LEVEL SECURITY;

--
-- Name: account_receivable account_receivable_workspace_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY account_receivable_workspace_isolation ON public.account_receivable TO app_user USING ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid)) WITH CHECK ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid));


--
-- Name: ai_prompt_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_prompt_config ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_prompt_config ai_prompt_config_workspace_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_prompt_config_workspace_isolation ON public.ai_prompt_config TO app_user USING ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid)) WITH CHECK ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid));


--
-- Name: approval; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.approval ENABLE ROW LEVEL SECURITY;

--
-- Name: approval approval_workspace_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY approval_workspace_isolation ON public.approval TO app_user USING ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid)) WITH CHECK ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid));


--
-- Name: ar_installment; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ar_installment ENABLE ROW LEVEL SECURITY;

--
-- Name: ar_installment ar_installment_workspace_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ar_installment_workspace_isolation ON public.ar_installment TO app_user USING ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid)) WITH CHECK ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid));


--
-- Name: audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_log audit_log_workspace_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_log_workspace_insert ON public.audit_log FOR INSERT TO app_user WITH CHECK ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid));


--
-- Name: audit_log audit_log_workspace_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_log_workspace_select ON public.audit_log FOR SELECT TO app_user USING ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid));


--
-- Name: brand; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.brand ENABLE ROW LEVEL SECURITY;

--
-- Name: brand brand_workspace_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY brand_workspace_isolation ON public.brand TO app_user USING ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid)) WITH CHECK ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid));


--
-- Name: cash_closure; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cash_closure ENABLE ROW LEVEL SECURITY;

--
-- Name: cash_closure cash_closure_workspace_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cash_closure_workspace_isolation ON public.cash_closure TO app_user USING ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid)) WITH CHECK ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid));


--
-- Name: category; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.category ENABLE ROW LEVEL SECURITY;

--
-- Name: category_alias; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.category_alias ENABLE ROW LEVEL SECURITY;

--
-- Name: category_alias category_alias_workspace_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY category_alias_workspace_isolation ON public.category_alias TO app_user USING ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid)) WITH CHECK ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid));


--
-- Name: category category_workspace_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY category_workspace_isolation ON public.category TO app_user USING ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid)) WITH CHECK ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid));


--
-- Name: channel_allocation; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.channel_allocation ENABLE ROW LEVEL SECURITY;

--
-- Name: channel_allocation channel_allocation_workspace_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY channel_allocation_workspace_isolation ON public.channel_allocation TO app_user USING ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid)) WITH CHECK ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid));


--
-- Name: container; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.container ENABLE ROW LEVEL SECURITY;

--
-- Name: container_document; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.container_document ENABLE ROW LEVEL SECURITY;

--
-- Name: container_document container_document_workspace_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY container_document_workspace_isolation ON public.container_document TO app_user USING ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid)) WITH CHECK ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid));


--
-- Name: container_item; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.container_item ENABLE ROW LEVEL SECURITY;

--
-- Name: container_item container_item_workspace_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY container_item_workspace_isolation ON public.container_item TO app_user USING ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid)) WITH CHECK ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid));


--
-- Name: container container_workspace_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY container_workspace_isolation ON public.container TO app_user USING ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid)) WITH CHECK ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid));


--
-- Name: customer; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customer ENABLE ROW LEVEL SECURITY;

--
-- Name: customer_address; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customer_address ENABLE ROW LEVEL SECURITY;

--
-- Name: customer_address customer_address_workspace_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customer_address_workspace_isolation ON public.customer_address TO app_user USING ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid)) WITH CHECK ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid));


--
-- Name: customer customer_workspace_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customer_workspace_isolation ON public.customer TO app_user USING ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid)) WITH CHECK ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid));


--
-- Name: delivery_note; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.delivery_note ENABLE ROW LEVEL SECURITY;

--
-- Name: delivery_note_item; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.delivery_note_item ENABLE ROW LEVEL SECURITY;

--
-- Name: delivery_note_item delivery_note_item_workspace_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY delivery_note_item_workspace_isolation ON public.delivery_note_item TO app_user USING ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid)) WITH CHECK ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid));


--
-- Name: delivery_note delivery_note_workspace_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY delivery_note_workspace_isolation ON public.delivery_note TO app_user USING ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid)) WITH CHECK ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid));


--
-- Name: document_sequence; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_sequence ENABLE ROW LEVEL SECURITY;

--
-- Name: document_sequence document_sequence_workspace_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_sequence_workspace_isolation ON public.document_sequence TO app_user USING ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid)) WITH CHECK ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid));


--
-- Name: exchange_rate; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.exchange_rate ENABLE ROW LEVEL SECURITY;

--
-- Name: exchange_rate exchange_rate_workspace_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY exchange_rate_workspace_isolation ON public.exchange_rate TO app_user USING ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid)) WITH CHECK ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid));


--
-- Name: import_session; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.import_session ENABLE ROW LEVEL SECURITY;

--
-- Name: import_session_row; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.import_session_row ENABLE ROW LEVEL SECURITY;

--
-- Name: import_session_row import_session_row_workspace_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY import_session_row_workspace_isolation ON public.import_session_row TO app_user USING ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid)) WITH CHECK ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid));


--
-- Name: import_session import_session_workspace_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY import_session_workspace_isolation ON public.import_session TO app_user USING ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid)) WITH CHECK ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid));


--
-- Name: integration_failure; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.integration_failure ENABLE ROW LEVEL SECURITY;

--
-- Name: integration_failure integration_failure_workspace_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY integration_failure_workspace_isolation ON public.integration_failure TO app_user USING ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid)) WITH CHECK ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid));


--
-- Name: integration_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.integration_log ENABLE ROW LEVEL SECURITY;

--
-- Name: integration_log integration_log_workspace_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY integration_log_workspace_isolation ON public.integration_log TO app_user USING ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid)) WITH CHECK ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid));


--
-- Name: internal_invoice; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.internal_invoice ENABLE ROW LEVEL SECURITY;

--
-- Name: internal_invoice_item; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.internal_invoice_item ENABLE ROW LEVEL SECURITY;

--
-- Name: internal_invoice_item internal_invoice_item_workspace_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY internal_invoice_item_workspace_isolation ON public.internal_invoice_item TO app_user USING ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid)) WITH CHECK ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid));


--
-- Name: internal_invoice internal_invoice_workspace_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY internal_invoice_workspace_isolation ON public.internal_invoice TO app_user USING ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid)) WITH CHECK ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid));


--
-- Name: inventory_count; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_count ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_count_item; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_count_item ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_count_item inventory_count_item_workspace_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_count_item_workspace_isolation ON public.inventory_count_item TO app_user USING ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid)) WITH CHECK ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid));


--
-- Name: inventory_count inventory_count_workspace_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_count_workspace_isolation ON public.inventory_count TO app_user USING ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid)) WITH CHECK ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid));


--
-- Name: inventory_discrepancy; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_discrepancy ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_discrepancy inventory_discrepancy_workspace_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_discrepancy_workspace_isolation ON public.inventory_discrepancy TO app_user USING ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid)) WITH CHECK ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid));


--
-- Name: mercadolibre_account; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mercadolibre_account ENABLE ROW LEVEL SECURITY;

--
-- Name: mercadolibre_account mercadolibre_account_workspace_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mercadolibre_account_workspace_isolation ON public.mercadolibre_account TO app_user USING ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid)) WITH CHECK ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid));


--
-- Name: mercadolibre_order_event; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mercadolibre_order_event ENABLE ROW LEVEL SECURITY;

--
-- Name: mercadolibre_order_event mercadolibre_order_event_workspace_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mercadolibre_order_event_workspace_isolation ON public.mercadolibre_order_event TO app_user USING ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid)) WITH CHECK ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid));


--
-- Name: ml_listing; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ml_listing ENABLE ROW LEVEL SECURITY;

--
-- Name: ml_listing ml_listing_workspace_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ml_listing_workspace_isolation ON public.ml_listing TO app_user USING ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid)) WITH CHECK ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid));


--
-- Name: ml_order; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ml_order ENABLE ROW LEVEL SECURITY;

--
-- Name: ml_order ml_order_workspace_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ml_order_workspace_isolation ON public.ml_order TO app_user USING ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid)) WITH CHECK ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid));


--
-- Name: notification_bucket; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notification_bucket ENABLE ROW LEVEL SECURITY;

--
-- Name: notification_bucket_assignee; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notification_bucket_assignee ENABLE ROW LEVEL SECURITY;

--
-- Name: notification_bucket_assignee notification_bucket_assignee_workspace_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notification_bucket_assignee_workspace_isolation ON public.notification_bucket_assignee TO app_user USING ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid)) WITH CHECK ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid));


--
-- Name: notification_bucket notification_bucket_workspace_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notification_bucket_workspace_isolation ON public.notification_bucket TO app_user USING ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid)) WITH CHECK ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid));


--
-- Name: notification_routing_rule; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notification_routing_rule ENABLE ROW LEVEL SECURITY;

--
-- Name: notification_routing_rule notification_routing_rule_workspace_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notification_routing_rule_workspace_isolation ON public.notification_routing_rule TO app_user USING ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid)) WITH CHECK ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid));


--
-- Name: order_item; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_item ENABLE ROW LEVEL SECURITY;

--
-- Name: order_item order_item_workspace_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_item_workspace_isolation ON public.order_item TO app_user USING ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid)) WITH CHECK ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid));


--
-- Name: organization; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organization ENABLE ROW LEVEL SECURITY;

--
-- Name: payment; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_allocation; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_allocation ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_allocation payment_allocation_workspace_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payment_allocation_workspace_isolation ON public.payment_allocation TO app_user USING ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid)) WITH CHECK ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid));


--
-- Name: payment_evidence; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_evidence ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_evidence payment_evidence_workspace_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payment_evidence_workspace_isolation ON public.payment_evidence TO app_user USING ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid)) WITH CHECK ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid));


--
-- Name: payment payment_workspace_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payment_workspace_isolation ON public.payment TO app_user USING ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid)) WITH CHECK ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid));


--
-- Name: permission; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.permission ENABLE ROW LEVEL SECURITY;

--
-- Name: permission permission_app_user_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY permission_app_user_select ON public.permission FOR SELECT TO app_user USING (true);


--
-- Name: price_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;

--
-- Name: price_history price_history_workspace_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY price_history_workspace_isolation ON public.price_history TO app_user USING ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid)) WITH CHECK ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid));


--
-- Name: pricing_rule; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pricing_rule ENABLE ROW LEVEL SECURITY;

--
-- Name: pricing_rule pricing_rule_workspace_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pricing_rule_workspace_isolation ON public.pricing_rule TO app_user USING ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid)) WITH CHECK ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid));


--
-- Name: product; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product ENABLE ROW LEVEL SECURITY;

--
-- Name: product_attribute; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_attribute ENABLE ROW LEVEL SECURITY;

--
-- Name: product_attribute product_attribute_workspace_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY product_attribute_workspace_isolation ON public.product_attribute TO app_user USING ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid)) WITH CHECK ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid));


--
-- Name: product_price; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_price ENABLE ROW LEVEL SECURITY;

--
-- Name: product_price product_price_workspace_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY product_price_workspace_isolation ON public.product_price TO app_user USING ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid)) WITH CHECK ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid));


--
-- Name: product_supplier; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_supplier ENABLE ROW LEVEL SECURITY;

--
-- Name: product_supplier product_supplier_workspace_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY product_supplier_workspace_isolation ON public.product_supplier TO app_user USING ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid)) WITH CHECK ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid));


--
-- Name: product_uom_equivalence; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_uom_equivalence ENABLE ROW LEVEL SECURITY;

--
-- Name: product_uom_equivalence product_uom_equivalence_workspace_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY product_uom_equivalence_workspace_isolation ON public.product_uom_equivalence TO app_user USING ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid)) WITH CHECK ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid));


--
-- Name: product product_workspace_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY product_workspace_isolation ON public.product TO app_user USING ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid)) WITH CHECK ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid));


--
-- Name: quote; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quote ENABLE ROW LEVEL SECURITY;

--
-- Name: quote_item; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quote_item ENABLE ROW LEVEL SECURITY;

--
-- Name: quote_item quote_item_workspace_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quote_item_workspace_isolation ON public.quote_item TO app_user USING ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid)) WITH CHECK ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid));


--
-- Name: quote quote_workspace_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quote_workspace_isolation ON public.quote TO app_user USING ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid)) WITH CHECK ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid));


--
-- Name: rate_limit_bucket; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rate_limit_bucket ENABLE ROW LEVEL SECURITY;

--
-- Name: rate_limit_lockout; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rate_limit_lockout ENABLE ROW LEVEL SECURITY;

--
-- Name: repricing_event; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.repricing_event ENABLE ROW LEVEL SECURITY;

--
-- Name: repricing_event repricing_event_workspace_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY repricing_event_workspace_isolation ON public.repricing_event TO app_user USING ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid)) WITH CHECK ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid));


--
-- Name: role_permission; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.role_permission ENABLE ROW LEVEL SECURITY;

--
-- Name: role_permission role_permission_app_user_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY role_permission_app_user_select ON public.role_permission FOR SELECT TO app_user USING (true);


--
-- Name: sales_order; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sales_order ENABLE ROW LEVEL SECURITY;

--
-- Name: sales_order sales_order_workspace_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sales_order_workspace_isolation ON public.sales_order TO app_user USING ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid)) WITH CHECK ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid));


--
-- Name: signature; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.signature ENABLE ROW LEVEL SECURITY;

--
-- Name: signature signature_workspace_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY signature_workspace_isolation ON public.signature TO app_user USING ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid)) WITH CHECK ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid));


--
-- Name: stock_ledger; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stock_ledger ENABLE ROW LEVEL SECURITY;

--
-- Name: stock_ledger stock_ledger_workspace_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY stock_ledger_workspace_isolation ON public.stock_ledger TO app_user USING ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid)) WITH CHECK ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid));


--
-- Name: stock_movement; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stock_movement ENABLE ROW LEVEL SECURITY;

--
-- Name: stock_movement stock_movement_workspace_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY stock_movement_workspace_isolation ON public.stock_movement TO app_user USING ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid)) WITH CHECK ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid));


--
-- Name: supplier; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.supplier ENABLE ROW LEVEL SECURITY;

--
-- Name: supplier supplier_workspace_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY supplier_workspace_isolation ON public.supplier TO app_user USING ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid)) WITH CHECK ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid));


--
-- Name: system_alert; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.system_alert ENABLE ROW LEVEL SECURITY;

--
-- Name: system_alert system_alert_workspace_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY system_alert_workspace_isolation ON public.system_alert TO app_user USING ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid)) WITH CHECK ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid));


--
-- Name: user_profile; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_profile ENABLE ROW LEVEL SECURITY;

--
-- Name: user_profile user_profile_app_user_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_profile_app_user_select ON public.user_profile FOR SELECT TO app_user USING ((EXISTS ( SELECT 1
   FROM public.workspace_member m
  WHERE ((m.user_id = user_profile.id) AND (m.workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid) AND (m.status = ANY (ARRAY['active'::public.member_status, 'suspended'::public.member_status]))))));


--
-- Name: user_profile user_profile_app_user_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_profile_app_user_update ON public.user_profile FOR UPDATE TO app_user USING ((EXISTS ( SELECT 1
   FROM public.workspace_member m
  WHERE ((m.user_id = user_profile.id) AND (m.workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid) AND (m.status = 'active'::public.member_status))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.workspace_member m
  WHERE ((m.user_id = user_profile.id) AND (m.workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid) AND (m.status = 'active'::public.member_status)))));


--
-- Name: user_session_activity; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_session_activity ENABLE ROW LEVEL SECURITY;

--
-- Name: vendor_commission; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vendor_commission ENABLE ROW LEVEL SECURITY;

--
-- Name: vendor_commission vendor_commission_workspace_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY vendor_commission_workspace_isolation ON public.vendor_commission TO app_user USING ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid)) WITH CHECK ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid));


--
-- Name: warehouse; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.warehouse ENABLE ROW LEVEL SECURITY;

--
-- Name: warehouse_location; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.warehouse_location ENABLE ROW LEVEL SECURITY;

--
-- Name: warehouse_location warehouse_location_workspace_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY warehouse_location_workspace_isolation ON public.warehouse_location TO app_user USING ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid)) WITH CHECK ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid));


--
-- Name: warehouse warehouse_workspace_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY warehouse_workspace_isolation ON public.warehouse TO app_user USING ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid)) WITH CHECK ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid));


--
-- Name: workspace; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workspace ENABLE ROW LEVEL SECURITY;

--
-- Name: workspace workspace_app_user_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_app_user_select ON public.workspace FOR SELECT TO app_user USING ((id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid));


--
-- Name: workspace workspace_app_user_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_app_user_update ON public.workspace FOR UPDATE TO app_user USING ((id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid)) WITH CHECK ((id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid));


--
-- Name: workspace_member; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workspace_member ENABLE ROW LEVEL SECURITY;

--
-- Name: workspace_member workspace_member_workspace_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_member_workspace_isolation ON public.workspace_member TO app_user USING ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid)) WITH CHECK ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid));


--
-- Name: workspace_module; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workspace_module ENABLE ROW LEVEL SECURITY;

--
-- Name: workspace_module workspace_module_workspace_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_module_workspace_isolation ON public.workspace_module TO app_user USING ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid)) WITH CHECK ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid));


--
-- Name: workspace_profile; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workspace_profile ENABLE ROW LEVEL SECURITY;

--
-- Name: workspace_profile workspace_profile_workspace_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_profile_workspace_isolation ON public.workspace_profile TO app_user USING ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid)) WITH CHECK ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid));


--
-- Name: workspace_quota; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workspace_quota ENABLE ROW LEVEL SECURITY;

--
-- Name: workspace_quota workspace_quota_workspace_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_quota_workspace_isolation ON public.workspace_quota TO app_user USING ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid)) WITH CHECK ((workspace_id = (( SELECT current_setting('app.workspace_id'::text, true) AS current_setting))::uuid));


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT USAGE ON SCHEMA public TO app_user;


--
-- Name: FUNCTION enforce_workspace_quota(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.enforce_workspace_quota() FROM PUBLIC;
GRANT ALL ON FUNCTION public.enforce_workspace_quota() TO service_role;


--
-- Name: FUNCTION find_active_user_id_by_email(p_email text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.find_active_user_id_by_email(p_email text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.find_active_user_id_by_email(p_email text) TO service_role;
GRANT ALL ON FUNCTION public.find_active_user_id_by_email(p_email text) TO app_user;


--
-- Name: FUNCTION generate_order_number(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.generate_order_number() FROM PUBLIC;
GRANT ALL ON FUNCTION public.generate_order_number() TO service_role;


--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;


--
-- Name: FUNCTION is_workspace_member(p_user_id uuid, p_workspace_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_workspace_member(p_user_id uuid, p_workspace_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_workspace_member(p_user_id uuid, p_workspace_id uuid) TO service_role;


--
-- Name: FUNCTION next_document_number(p_workspace_id uuid, p_document_type text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.next_document_number(p_workspace_id uuid, p_document_type text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.next_document_number(p_workspace_id uuid, p_document_type text) TO service_role;
GRANT ALL ON FUNCTION public.next_document_number(p_workspace_id uuid, p_document_type text) TO app_user;


--
-- Name: FUNCTION rate_limit_gc(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.rate_limit_gc() FROM PUBLIC;
GRANT ALL ON FUNCTION public.rate_limit_gc() TO service_role;


--
-- Name: FUNCTION record_price_change(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.record_price_change() FROM PUBLIC;
GRANT ALL ON FUNCTION public.record_price_change() TO service_role;


--
-- Name: FUNCTION rls_auto_enable(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
GRANT ALL ON FUNCTION public.rls_auto_enable() TO service_role;


--
-- Name: FUNCTION touch_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.touch_updated_at() TO anon;
GRANT ALL ON FUNCTION public.touch_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.touch_updated_at() TO service_role;


--
-- Name: FUNCTION update_ar_on_payment(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.update_ar_on_payment() FROM PUBLIC;
GRANT ALL ON FUNCTION public.update_ar_on_payment() TO service_role;


--
-- Name: FUNCTION user_membership_count(p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.user_membership_count(p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.user_membership_count(p_user_id uuid) TO service_role;
GRANT ALL ON FUNCTION public.user_membership_count(p_user_id uuid) TO app_user;


--
-- Name: FUNCTION validate_stock_quantity(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.validate_stock_quantity() FROM PUBLIC;
GRANT ALL ON FUNCTION public.validate_stock_quantity() TO service_role;


--
-- Name: TABLE account_receivable; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.account_receivable TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.account_receivable TO app_user;


--
-- Name: TABLE ai_prompt_config; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.ai_prompt_config TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.ai_prompt_config TO app_user;


--
-- Name: TABLE approval; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.approval TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.approval TO app_user;


--
-- Name: TABLE ar_installment; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.ar_installment TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.ar_installment TO app_user;


--
-- Name: TABLE audit_log; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.audit_log TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.audit_log TO app_user;


--
-- Name: TABLE brand; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.brand TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.brand TO app_user;


--
-- Name: TABLE cash_closure; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.cash_closure TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.cash_closure TO app_user;


--
-- Name: TABLE category; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.category TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.category TO app_user;


--
-- Name: TABLE category_alias; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.category_alias TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.category_alias TO app_user;


--
-- Name: TABLE channel_allocation; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.channel_allocation TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.channel_allocation TO app_user;


--
-- Name: TABLE container; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.container TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.container TO app_user;


--
-- Name: TABLE container_document; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.container_document TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.container_document TO app_user;


--
-- Name: TABLE container_item; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.container_item TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.container_item TO app_user;


--
-- Name: TABLE customer; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.customer TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.customer TO app_user;


--
-- Name: TABLE customer_address; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.customer_address TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.customer_address TO app_user;


--
-- Name: TABLE delivery_note; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.delivery_note TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.delivery_note TO app_user;


--
-- Name: TABLE delivery_note_item; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.delivery_note_item TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.delivery_note_item TO app_user;


--
-- Name: TABLE document_sequence; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.document_sequence TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.document_sequence TO app_user;


--
-- Name: TABLE exchange_rate; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.exchange_rate TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.exchange_rate TO app_user;


--
-- Name: TABLE import_session; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.import_session TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.import_session TO app_user;


--
-- Name: TABLE import_session_row; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.import_session_row TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.import_session_row TO app_user;


--
-- Name: TABLE integration_failure; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.integration_failure TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.integration_failure TO app_user;


--
-- Name: TABLE integration_log; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.integration_log TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.integration_log TO app_user;


--
-- Name: TABLE internal_invoice; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.internal_invoice TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.internal_invoice TO app_user;


--
-- Name: TABLE internal_invoice_item; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.internal_invoice_item TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.internal_invoice_item TO app_user;


--
-- Name: TABLE inventory_count; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.inventory_count TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.inventory_count TO app_user;


--
-- Name: TABLE inventory_count_item; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.inventory_count_item TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.inventory_count_item TO app_user;


--
-- Name: TABLE inventory_discrepancy; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.inventory_discrepancy TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.inventory_discrepancy TO app_user;


--
-- Name: TABLE mercadolibre_account; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.mercadolibre_account TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.mercadolibre_account TO app_user;


--
-- Name: TABLE mercadolibre_order_event; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.mercadolibre_order_event TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.mercadolibre_order_event TO app_user;


--
-- Name: TABLE ml_listing; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.ml_listing TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.ml_listing TO app_user;


--
-- Name: TABLE ml_order; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.ml_order TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.ml_order TO app_user;


--
-- Name: TABLE notification_bucket; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.notification_bucket TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.notification_bucket TO app_user;


--
-- Name: TABLE notification_bucket_assignee; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.notification_bucket_assignee TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.notification_bucket_assignee TO app_user;


--
-- Name: TABLE notification_routing_rule; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.notification_routing_rule TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.notification_routing_rule TO app_user;


--
-- Name: TABLE order_item; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.order_item TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.order_item TO app_user;


--
-- Name: TABLE organization; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.organization TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.organization TO app_user;


--
-- Name: TABLE payment; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.payment TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.payment TO app_user;


--
-- Name: TABLE payment_allocation; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.payment_allocation TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.payment_allocation TO app_user;


--
-- Name: TABLE payment_evidence; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.payment_evidence TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.payment_evidence TO app_user;


--
-- Name: TABLE permission; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.permission TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.permission TO app_user;


--
-- Name: TABLE price_history; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.price_history TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.price_history TO app_user;


--
-- Name: TABLE pricing_rule; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.pricing_rule TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.pricing_rule TO app_user;


--
-- Name: TABLE product; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.product TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.product TO app_user;


--
-- Name: TABLE product_attribute; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.product_attribute TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.product_attribute TO app_user;


--
-- Name: TABLE product_price; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.product_price TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.product_price TO app_user;


--
-- Name: TABLE product_supplier; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.product_supplier TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.product_supplier TO app_user;


--
-- Name: TABLE product_uom_equivalence; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.product_uom_equivalence TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.product_uom_equivalence TO app_user;


--
-- Name: TABLE quote; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.quote TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.quote TO app_user;


--
-- Name: TABLE quote_item; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.quote_item TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.quote_item TO app_user;


--
-- Name: TABLE rate_limit_bucket; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.rate_limit_bucket TO service_role;


--
-- Name: TABLE rate_limit_lockout; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.rate_limit_lockout TO service_role;


--
-- Name: TABLE repricing_event; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.repricing_event TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.repricing_event TO app_user;


--
-- Name: TABLE role_permission; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.role_permission TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.role_permission TO app_user;


--
-- Name: TABLE sales_order; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.sales_order TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.sales_order TO app_user;


--
-- Name: TABLE signature; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.signature TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.signature TO app_user;


--
-- Name: TABLE stock_ledger; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.stock_ledger TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.stock_ledger TO app_user;


--
-- Name: TABLE stock_movement; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.stock_movement TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.stock_movement TO app_user;


--
-- Name: TABLE supplier; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.supplier TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.supplier TO app_user;


--
-- Name: TABLE system_alert; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.system_alert TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.system_alert TO app_user;


--
-- Name: TABLE user_profile; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_profile TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.user_profile TO app_user;


--
-- Name: TABLE user_session_activity; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_session_activity TO service_role;


--
-- Name: TABLE vendor_commission; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.vendor_commission TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.vendor_commission TO app_user;


--
-- Name: TABLE warehouse; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.warehouse TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.warehouse TO app_user;


--
-- Name: TABLE warehouse_location; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.warehouse_location TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.warehouse_location TO app_user;


--
-- Name: TABLE workspace; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.workspace TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.workspace TO app_user;


--
-- Name: TABLE workspace_member; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.workspace_member TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.workspace_member TO app_user;


--
-- Name: TABLE workspace_module; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.workspace_module TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.workspace_module TO app_user;


--
-- Name: TABLE workspace_profile; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.workspace_profile TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.workspace_profile TO app_user;


--
-- Name: TABLE workspace_quota; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.workspace_quota TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.workspace_quota TO app_user;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT USAGE ON SEQUENCES TO app_user;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO app_user;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--


