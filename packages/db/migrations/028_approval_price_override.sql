-- Cendaro ERP — Approval type for prices below the allowed floor, and the
-- credit note document prefix.
-- ALTER TYPE ... ADD VALUE stays out of an explicit transaction block.
--
-- Rollback: 028_approval_price_override.rollback.sql

ALTER TYPE public.approval_type ADD VALUE IF NOT EXISTS 'price_override';

CREATE OR REPLACE FUNCTION public.next_document_number(p_workspace_id uuid, p_document_type text)
  RETURNS text
  LANGUAGE plpgsql
  SET search_path TO 'public', 'pg_temp'
AS $function$
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
    WHEN 'credit_note'   THEN 'NC'
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
$function$;
