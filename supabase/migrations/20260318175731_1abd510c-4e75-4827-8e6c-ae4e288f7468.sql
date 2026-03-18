
-- Import job status enum
CREATE TYPE public.import_status AS ENUM ('pending', 'mapping', 'previewing', 'importing', 'completed', 'failed');

-- Import source type enum
CREATE TYPE public.import_source_type AS ENUM ('csv', 'innovint', 'vinnow');

-- Import jobs table
CREATE TABLE public.import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  source_type public.import_source_type NOT NULL,
  status public.import_status NOT NULL DEFAULT 'pending',
  total_rows integer DEFAULT 0,
  imported_rows integer DEFAULT 0,
  skipped_rows integer DEFAULT 0,
  error_rows integer DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view import_jobs in their org" ON public.import_jobs FOR SELECT USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can insert import_jobs in their org" ON public.import_jobs FOR INSERT TO authenticated WITH CHECK (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can update import_jobs in their org" ON public.import_jobs FOR UPDATE USING (org_id = get_user_org_id(auth.uid()));

-- Import mappings table
CREATE TABLE public.import_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  source_type public.import_source_type NOT NULL,
  source_column text NOT NULL,
  target_table text,
  target_field text,
  confidence text,
  overridden_by_user boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.import_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view import_mappings in their org" ON public.import_mappings FOR SELECT USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can insert import_mappings in their org" ON public.import_mappings FOR INSERT TO authenticated WITH CHECK (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can update import_mappings in their org" ON public.import_mappings FOR UPDATE USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can delete import_mappings in their org" ON public.import_mappings FOR DELETE USING (org_id = get_user_org_id(auth.uid()));

-- Import errors table
CREATE TABLE public.import_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.import_jobs(id) ON DELETE CASCADE,
  row_number integer,
  source_data jsonb,
  error_message text,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.import_errors ENABLE ROW LEVEL SECURITY;
-- RLS via job's org
CREATE OR REPLACE FUNCTION public.get_import_job_org_id(_job_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$ SELECT org_id FROM public.import_jobs WHERE id = _job_id $$;

CREATE POLICY "Users can view import_errors in their org" ON public.import_errors FOR SELECT USING (get_import_job_org_id(job_id) = get_user_org_id(auth.uid()));
CREATE POLICY "Users can insert import_errors in their org" ON public.import_errors FOR INSERT TO authenticated WITH CHECK (get_import_job_org_id(job_id) = get_user_org_id(auth.uid()));

-- Barrels table (for Innovint import)
CREATE TABLE public.barrels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  barrel_id text,
  type text,
  cooperage text,
  toast text,
  size_liters numeric,
  vintage_id uuid REFERENCES public.vintages(id) ON DELETE SET NULL,
  variety text,
  status text DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.barrels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view barrels in their org" ON public.barrels FOR SELECT USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can insert barrels in their org" ON public.barrels FOR INSERT TO authenticated WITH CHECK (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can update barrels in their org" ON public.barrels FOR UPDATE USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can delete barrels in their org" ON public.barrels FOR DELETE USING (org_id = get_user_org_id(auth.uid()));

-- Fermentation vessels table (for VinNow import)
CREATE TABLE public.fermentation_vessels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  capacity_liters numeric,
  material text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fermentation_vessels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view fermentation_vessels in their org" ON public.fermentation_vessels FOR SELECT USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can insert fermentation_vessels in their org" ON public.fermentation_vessels FOR INSERT TO authenticated WITH CHECK (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can update fermentation_vessels in their org" ON public.fermentation_vessels FOR UPDATE USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can delete fermentation_vessels in their org" ON public.fermentation_vessels FOR DELETE USING (org_id = get_user_org_id(auth.uid()));

-- Inventory SKUs table (for VinNow import)
CREATE TABLE public.inventory_skus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  label text,
  variety text,
  vintage_year integer,
  cases numeric DEFAULT 0,
  bottles numeric DEFAULT 0,
  price numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.inventory_skus ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view inventory_skus in their org" ON public.inventory_skus FOR SELECT USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can insert inventory_skus in their org" ON public.inventory_skus FOR INSERT TO authenticated WITH CHECK (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can update inventory_skus in their org" ON public.inventory_skus FOR UPDATE USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can delete inventory_skus in their org" ON public.inventory_skus FOR DELETE USING (org_id = get_user_org_id(auth.uid()));
