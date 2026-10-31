-- Migration 026: Composite Workspace Performance Indexes (PROP-06)
-- Optimizes POS barcode lookups and keyset/time-sorted pagination for Product and SalesOrder.

CREATE INDEX IF NOT EXISTS idx_product_ws_barcode
  ON public.product (workspace_id, barcode);

CREATE INDEX IF NOT EXISTS idx_product_ws_created
  ON public.product (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_ws_created
  ON public.sales_order (workspace_id, created_at DESC);
