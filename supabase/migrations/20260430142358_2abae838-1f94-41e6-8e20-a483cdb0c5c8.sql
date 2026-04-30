
-- Cellar: vessels
ALTER TABLE public.fermentation_vessels
  ADD COLUMN IF NOT EXISTS oak_type text,
  ADD COLUMN IF NOT EXISTS toast_level text,
  ADD COLUMN IF NOT EXISTS barrel_age_fills integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fill_level_pct integer DEFAULT 0;

DO $$ BEGIN
  ALTER TABLE public.fermentation_vessels ADD CONSTRAINT fermentation_vessels_barrel_age_chk CHECK (barrel_age_fills IS NULL OR barrel_age_fills >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.fermentation_vessels ADD CONSTRAINT fermentation_vessels_fill_pct_chk CHECK (fill_level_pct IS NULL OR (fill_level_pct >= 0 AND fill_level_pct <= 100));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Cellar: fermentation logs
ALTER TABLE public.fermentation_logs
  ADD COLUMN IF NOT EXISTS cap_management text;

-- Vintages: lab targets, ferment start, MLF, yeast/inoculation, custom crush
ALTER TABLE public.vintages
  ADD COLUMN IF NOT EXISTS yeast_strain text,
  ADD COLUMN IF NOT EXISTS inoculation_date date,
  ADD COLUMN IF NOT EXISTS target_brix numeric,
  ADD COLUMN IF NOT EXISTS target_ph numeric,
  ADD COLUMN IF NOT EXISTS fermentation_start_date date,
  ADD COLUMN IF NOT EXISTS mlf_status text,
  ADD COLUMN IF NOT EXISTS grapes_received_tons numeric,
  ADD COLUMN IF NOT EXISTS expected_yield_gallons numeric,
  ADD COLUMN IF NOT EXISTS contract_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS coa_status text DEFAULT 'not_requested';

-- Lab samples
ALTER TABLE public.lab_samples
  ADD COLUMN IF NOT EXISTS sample_source text,
  ADD COLUMN IF NOT EXISTS malic_acid numeric;

-- Blocks
ALTER TABLE public.blocks
  ADD COLUMN IF NOT EXISTS row_orientation text;

-- Tasks
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS task_type text,
  ADD COLUMN IF NOT EXISTS assigned_to_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- TTB OW-1 reports
CREATE TABLE IF NOT EXISTS public.ow1_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  reporting_month integer NOT NULL CHECK (reporting_month BETWEEN 1 AND 12),
  reporting_year integer NOT NULL CHECK (reporting_year BETWEEN 2000 AND 2100),
  wine_on_hand_beginning numeric DEFAULT 0,
  produced_this_period numeric DEFAULT 0,
  taxpaid_removals numeric DEFAULT 0,
  losses_this_period numeric DEFAULT 0,
  wine_on_hand_ending numeric GENERATED ALWAYS AS (
    COALESCE(wine_on_hand_beginning,0) + COALESCE(produced_this_period,0)
    - COALESCE(taxpaid_removals,0) - COALESCE(losses_this_period,0)
  ) STORED,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','filed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, reporting_month, reporting_year)
);

ALTER TABLE public.ow1_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ow1_select" ON public.ow1_reports;
CREATE POLICY "ow1_select" ON public.ow1_reports
  FOR SELECT TO authenticated
  USING (org_id = public.get_user_org_id(auth.uid()));

DROP POLICY IF EXISTS "ow1_insert" ON public.ow1_reports;
CREATE POLICY "ow1_insert" ON public.ow1_reports
  FOR INSERT TO authenticated
  WITH CHECK (org_id = public.get_user_org_id(auth.uid()));

DROP POLICY IF EXISTS "ow1_update" ON public.ow1_reports;
CREATE POLICY "ow1_update" ON public.ow1_reports
  FOR UPDATE TO authenticated
  USING (org_id = public.get_user_org_id(auth.uid()))
  WITH CHECK (org_id = public.get_user_org_id(auth.uid()));

DROP POLICY IF EXISTS "ow1_delete" ON public.ow1_reports;
CREATE POLICY "ow1_delete" ON public.ow1_reports
  FOR DELETE TO authenticated
  USING (org_id = public.get_user_org_id(auth.uid()));

DROP TRIGGER IF EXISTS ow1_reports_set_updated_at ON public.ow1_reports;
CREATE TRIGGER ow1_reports_set_updated_at
  BEFORE UPDATE ON public.ow1_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
