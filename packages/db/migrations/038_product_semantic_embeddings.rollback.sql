-- Reverts 038_product_semantic_embeddings.sql.

BEGIN;

DROP TABLE IF EXISTS public.product_embedding;

ALTER TABLE public.product
  DROP CONSTRAINT IF EXISTS uq_product_id_ws;

COMMIT;
