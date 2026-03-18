
-- Club frequency enum
CREATE TYPE public.club_frequency AS ENUM (
  'monthly', 'bimonthly', 'quarterly', 'twice_yearly', 'annual'
);

-- Club member status enum
CREATE TYPE public.club_member_status AS ENUM (
  'active', 'paused', 'cancelled', 'payment_failed'
);

-- Club shipment status enum
CREATE TYPE public.club_shipment_status AS ENUM (
  'draft', 'processing', 'billed', 'shipping', 'completed'
);

-- Club shipment member status enum
CREATE TYPE public.club_shipment_member_status AS ENUM (
  'pending', 'billed', 'payment_failed', 'shipped'
);

-- Wine clubs table
CREATE TABLE public.wine_clubs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  name text NOT NULL,
  description text NULL,
  frequency public.club_frequency NOT NULL DEFAULT 'quarterly',
  price_per_shipment numeric NOT NULL DEFAULT 0,
  bottles_per_shipment integer NOT NULL DEFAULT 2,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.wine_clubs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view wine_clubs in their org" ON public.wine_clubs FOR SELECT USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can insert wine_clubs in their org" ON public.wine_clubs FOR INSERT TO authenticated WITH CHECK (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can update wine_clubs in their org" ON public.wine_clubs FOR UPDATE USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can delete wine_clubs in their org" ON public.wine_clubs FOR DELETE USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Service role full access on wine_clubs" ON public.wine_clubs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Anon can view active wine_clubs" ON public.wine_clubs FOR SELECT TO anon USING (active = true);

-- Club members table
CREATE TABLE public.club_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  club_id uuid NOT NULL REFERENCES public.wine_clubs(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id),
  status public.club_member_status NOT NULL DEFAULT 'active',
  joined_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz NULL,
  next_shipment_date date NULL,
  stripe_subscription_id text NULL,
  stripe_customer_id text NULL,
  shipping_address_json jsonb NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view club_members in their org" ON public.club_members FOR SELECT USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can insert club_members in their org" ON public.club_members FOR INSERT TO authenticated WITH CHECK (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can update club_members in their org" ON public.club_members FOR UPDATE USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can delete club_members in their org" ON public.club_members FOR DELETE USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Service role full access on club_members" ON public.club_members FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Club shipments table
CREATE TABLE public.club_shipments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  club_id uuid NOT NULL REFERENCES public.wine_clubs(id) ON DELETE CASCADE,
  shipment_date date NOT NULL,
  status public.club_shipment_status NOT NULL DEFAULT 'draft',
  sku_allocations_json jsonb NULL,
  total_members_billed integer NOT NULL DEFAULT 0,
  total_members_shipped integer NOT NULL DEFAULT 0,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.club_shipments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view club_shipments in their org" ON public.club_shipments FOR SELECT USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can insert club_shipments in their org" ON public.club_shipments FOR INSERT TO authenticated WITH CHECK (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can update club_shipments in their org" ON public.club_shipments FOR UPDATE USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can delete club_shipments in their org" ON public.club_shipments FOR DELETE USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Service role full access on club_shipments" ON public.club_shipments FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Club shipment members table
CREATE TABLE public.club_shipment_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shipment_id uuid NOT NULL REFERENCES public.club_shipments(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.club_members(id) ON DELETE CASCADE,
  status public.club_shipment_member_status NOT NULL DEFAULT 'pending',
  stripe_payment_intent_id text NULL,
  tracking_number text NULL,
  shipped_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.club_shipment_members ENABLE ROW LEVEL SECURITY;

-- Helper function for shipment org
CREATE OR REPLACE FUNCTION public.get_shipment_org_id(_shipment_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT org_id FROM public.club_shipments WHERE id = _shipment_id $$;

CREATE POLICY "Users can view club_shipment_members in their org" ON public.club_shipment_members FOR SELECT USING (get_shipment_org_id(shipment_id) = get_user_org_id(auth.uid()));
CREATE POLICY "Users can insert club_shipment_members in their org" ON public.club_shipment_members FOR INSERT TO authenticated WITH CHECK (get_shipment_org_id(shipment_id) = get_user_org_id(auth.uid()));
CREATE POLICY "Users can update club_shipment_members in their org" ON public.club_shipment_members FOR UPDATE USING (get_shipment_org_id(shipment_id) = get_user_org_id(auth.uid()));
CREATE POLICY "Users can delete club_shipment_members in their org" ON public.club_shipment_members FOR DELETE USING (get_shipment_org_id(shipment_id) = get_user_org_id(auth.uid()));
CREATE POLICY "Service role full access on club_shipment_members" ON public.club_shipment_members FOR ALL TO service_role USING (true) WITH CHECK (true);
