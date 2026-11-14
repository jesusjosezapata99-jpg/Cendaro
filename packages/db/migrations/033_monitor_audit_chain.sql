-- Cendaro ERP — Audit hash-chain observability & Merkle notarization grants for monitor_reader
--
-- Extends migration 031 (`monitor_reader`) so automated daily checks and external
-- cryptographic Merkle-root notarization can verify `public.audit_log` linkage
-- without exposing PII or business payloads (`old_value`, `new_value`, `metadata`,
-- `actor_name`, `ip_address`, `user_agent` remain strictly denied).
--
-- Rollback: 033_monitor_audit_chain.rollback.sql

BEGIN;

-- 1. Grant column-level SELECT ONLY on cryptographic chain headers (zero PII / payload columns)
GRANT SELECT (id, workspace_id, seq, prev_hash, chain_hash, created_at)
  ON public.audit_log TO monitor_reader;

DROP POLICY IF EXISTS audit_log_monitor_select ON public.audit_log;
CREATE POLICY audit_log_monitor_select ON public.audit_log
  AS PERMISSIVE FOR SELECT TO monitor_reader
  USING (true);

-- 2. Read-only SECURITY DEFINER verifier that recomputes SHA-256 digests against
--    `metadata->>'_integrityHash'` inside PostgreSQL and returns ONLY violation counts.
CREATE OR REPLACE FUNCTION public.verify_audit_chain_integrity()
  RETURNS TABLE (invariant text, violations bigint)
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public', 'extensions'
AS $function$
  WITH chained AS (
    SELECT
      COALESCE(workspace_id::text, 'global') AS scope_key,
      seq,
      prev_hash,
      chain_hash,
      metadata,
      LAG(chain_hash) OVER (
        PARTITION BY COALESCE(workspace_id::text, 'global')
        ORDER BY seq ASC
      ) AS expected_prev_hash
    FROM public.audit_log
    WHERE chain_hash IS NOT NULL
  ),
  chain_bounds AS (
    SELECT
      COALESCE(workspace_id::text, 'global') AS scope_key,
      MIN(seq) FILTER (WHERE chain_hash IS NOT NULL) AS first_chained_seq
    FROM public.audit_log
    GROUP BY COALESCE(workspace_id::text, 'global')
  )
  SELECT
    'audit_chain_broken_prev_link'::text AS invariant,
    COUNT(*)::bigint AS violations
  FROM chained
  WHERE prev_hash IS DISTINCT FROM COALESCE(expected_prev_hash, 'GENESIS')

  UNION ALL

  SELECT
    'audit_chain_corrupted_digest'::text AS invariant,
    COUNT(*)::bigint AS violations
  FROM chained
  WHERE chain_hash IS DISTINCT FROM encode(
    extensions.digest(
      COALESCE(prev_hash, '') || ':' || COALESCE(metadata ->> '_integrityHash', ''),
      'sha256'
    ),
    'hex'
  )

  UNION ALL

  SELECT
    'audit_chain_unhashed_tail_gap'::text AS invariant,
    COUNT(*)::bigint AS violations
  FROM public.audit_log AS a
  INNER JOIN chain_bounds AS b
    ON COALESCE(a.workspace_id::text, 'global') = b.scope_key
  WHERE b.first_chained_seq IS NOT NULL
    AND a.seq > b.first_chained_seq
    AND a.chain_hash IS NULL;
$function$;

REVOKE EXECUTE ON FUNCTION public.verify_audit_chain_integrity()
  FROM PUBLIC, anon, authenticated, app_user;

GRANT EXECUTE ON FUNCTION public.verify_audit_chain_integrity()
  TO monitor_reader, service_role;

COMMIT;
