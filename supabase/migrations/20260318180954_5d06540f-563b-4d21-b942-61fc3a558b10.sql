
-- Add missing columns to fermentation_vessels
ALTER TABLE public.fermentation_vessels
  ADD COLUMN IF NOT EXISTS temp_controlled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notes text;

-- Add missing columns to barrels
ALTER TABLE public.barrels
  ADD COLUMN IF NOT EXISTS barrel_group_id uuid,
  ADD COLUMN IF NOT EXISTS fill_date date,
  ADD COLUMN IF NOT EXISTS empty_date date;

-- Create fermentation_logs
CREATE TABLE public.fermentation_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vessel_id uuid NOT NULL REFERENCES public.fermentation_vessels(id) ON DELETE CASCADE,
  vintage_id uuid REFERENCES public.vintages(id) ON DELETE SET NULL,
  logged_at timestamptz NOT NULL DEFAULT now(),
  temp_f numeric,
  brix numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fermentation_logs ENABLE ROW LEVEL SECURITY;

-- Create helper function for fermentation_logs RLS
CREATE OR REPLACE FUNCTION public.get_vessel_org_id(_vessel_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$ SELECT org_id FROM public.fermentation_vessels WHERE id = _vessel_id $$;

CREATE POLICY "Users can view fermentation_logs in their org" ON public.fermentation_logs
  FOR SELECT USING (get_vessel_org_id(vessel_id) = get_user_org_id(auth.uid()));
CREATE POLICY "Users can insert fermentation_logs in their org" ON public.fermentation_logs
  FOR INSERT TO authenticated WITH CHECK (get_vessel_org_id(vessel_id) = get_user_org_id(auth.uid()));
CREATE POLICY "Users can update fermentation_logs in their org" ON public.fermentation_logs
  FOR UPDATE USING (get_vessel_org_id(vessel_id) = get_user_org_id(auth.uid()));
CREATE POLICY "Users can delete fermentation_logs in their org" ON public.fermentation_logs
  FOR DELETE USING (get_vessel_org_id(vessel_id) = get_user_org_id(auth.uid()));

-- Create barrel_groups
CREATE TABLE public.barrel_groups (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.barrel_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view barrel_groups in their org" ON public.barrel_groups
  FOR SELECT USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can insert barrel_groups in their org" ON public.barrel_groups
  FOR INSERT TO authenticated WITH CHECK (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can update barrel_groups in their org" ON public.barrel_groups
  FOR UPDATE USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can delete barrel_groups in their org" ON public.barrel_groups
  FOR DELETE USING (org_id = get_user_org_id(auth.uid()));

-- Add FK from barrels to barrel_groups
ALTER TABLE public.barrels
  ADD CONSTRAINT barrels_barrel_group_id_fkey FOREIGN KEY (barrel_group_id) REFERENCES public.barrel_groups(id) ON DELETE SET NULL;

-- Add vintage_id to fermentation_vessels for "currently assigned vintage"
ALTER TABLE public.fermentation_vessels
  ADD COLUMN IF NOT EXISTS vintage_id uuid REFERENCES public.vintages(id) ON DELETE SET NULL;

-- Create blending_trials
CREATE TABLE public.blending_trials (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  vintage_id uuid REFERENCES public.vintages(id) ON DELETE SET NULL,
  notes text,
  stars integer CHECK (stars >= 1 AND stars <= 5),
  total_volume_liters numeric,
  finalized boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.blending_trials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view blending_trials in their org" ON public.blending_trials
  FOR SELECT USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can insert blending_trials in their org" ON public.blending_trials
  FOR INSERT TO authenticated WITH CHECK (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can update blending_trials in their org" ON public.blending_trials
  FOR UPDATE USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can delete blending_trials in their org" ON public.blending_trials
  FOR DELETE USING (org_id = get_user_org_id(auth.uid()));

-- Create blending_trial_lots
CREATE TABLE public.blending_trial_lots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trial_id uuid NOT NULL REFERENCES public.blending_trials(id) ON DELETE CASCADE,
  vintage_id uuid REFERENCES public.vintages(id) ON DELETE SET NULL,
  barrel_id uuid REFERENCES public.barrels(id) ON DELETE SET NULL,
  percentage numeric NOT NULL,
  volume_liters numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.blending_trial_lots ENABLE ROW LEVEL SECURITY;

-- Helper for trial_lots RLS
CREATE OR REPLACE FUNCTION public.get_trial_org_id(_trial_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$ SELECT org_id FROM public.blending_trials WHERE id = _trial_id $$;

CREATE POLICY "Users can view blending_trial_lots in their org" ON public.blending_trial_lots
  FOR SELECT USING (get_trial_org_id(trial_id) = get_user_org_id(auth.uid()));
CREATE POLICY "Users can insert blending_trial_lots in their org" ON public.blending_trial_lots
  FOR INSERT TO authenticated WITH CHECK (get_trial_org_id(trial_id) = get_user_org_id(auth.uid()));
CREATE POLICY "Users can update blending_trial_lots in their org" ON public.blending_trial_lots
  FOR UPDATE USING (get_trial_org_id(trial_id) = get_user_org_id(auth.uid()));
CREATE POLICY "Users can delete blending_trial_lots in their org" ON public.blending_trial_lots
  FOR DELETE USING (get_trial_org_id(trial_id) = get_user_org_id(auth.uid()));
