-- Cendaro ERP — Append-only audit log with a per-workspace hash chain
--
-- The database computes the chain, so concurrent inserts stay linear and the
-- application cannot supply or skip a link. Rows written before this migration
-- keep empty chain columns: the chain starts at the first new row.
--
-- Rollback: 029_audit_chain.rollback.sql

BEGIN;

ALTER TABLE public.audit_log
  ADD COLUMN IF NOT EXISTS seq bigint,
  ADD COLUMN IF NOT EXISTS prev_hash text,
  ADD COLUMN IF NOT EXISTS chain_hash text;

UPDATE public.audit_log AS a
SET seq = numbered.position
FROM (
  SELECT id, row_number() OVER (ORDER BY created_at, id) AS position
  FROM public.audit_log
) AS numbered
WHERE a.id = numbered.id;

-- Assigned by the trigger once it holds the chain lock, never by a column
-- default: a number taken before the lock could order rows against their links.
CREATE SEQUENCE IF NOT EXISTS public.audit_log_seq OWNED BY public.audit_log.seq;
SELECT setval(
  'public.audit_log_seq',
  COALESCE((SELECT max(seq) FROM public.audit_log), 1),
  (SELECT max(seq) IS NOT NULL FROM public.audit_log)
);
REVOKE ALL ON SEQUENCE public.audit_log_seq FROM PUBLIC, anon, authenticated, app_user;

ALTER TABLE public.audit_log ALTER COLUMN seq SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_audit_log_seq ON public.audit_log (seq);

CREATE INDEX IF NOT EXISTS idx_audit_log_workspace_seq
  ON public.audit_log (workspace_id, seq DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_workspace_created
  ON public.audit_log (workspace_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.audit_log_chain()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_prev text;
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtextextended('audit_chain:' || COALESCE(NEW.workspace_id::text, 'global'), 0)
  );

  NEW.seq := nextval('public.audit_log_seq');

  IF NEW.workspace_id IS NULL THEN
    SELECT chain_hash INTO v_prev
    FROM public.audit_log
    WHERE workspace_id IS NULL AND chain_hash IS NOT NULL
    ORDER BY seq DESC
    LIMIT 1;
  ELSE
    SELECT chain_hash INTO v_prev
    FROM public.audit_log
    WHERE workspace_id = NEW.workspace_id AND chain_hash IS NOT NULL
    ORDER BY seq DESC
    LIMIT 1;
  END IF;

  NEW.prev_hash := COALESCE(v_prev, 'GENESIS');
  NEW.chain_hash := encode(
    extensions.digest(
      NEW.prev_hash || ':' || COALESCE(NEW.metadata ->> '_integrityHash', ''),
      'sha256'
    ),
    'hex'
  );
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.audit_log_chain()
  FROM PUBLIC, anon, authenticated, app_user;

DROP TRIGGER IF EXISTS trg_audit_log_chain ON public.audit_log;
CREATE TRIGGER trg_audit_log_chain
  BEFORE INSERT ON public.audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_log_chain();

CREATE OR REPLACE FUNCTION public.audit_log_immutable()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only';
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.audit_log_immutable()
  FROM PUBLIC, anon, authenticated, app_user;

DROP TRIGGER IF EXISTS trg_audit_log_immutable ON public.audit_log;
CREATE TRIGGER trg_audit_log_immutable
  BEFORE UPDATE OR DELETE ON public.audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_log_immutable();

DROP TRIGGER IF EXISTS trg_audit_log_no_truncate ON public.audit_log;
CREATE TRIGGER trg_audit_log_no_truncate
  BEFORE TRUNCATE ON public.audit_log
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.audit_log_immutable();

REVOKE UPDATE, DELETE, TRUNCATE ON public.audit_log FROM app_user;

COMMIT;
