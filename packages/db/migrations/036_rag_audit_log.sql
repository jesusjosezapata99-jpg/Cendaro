-- Cendaro ERP — Milestone 4: Phase 4 Tamper-Evident RAG Audit Hash Chain & WORM Immutability
-- Rollback: 036_rag_audit_log.rollback.sql
--
-- Closes V-07 & satisfies NIST AI RMF MANAGE / ISO 42001 / SOC 2 Type II non-repudiation:
-- 1. Creates append-only `public.rag_audit_log` with forced workspace RLS (SELECT + INSERT only for `app_user`).
-- 2. Linearizes per-workspace SHA-256 hash chaining via 64-bit `hashtextextended` transaction advisory lock
--    and `ENABLE ALWAYS TRIGGER trg_rag_audit_log_chain`.
-- 3. Enforces WORM immutability (`BEFORE UPDATE OR DELETE` + `BEFORE TRUNCATE` with `ENABLE ALWAYS TRIGGER`).
-- 4. Provides `public.verify_rag_audit_chain_integrity()` recomputing both `payload_hash` and `chain_hash`
--    for daily automated verification via `monitor_reader` without exposing query text or PII.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.rag_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL DEFAULT (current_setting('app.workspace_id', true)::uuid) REFERENCES public.workspace(id),
  user_id uuid REFERENCES public.user_profile(id),
  operation_type varchar(32) NOT NULL,
  query_text text,
  prompt_template_hash varchar(64) NOT NULL DEFAULT '',
  retrieved_chunk_ids uuid[] NOT NULL DEFAULT '{}',
  output_hash varchar(64) NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  latency_ms integer NOT NULL DEFAULT 0,
  token_usage jsonb NOT NULL DEFAULT '{"prompt":0,"completion":0,"total":0}'::jsonb,
  seq bigint,
  prev_hash text,
  payload_hash text,
  chain_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Assigned exclusively inside `rag_audit_log_chain()` once the workspace advisory lock is held.
CREATE SEQUENCE IF NOT EXISTS public.rag_audit_log_seq OWNED BY public.rag_audit_log.seq;
REVOKE ALL ON SEQUENCE public.rag_audit_log_seq FROM PUBLIC, anon, authenticated, app_user;

ALTER TABLE public.rag_audit_log
  ALTER COLUMN seq SET NOT NULL,
  ALTER COLUMN prev_hash SET NOT NULL,
  ALTER COLUMN payload_hash SET NOT NULL,
  ALTER COLUMN chain_hash SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_rag_audit_log_seq
  ON public.rag_audit_log (seq);

-- Covers workspace_id FK and orders chain lookups
CREATE INDEX IF NOT EXISTS idx_rag_audit_log_workspace_seq
  ON public.rag_audit_log (workspace_id, seq DESC);

CREATE INDEX IF NOT EXISTS idx_rag_audit_log_workspace_created
  ON public.rag_audit_log (workspace_id, created_at DESC);

-- Covers user_id FK (fk-index-coverage invariant)
CREATE INDEX IF NOT EXISTS idx_rag_audit_log_user_id
  ON public.rag_audit_log (user_id);

-- ── 1. Forced Row-Level Security (WORM: SELECT + INSERT only) ─────────────────

ALTER TABLE public.rag_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rag_audit_log FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rag_audit_log_workspace_select ON public.rag_audit_log;
CREATE POLICY rag_audit_log_workspace_select ON public.rag_audit_log
  AS PERMISSIVE FOR SELECT TO app_user
  USING (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);

DROP POLICY IF EXISTS rag_audit_log_workspace_insert ON public.rag_audit_log;
CREATE POLICY rag_audit_log_workspace_insert ON public.rag_audit_log
  AS PERMISSIVE FOR INSERT TO app_user
  WITH CHECK (workspace_id = (SELECT current_setting('app.workspace_id', true))::uuid);

DROP POLICY IF EXISTS rag_audit_log_monitor_select ON public.rag_audit_log;
CREATE POLICY rag_audit_log_monitor_select ON public.rag_audit_log
  AS PERMISSIVE FOR SELECT TO monitor_reader
  USING (true);

-- ── 2. Cryptographic SHA-256 Hash-Chaining Trigger ────────────────────────────

CREATE OR REPLACE FUNCTION public.rag_audit_log_chain()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_prev text;
  v_session_ws uuid;
BEGIN
  v_session_ws := NULLIF(current_setting('app.workspace_id', true), '')::uuid;
  IF v_session_ws IS NOT NULL AND NEW.workspace_id IS DISTINCT FROM v_session_ws THEN
    RAISE EXCEPTION 'rag_audit_log workspace_id mismatch with session context'
      USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('rag_audit_chain:' || COALESCE(NEW.workspace_id::text, 'global'), 0)
  );

  NEW.seq := nextval('public.rag_audit_log_seq');

  SELECT chain_hash INTO v_prev
  FROM public.rag_audit_log
  WHERE workspace_id = NEW.workspace_id AND chain_hash IS NOT NULL
  ORDER BY seq DESC
  LIMIT 1;

  NEW.prev_hash := COALESCE(v_prev, 'GENESIS_RAG');

  -- Bijective byte-length-prefixed framing (`octet_length(x)::text || '#' || x`) prevents
  -- delimiter-shifting collisions even when `query_text` contains `:`, `#`, or JSON syntax.
  NEW.payload_hash := encode(
    extensions.digest(
      octet_length(NEW.workspace_id::text)::text || '#' || NEW.workspace_id::text || '|' ||
      octet_length(COALESCE(NEW.user_id::text, 'system'))::text || '#' || COALESCE(NEW.user_id::text, 'system') || '|' ||
      octet_length(NEW.operation_type)::text || '#' || NEW.operation_type || '|' ||
      octet_length(COALESCE(NEW.query_text, ''))::text || '#' || COALESCE(NEW.query_text, '') || '|' ||
      octet_length(NEW.prompt_template_hash)::text || '#' || NEW.prompt_template_hash || '|' ||
      octet_length(array_to_string(NEW.retrieved_chunk_ids, ','))::text || '#' || array_to_string(NEW.retrieved_chunk_ids, ',') || '|' ||
      octet_length(NEW.output_hash)::text || '#' || NEW.output_hash || '|' ||
      octet_length(COALESCE(NEW.metadata::text, '{}'))::text || '#' || COALESCE(NEW.metadata::text, '{}'),
      'sha256'
    ),
    'hex'
  );

  NEW.chain_hash := encode(
    extensions.digest(
      NEW.prev_hash || ':' || NEW.payload_hash || ':' || NEW.seq::text,
      'sha256'
    ),
    'hex'
  );

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.rag_audit_log_chain()
  FROM PUBLIC, anon, authenticated, app_user;

DROP TRIGGER IF EXISTS trg_rag_audit_log_chain ON public.rag_audit_log;
CREATE TRIGGER trg_rag_audit_log_chain
  BEFORE INSERT ON public.rag_audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.rag_audit_log_chain();

ALTER TABLE public.rag_audit_log ENABLE ALWAYS TRIGGER trg_rag_audit_log_chain;

-- ── 3. WORM Immutability Enforcement ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rag_audit_log_immutable()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
BEGIN
  RAISE EXCEPTION 'rag_audit_log is append-only: modifications and deletions are strictly prohibited'
    USING ERRCODE = '42501';
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.rag_audit_log_immutable()
  FROM PUBLIC, anon, authenticated, app_user;

DROP TRIGGER IF EXISTS trg_rag_audit_log_immutable ON public.rag_audit_log;
CREATE TRIGGER trg_rag_audit_log_immutable
  BEFORE UPDATE OR DELETE ON public.rag_audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.rag_audit_log_immutable();

ALTER TABLE public.rag_audit_log ENABLE ALWAYS TRIGGER trg_rag_audit_log_immutable;

DROP TRIGGER IF EXISTS trg_rag_audit_log_no_truncate ON public.rag_audit_log;
CREATE TRIGGER trg_rag_audit_log_no_truncate
  BEFORE TRUNCATE ON public.rag_audit_log
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.rag_audit_log_immutable();

ALTER TABLE public.rag_audit_log ENABLE ALWAYS TRIGGER trg_rag_audit_log_no_truncate;

-- ── 4. Continuous Chain & Payload Digest Verifier ─────────────────────────────

CREATE OR REPLACE FUNCTION public.verify_rag_audit_chain_integrity()
  RETURNS TABLE (invariant text, violations bigint)
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public', 'extensions'
AS $function$
  WITH ranked AS (
    SELECT
      id,
      workspace_id,
      user_id,
      operation_type,
      query_text,
      prompt_template_hash,
      retrieved_chunk_ids,
      output_hash,
      metadata,
      seq,
      prev_hash,
      payload_hash,
      chain_hash,
      LAG(chain_hash) OVER (
        PARTITION BY workspace_id
        ORDER BY seq ASC
      ) AS expected_prev_hash
    FROM public.rag_audit_log
  ),
  recalculated AS (
    SELECT
      seq,
      prev_hash,
      expected_prev_hash,
      payload_hash,
      chain_hash,
      encode(
        extensions.digest(
          octet_length(workspace_id::text)::text || '#' || workspace_id::text || '|' ||
          octet_length(COALESCE(user_id::text, 'system'))::text || '#' || COALESCE(user_id::text, 'system') || '|' ||
          octet_length(operation_type)::text || '#' || operation_type || '|' ||
          octet_length(COALESCE(query_text, ''))::text || '#' || COALESCE(query_text, '') || '|' ||
          octet_length(prompt_template_hash)::text || '#' || prompt_template_hash || '|' ||
          octet_length(array_to_string(retrieved_chunk_ids, ','))::text || '#' || array_to_string(retrieved_chunk_ids, ',') || '|' ||
          octet_length(output_hash)::text || '#' || output_hash || '|' ||
          octet_length(COALESCE(metadata::text, '{}'))::text || '#' || COALESCE(metadata::text, '{}'),
          'sha256'
        ),
        'hex'
      ) AS expected_payload_hash
    FROM ranked
  )
  SELECT
    'rag_audit_broken_prev_link'::text AS invariant,
    COUNT(*)::bigint AS violations
  FROM recalculated
  WHERE prev_hash IS DISTINCT FROM COALESCE(expected_prev_hash, 'GENESIS_RAG')

  UNION ALL

  SELECT
    'rag_audit_unhashed_tail_gap'::text AS invariant,
    COUNT(*)::bigint AS violations
  FROM public.rag_audit_log
  WHERE chain_hash IS NULL OR payload_hash IS NULL

  UNION ALL

  SELECT
    'rag_audit_payload_tampered'::text AS invariant,
    COUNT(*)::bigint AS violations
  FROM recalculated
  WHERE payload_hash IS DISTINCT FROM expected_payload_hash
     OR chain_hash IS DISTINCT FROM encode(
          extensions.digest(
            COALESCE(prev_hash, '') || ':' || COALESCE(expected_payload_hash, '') || ':' || COALESCE(seq::text, ''),
            'sha256'
          ),
          'hex'
        );
$function$;

REVOKE EXECUTE ON FUNCTION public.verify_rag_audit_chain_integrity()
  FROM PUBLIC, anon, authenticated, app_user;

GRANT EXECUTE ON FUNCTION public.verify_rag_audit_chain_integrity()
  TO monitor_reader, service_role;

-- ── 5. Least-Privilege Table Grants ───────────────────────────────────────────

REVOKE ALL ON TABLE public.rag_audit_log FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.rag_audit_log TO app_user, service_role;
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public.rag_audit_log FROM app_user, service_role;

-- Column-level cryptographic header read ONLY for monitor_reader (zero PII / query_text)
GRANT SELECT (id, workspace_id, seq, prev_hash, payload_hash, chain_hash, created_at)
  ON public.rag_audit_log TO monitor_reader;

COMMIT;
