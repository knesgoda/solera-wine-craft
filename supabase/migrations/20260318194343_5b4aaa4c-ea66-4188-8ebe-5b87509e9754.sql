
-- Order status enum
CREATE TYPE public.order_status AS ENUM (
  'pending', 'payment_failed', 'paid', 'processing', 'shipped', 'delivered', 'refunded'
);

-- Storefront config table
CREATE TABLE public.storefront_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) UNIQUE,
  enabled boolean NOT NULL DEFAULT false,
  stripe_account_id text NULL,
  store_name text NULL,
  store_description text NULL,
  store_logo_url text NULL,
  age_gate_enabled boolean NOT NULL DEFAULT true,
  custom_domain text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.storefront_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view storefront_config in their org"
  ON public.storefront_config FOR SELECT
  USING (org_id = get_user_org_id(auth.uid()));

CREATE POLICY "Users can insert storefront_config in their org"
  ON public.storefront_config FOR INSERT TO authenticated
  WITH CHECK (org_id = get_user_org_id(auth.uid()));

CREATE POLICY "Users can update storefront_config in their org"
  ON public.storefront_config FOR UPDATE
  USING (org_id = get_user_org_id(auth.uid()));

CREATE POLICY "Service role full access on storefront_config"
  ON public.storefront_config FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Public read for storefront (anon users browsing store)
CREATE POLICY "Anon can view enabled storefronts"
  ON public.storefront_config FOR SELECT TO anon
  USING (enabled = true);

-- Customers table
CREATE TABLE public.customers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  email text NOT NULL,
  first_name text NULL,
  last_name text NULL,
  phone text NULL,
  address_json jsonb NULL,
  total_orders integer NOT NULL DEFAULT 0,
  total_spent numeric NOT NULL DEFAULT 0,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, email)
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view customers in their org"
  ON public.customers FOR SELECT
  USING (org_id = get_user_org_id(auth.uid()));

CREATE POLICY "Users can insert customers in their org"
  ON public.customers FOR INSERT TO authenticated
  WITH CHECK (org_id = get_user_org_id(auth.uid()));

CREATE POLICY "Users can update customers in their org"
  ON public.customers FOR UPDATE
  USING (org_id = get_user_org_id(auth.uid()));

CREATE POLICY "Users can delete customers in their org"
  ON public.customers FOR DELETE
  USING (org_id = get_user_org_id(auth.uid()));

CREATE POLICY "Service role full access on customers"
  ON public.customers FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Orders table
CREATE TABLE public.orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  sku_id uuid NOT NULL REFERENCES public.inventory_skus(id),
  customer_id uuid NULL REFERENCES public.customers(id),
  customer_email text NOT NULL,
  customer_name text NOT NULL,
  customer_address_json jsonb NULL,
  quantity_cases integer NOT NULL DEFAULT 0,
  quantity_bottles integer NOT NULL DEFAULT 0,
  unit_price numeric NOT NULL DEFAULT 0,
  subtotal numeric NOT NULL DEFAULT 0,
  shipping_cost numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  status public.order_status NOT NULL DEFAULT 'pending',
  stripe_payment_intent_id text NULL,
  stripe_session_id text NULL,
  shipped_at timestamptz NULL,
  tracking_number text NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view orders in their org"
  ON public.orders FOR SELECT
  USING (org_id = get_user_org_id(auth.uid()));

CREATE POLICY "Users can update orders in their org"
  ON public.orders FOR UPDATE
  USING (org_id = get_user_org_id(auth.uid()));

CREATE POLICY "Users can delete orders in their org"
  ON public.orders FOR DELETE
  USING (org_id = get_user_org_id(auth.uid()));

CREATE POLICY "Service role full access on orders"
  ON public.orders FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Allow anon to read DTC SKUs for public store
CREATE POLICY "Anon can view active DTC inventory_skus"
  ON public.inventory_skus FOR SELECT TO anon
  USING (active = true AND allocation_type = 'dtc');

-- Storage bucket for store logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('store-assets', 'store-assets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload store assets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'store-assets');

CREATE POLICY "Anyone can view store assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'store-assets');

CREATE POLICY "Authenticated users can update store assets"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'store-assets');
