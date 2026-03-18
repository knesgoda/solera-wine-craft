
-- Vintage status enum
CREATE TYPE public.vintage_status AS ENUM ('planned', 'in_progress', 'harvested', 'in_cellar', 'bottled', 'released');

-- Vintages table
CREATE TABLE public.vintages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  block_id uuid REFERENCES public.blocks(id) ON DELETE SET NULL,
  year integer NOT NULL,
  status public.vintage_status NOT NULL DEFAULT 'planned',
  harvest_date date,
  tons_harvested numeric,
  client_org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vintages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view vintages in their org" ON public.vintages FOR SELECT USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can insert vintages in their org" ON public.vintages FOR INSERT TO authenticated WITH CHECK (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can update vintages in their org" ON public.vintages FOR UPDATE USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can delete vintages in their org" ON public.vintages FOR DELETE USING (org_id = get_user_org_id(auth.uid()));

CREATE TRIGGER update_vintages_updated_at BEFORE UPDATE ON public.vintages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Helper function for lab_samples RLS
CREATE OR REPLACE FUNCTION public.get_vintage_org_id(_vintage_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT org_id FROM public.vintages WHERE id = _vintage_id
$$;

-- Lab samples table
CREATE TABLE public.lab_samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vintage_id uuid NOT NULL REFERENCES public.vintages(id) ON DELETE CASCADE,
  sampled_at timestamptz NOT NULL,
  brix numeric,
  ph numeric,
  ta numeric,
  va numeric,
  so2_free numeric,
  so2_total numeric,
  alcohol numeric,
  rs numeric,
  notes text,
  offline_queued boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lab_samples ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view lab samples in their org" ON public.lab_samples FOR SELECT USING (get_vintage_org_id(vintage_id) = get_user_org_id(auth.uid()));
CREATE POLICY "Users can insert lab samples in their org" ON public.lab_samples FOR INSERT TO authenticated WITH CHECK (get_vintage_org_id(vintage_id) = get_user_org_id(auth.uid()));
CREATE POLICY "Users can update lab samples in their org" ON public.lab_samples FOR UPDATE USING (get_vintage_org_id(vintage_id) = get_user_org_id(auth.uid()));
CREATE POLICY "Users can delete lab samples in their org" ON public.lab_samples FOR DELETE USING (get_vintage_org_id(vintage_id) = get_user_org_id(auth.uid()));
