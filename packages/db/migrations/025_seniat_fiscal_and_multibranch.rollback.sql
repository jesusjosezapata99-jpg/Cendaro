-- =============================================================================
-- Rollback 025: SENIAT Fiscal Engine, Legal Entities & Multi-Branch
-- =============================================================================

DROP TABLE IF EXISTS public.fiscal_document CASCADE;
DROP TABLE IF EXISTS public.branch CASCADE;
DROP TABLE IF EXISTS public.legal_entity CASCADE;
DROP TYPE IF EXISTS public.fiscal_document_type;
DROP TYPE IF EXISTS public.tax_classification;
