-- Idempotent migration to support 'created_by_dealer' in public.dealers.source
ALTER TABLE public.dealers
  DROP CONSTRAINT IF EXISTS dealers_source_check;

ALTER TABLE public.dealers
  ADD CONSTRAINT dealers_source_check
  CHECK (source IN ('self_registered', 'created_by_distributor', 'created_by_dealer'));
