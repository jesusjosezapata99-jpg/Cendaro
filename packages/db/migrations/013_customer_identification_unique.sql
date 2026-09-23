-- Cendaro ERP — One customer per fiscal identification per workspace
-- PLAN-2026-09-SECURITY-REMEDIATION, phase F2 (POS customer registration)
--
-- Employees can now register customers at the POS. sales.createCustomer
-- stores the RIF / cédula / passport in canonical form (J-12345678-9,
-- V-12345678, PAS-AB123456) and rejects duplicates; this constraint closes
-- the race between that lookup and the insert, so two cashiers cannot create
-- the same buyer twice. NULL identifications remain allowed (legacy rows).
--
-- Pre-check (read-only, 2026-09-17): 300 customers, 0 duplicate
-- (workspace_id, identification) pairs.
--
-- Rollback: 013_customer_identification_unique.rollback.sql

BEGIN;

ALTER TABLE public.customer
  ADD CONSTRAINT uq_customer_workspace_identification
  UNIQUE (workspace_id, identification);

COMMIT;
