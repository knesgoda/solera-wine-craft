
CREATE TABLE public.harvest_alerts_sent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  block_id uuid NOT NULL REFERENCES public.blocks(id) ON DELETE CASCADE,
  vintage_id uuid NOT NULL REFERENCES public.vintages(id) ON DELETE CASCADE,
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  week_start date NOT NULL,
  UNIQUE (block_id, vintage_id, week_start)
);

ALTER TABLE public.harvest_alerts_sent ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view harvest_alerts_sent in their org"
  ON public.harvest_alerts_sent FOR SELECT TO public
  USING (org_id = get_user_org_id(auth.uid()));

CREATE POLICY "Users can insert harvest_alerts_sent in their org"
  ON public.harvest_alerts_sent FOR INSERT TO authenticated
  WITH CHECK (org_id = get_user_org_id(auth.uid()));

CREATE POLICY "Service role full access on harvest_alerts_sent"
  ON public.harvest_alerts_sent FOR ALL TO service_role
  USING (true) WITH CHECK (true);
