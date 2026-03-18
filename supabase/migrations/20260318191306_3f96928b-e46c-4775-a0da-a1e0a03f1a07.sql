
-- Anomaly flags table
CREATE TABLE public.anomaly_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  vintage_id uuid NOT NULL REFERENCES public.vintages(id) ON DELETE CASCADE,
  parameter text NOT NULL,
  value numeric NOT NULL,
  expected_range_low numeric,
  expected_range_high numeric,
  flagged_at timestamptz NOT NULL DEFAULT now(),
  resolved boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.anomaly_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view anomaly_flags in their org"
  ON public.anomaly_flags FOR SELECT USING (org_id = get_user_org_id(auth.uid()));

CREATE POLICY "Users can insert anomaly_flags in their org"
  ON public.anomaly_flags FOR INSERT TO authenticated
  WITH CHECK (org_id = get_user_org_id(auth.uid()));

CREATE POLICY "Users can update anomaly_flags in their org"
  ON public.anomaly_flags FOR UPDATE USING (org_id = get_user_org_id(auth.uid()));

CREATE POLICY "Users can delete anomaly_flags in their org"
  ON public.anomaly_flags FOR DELETE USING (org_id = get_user_org_id(auth.uid()));

CREATE POLICY "Service role full access on anomaly_flags"
  ON public.anomaly_flags FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Weekly summaries table
CREATE TABLE public.weekly_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  week_starting date NOT NULL,
  content text NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.weekly_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view weekly_summaries in their org"
  ON public.weekly_summaries FOR SELECT USING (org_id = get_user_org_id(auth.uid()));

CREATE POLICY "Service role full access on weekly_summaries"
  ON public.weekly_summaries FOR ALL TO service_role USING (true) WITH CHECK (true);
