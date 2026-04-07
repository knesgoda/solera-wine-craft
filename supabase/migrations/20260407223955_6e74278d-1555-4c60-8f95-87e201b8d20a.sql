
-- ========== EXISTING TABLE ADDITIONS ==========

-- blocks: external source ID
ALTER TABLE public.blocks ADD COLUMN IF NOT EXISTS external_block_id text;

-- vintages: external source IDs
ALTER TABLE public.vintages ADD COLUMN IF NOT EXISTS external_vintage_id text;
ALTER TABLE public.vintages ADD COLUMN IF NOT EXISTS external_lot_id text;

-- fermentation_vessels: external source ID
ALTER TABLE public.fermentation_vessels ADD COLUMN IF NOT EXISTS external_vessel_id text;

-- tasks: external source tracking
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS external_task_id text;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS source_reference text;

-- lab_samples: external source ID and block linkage
ALTER TABLE public.lab_samples ADD COLUMN IF NOT EXISTS external_sample_id text;
ALTER TABLE public.lab_samples ADD COLUMN IF NOT EXISTS block_id uuid REFERENCES public.blocks(id);

-- grower_contracts: CSV fields
ALTER TABLE public.grower_contracts ADD COLUMN IF NOT EXISTS approval_status text;
ALTER TABLE public.grower_contracts ADD COLUMN IF NOT EXISTS payment_status text;
ALTER TABLE public.grower_contracts ADD COLUMN IF NOT EXISTS payment_due_date date;
ALTER TABLE public.grower_contracts ADD COLUMN IF NOT EXISTS contract_type text;
ALTER TABLE public.grower_contracts ADD COLUMN IF NOT EXISTS source_vineyard_name text;
ALTER TABLE public.grower_contracts ADD COLUMN IF NOT EXISTS ava text;
ALTER TABLE public.grower_contracts ADD COLUMN IF NOT EXISTS external_contract_id text;

-- ========== NEW TABLES ==========

-- harvest_progress: per-block harvest tracking
CREATE TABLE IF NOT EXISTS public.harvest_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  external_progress_id text,
  block_id uuid REFERENCES public.blocks(id),
  block_name text,
  variety text,
  clone text,
  rootstock text,
  vintage_year integer,
  acres numeric,
  expected_tons numeric,
  tons_harvested numeric,
  harvest_complete boolean DEFAULT false,
  pick_date date,
  brix_at_pick numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.harvest_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org harvest_progress"
  ON public.harvest_progress FOR SELECT TO authenticated
  USING (org_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Users can insert own org harvest_progress"
  ON public.harvest_progress FOR INSERT TO authenticated
  WITH CHECK (org_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Users can update own org harvest_progress"
  ON public.harvest_progress FOR UPDATE TO authenticated
  USING (org_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Users can delete own org harvest_progress"
  ON public.harvest_progress FOR DELETE TO authenticated
  USING (org_id = public.get_user_org_id(auth.uid()));

CREATE TRIGGER update_harvest_progress_updated_at
  BEFORE UPDATE ON public.harvest_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- harvest_predictions: predicted pick dates per block
CREATE TABLE IF NOT EXISTS public.harvest_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  external_prediction_id text,
  block_id uuid REFERENCES public.blocks(id),
  block_name text,
  variety text,
  clone text,
  rootstock text,
  vintage_year integer,
  current_brix numeric,
  current_ph numeric,
  current_ta numeric,
  brix_per_day numeric,
  target_brix numeric,
  predicted_pick_date text,
  days_to_target integer,
  gdd_at_prediction numeric,
  confidence text,
  last_updated date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.harvest_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org harvest_predictions"
  ON public.harvest_predictions FOR SELECT TO authenticated
  USING (org_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Users can insert own org harvest_predictions"
  ON public.harvest_predictions FOR INSERT TO authenticated
  WITH CHECK (org_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Users can update own org harvest_predictions"
  ON public.harvest_predictions FOR UPDATE TO authenticated
  USING (org_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Users can delete own org harvest_predictions"
  ON public.harvest_predictions FOR DELETE TO authenticated
  USING (org_id = public.get_user_org_id(auth.uid()));

CREATE TRIGGER update_harvest_predictions_updated_at
  BEFORE UPDATE ON public.harvest_predictions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- pick_windows: optimal harvest windows per block
CREATE TABLE IF NOT EXISTS public.pick_windows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  external_window_id text,
  block_id uuid REFERENCES public.blocks(id),
  block_name text,
  variety text,
  clone text,
  rootstock text,
  current_brix numeric,
  target_brix_low numeric,
  target_brix_high numeric,
  current_ph numeric,
  target_ph_low numeric,
  target_ph_high numeric,
  current_ta numeric,
  brix_per_day numeric,
  days_to_window_open integer,
  days_to_window_close integer,
  window_open_date date,
  window_close_date date,
  window_status text,
  urgency text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pick_windows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org pick_windows"
  ON public.pick_windows FOR SELECT TO authenticated
  USING (org_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Users can insert own org pick_windows"
  ON public.pick_windows FOR INSERT TO authenticated
  WITH CHECK (org_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Users can update own org pick_windows"
  ON public.pick_windows FOR UPDATE TO authenticated
  USING (org_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Users can delete own org pick_windows"
  ON public.pick_windows FOR DELETE TO authenticated
  USING (org_id = public.get_user_org_id(auth.uid()));

CREATE TRIGGER update_pick_windows_updated_at
  BEFORE UPDATE ON public.pick_windows
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
