-- Cendaro ERP — pg_trgm GIN Indexes for Product Search
-- Run against Supabase database to enable fast LIKE/ILIKE searches.
-- Uses CONCURRENTLY to avoid table locks on production data.
--
-- Usage:
--   psql "$DATABASE_URL" -f packages/db/migrations/001_pg_trgm_indexes.sql
--   OR run via Supabase SQL Editor

-- Enable pg_trgm extension (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN trigram indexes for product search (replaces B-tree seq scans on LIKE/ILIKE)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_name_trgm
  ON "product" USING gin (name gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_sku_trgm
  ON "product" USING gin (sku gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_barcode_trgm
  ON "product" USING gin (barcode gin_trgm_ops);
