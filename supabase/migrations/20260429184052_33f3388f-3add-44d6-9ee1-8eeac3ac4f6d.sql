REVOKE UPDATE ON TABLE public.ttb_additions FROM authenticated, anon;
REVOKE DELETE ON TABLE public.ttb_additions FROM authenticated, anon;

DROP POLICY IF EXISTS "Users can update ttb_additions in their org" ON public.ttb_additions;
DROP POLICY IF EXISTS "Users can delete ttb_additions in their org" ON public.ttb_additions;

COMMENT ON TABLE public.ttb_additions IS 'Append-only compliance log. No updates or deletes permitted.';