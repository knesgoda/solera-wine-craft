
-- Facility type enum
CREATE TYPE public.facility_type AS ENUM ('winery', 'vineyard', 'custom_crush', 'storage', 'tasting_room');

-- Facilities table
CREATE TABLE public.facilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_org_id uuid NOT NULL REFERENCES public.organizations(id),
  name text NOT NULL,
  address text,
  region text,
  facility_type public.facility_type NOT NULL DEFAULT 'winery',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view facilities in their org" ON public.facilities FOR SELECT USING (parent_org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can insert facilities in their org" ON public.facilities FOR INSERT TO authenticated WITH CHECK (parent_org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can update facilities in their org" ON public.facilities FOR UPDATE USING (parent_org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can delete facilities in their org" ON public.facilities FOR DELETE USING (parent_org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Service role full access on facilities" ON public.facilities FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Facility users table
CREATE TABLE public.facility_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(facility_id, user_id)
);
ALTER TABLE public.facility_users ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_facility_org_id(_facility_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT parent_org_id FROM public.facilities WHERE id = _facility_id
$$;

CREATE POLICY "Users can view facility_users in their org" ON public.facility_users FOR SELECT USING (get_facility_org_id(facility_id) = get_user_org_id(auth.uid()));
CREATE POLICY "Users can insert facility_users in their org" ON public.facility_users FOR INSERT TO authenticated WITH CHECK (get_facility_org_id(facility_id) = get_user_org_id(auth.uid()));
CREATE POLICY "Users can update facility_users in their org" ON public.facility_users FOR UPDATE USING (get_facility_org_id(facility_id) = get_user_org_id(auth.uid()));
CREATE POLICY "Users can delete facility_users in their org" ON public.facility_users FOR DELETE USING (get_facility_org_id(facility_id) = get_user_org_id(auth.uid()));
CREATE POLICY "Service role full access on facility_users" ON public.facility_users FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Add facility_id to existing tables (nullable for backward compat)
ALTER TABLE public.vineyards ADD COLUMN IF NOT EXISTS facility_id uuid REFERENCES public.facilities(id);
ALTER TABLE public.fermentation_vessels ADD COLUMN IF NOT EXISTS facility_id uuid REFERENCES public.facilities(id);
ALTER TABLE public.barrels ADD COLUMN IF NOT EXISTS facility_id uuid REFERENCES public.facilities(id);
ALTER TABLE public.inventory_skus ADD COLUMN IF NOT EXISTS facility_id uuid REFERENCES public.facilities(id);

-- Transfers table
CREATE TABLE public.facility_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  from_facility_id uuid NOT NULL REFERENCES public.facilities(id),
  to_facility_id uuid NOT NULL REFERENCES public.facilities(id),
  sku_id uuid NOT NULL REFERENCES public.inventory_skus(id),
  cases integer NOT NULL DEFAULT 0,
  bottles integer NOT NULL DEFAULT 0,
  transferred_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.facility_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view facility_transfers in their org" ON public.facility_transfers FOR SELECT USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can insert facility_transfers in their org" ON public.facility_transfers FOR INSERT TO authenticated WITH CHECK (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can update facility_transfers in their org" ON public.facility_transfers FOR UPDATE USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can delete facility_transfers in their org" ON public.facility_transfers FOR DELETE USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Service role full access on facility_transfers" ON public.facility_transfers FOR ALL TO service_role USING (true) WITH CHECK (true);
