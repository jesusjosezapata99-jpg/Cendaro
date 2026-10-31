-- Rollback Migration 026: Composite Workspace Performance Indexes (PROP-06)

DROP INDEX IF EXISTS public.idx_order_ws_created;
DROP INDEX IF EXISTS public.idx_product_ws_created;
DROP INDEX IF EXISTS public.idx_product_ws_barcode;
