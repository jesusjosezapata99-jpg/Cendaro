-- Cendaro ERP — Rollback for 035_rag_pii_vault.sql
--
-- WARNING (IRREVERSIBLE CRYPTO-SHREDDING DATA LOSS):
-- Dropping `public.rag_pii_vault` permanently destroys all AES-256-GCM encrypted
-- PII and confidential commercial cost mappings backing `<PII_*>` and `<CONF_*>`
-- surrogate tokens stored in `public.rag_document_chunks` and `public.rag_documents`.
-- Any documents ingested while Phase 2 tokenization was active MUST be re-ingested
-- from their original source files if cleartext re-hydration is required after rollback.
--
-- Reverses:
-- 1. Drops public.rag_pii_vault table and all associated indexes, constraints, and policies.

BEGIN;

DROP TABLE IF EXISTS public.rag_pii_vault CASCADE;

COMMIT;
