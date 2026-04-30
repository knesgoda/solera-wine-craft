-- TTB additions: enforce append-only compliance at RLS and FK level.
-- DELETE and UPDATE policies are dropped; CASCADE FK replaced with RESTRICT.

DROP POLICY IF EXISTS "Users can delete ttb_additions in their org" ON public.ttb_additions;
DROP POLICY IF EXISTS "Users can update ttb_additions in their org" ON public.ttb_additions;

ALTER TABLE public.ttb_additions
  DROP CONSTRAINT IF EXISTS ttb_additions_vintage_id_fkey;

ALTER TABLE public.ttb_additions
  ADD CONSTRAINT ttb_additions_vintage_id_fkey
  FOREIGN KEY (vintage_id)
  REFERENCES public.vintages(id)
  ON DELETE RESTRICT;

COMMENT ON TABLE public.ttb_additions IS
  'Append-only federal compliance log. DELETE and UPDATE are prohibited at RLS and FK level.';
