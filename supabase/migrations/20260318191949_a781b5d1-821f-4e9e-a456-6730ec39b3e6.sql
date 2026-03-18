
CREATE TABLE public.saved_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  name text NOT NULL,
  config_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.saved_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view saved_reports in their org" ON public.saved_reports
  FOR SELECT TO public USING (org_id = get_user_org_id(auth.uid()));

CREATE POLICY "Users can insert saved_reports in their org" ON public.saved_reports
  FOR INSERT TO authenticated WITH CHECK (org_id = get_user_org_id(auth.uid()));

CREATE POLICY "Users can update saved_reports in their org" ON public.saved_reports
  FOR UPDATE TO public USING (org_id = get_user_org_id(auth.uid()));

CREATE POLICY "Users can delete saved_reports in their org" ON public.saved_reports
  FOR DELETE TO public USING (org_id = get_user_org_id(auth.uid()));
