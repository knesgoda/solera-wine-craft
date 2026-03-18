
CREATE TABLE public.analog_vintages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  year integer NOT NULL,
  region text NOT NULL,
  gdd_total numeric,
  harvest_date date,
  rating numeric,
  rating_source text,
  notes text,
  imported boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.analog_vintages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view analog_vintages in their org" ON public.analog_vintages
  FOR SELECT TO public USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can insert analog_vintages in their org" ON public.analog_vintages
  FOR INSERT TO authenticated WITH CHECK (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can update analog_vintages in their org" ON public.analog_vintages
  FOR UPDATE TO public USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can delete analog_vintages in their org" ON public.analog_vintages
  FOR DELETE TO public USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Service role full access on analog_vintages" ON public.analog_vintages
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE public.public_ratings_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  source_name text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  last_imported_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.public_ratings_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view public_ratings_config in their org" ON public.public_ratings_config
  FOR SELECT TO public USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can insert public_ratings_config in their org" ON public.public_ratings_config
  FOR INSERT TO authenticated WITH CHECK (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can update public_ratings_config in their org" ON public.public_ratings_config
  FOR UPDATE TO public USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can delete public_ratings_config in their org" ON public.public_ratings_config
  FOR DELETE TO public USING (org_id = get_user_org_id(auth.uid()));
