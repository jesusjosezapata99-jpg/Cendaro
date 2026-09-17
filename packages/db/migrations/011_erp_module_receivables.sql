-- Cendaro ERP — Add the 'receivables' ERP module
-- PLAN-2026-09-SECURITY-REMEDIATION, phase F2 (finding C2)
--
-- Accounts receivable (CxC) had no module of its own, so its procedures could
-- not be authorized or plan-gated. ALTER TYPE ... ADD VALUE is committed in
-- its own migration because a new enum value cannot be used inside the
-- transaction that adds it; 012 uses it.
--
-- Rollback: 011_erp_module_receivables.rollback.sql (documentation only —
-- Postgres cannot drop an enum value; 012's rollback removes every row that
-- uses it, which leaves the value inert).

ALTER TYPE public.erp_module ADD VALUE IF NOT EXISTS 'receivables' AFTER 'cash_closure';
