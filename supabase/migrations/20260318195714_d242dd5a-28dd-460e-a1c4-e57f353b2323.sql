
-- Add source column to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';

-- Commerce7 config
CREATE TABLE public.commerce7_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  app_id text,
  app_secret text,
  tenant_id text,
  last_synced_at timestamptz,
  active boolean NOT NULL DEFAULT false,
  sync_inventory boolean NOT NULL DEFAULT false,
  sync_orders boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id)
);
ALTER TABLE public.commerce7_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view commerce7_config in their org" ON public.commerce7_config FOR SELECT USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can insert commerce7_config in their org" ON public.commerce7_config FOR INSERT TO authenticated WITH CHECK (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can update commerce7_config in their org" ON public.commerce7_config FOR UPDATE USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can delete commerce7_config in their org" ON public.commerce7_config FOR DELETE USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Service role full access on commerce7_config" ON public.commerce7_config FOR ALL TO service_role USING (true) WITH CHECK (true);

-- WineDirect config
CREATE TABLE public.winedirect_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  api_key text,
  account_id text,
  last_synced_at timestamptz,
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id)
);
ALTER TABLE public.winedirect_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view winedirect_config in their org" ON public.winedirect_config FOR SELECT USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can insert winedirect_config in their org" ON public.winedirect_config FOR INSERT TO authenticated WITH CHECK (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can update winedirect_config in their org" ON public.winedirect_config FOR UPDATE USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can delete winedirect_config in their org" ON public.winedirect_config FOR DELETE USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Service role full access on winedirect_config" ON public.winedirect_config FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Shopify config
CREATE TABLE public.shopify_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_domain text,
  access_token text,
  last_synced_at timestamptz,
  active boolean NOT NULL DEFAULT false,
  sync_inventory boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id)
);
ALTER TABLE public.shopify_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view shopify_config in their org" ON public.shopify_config FOR SELECT USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can insert shopify_config in their org" ON public.shopify_config FOR INSERT TO authenticated WITH CHECK (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can update shopify_config in their org" ON public.shopify_config FOR UPDATE USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can delete shopify_config in their org" ON public.shopify_config FOR DELETE USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Service role full access on shopify_config" ON public.shopify_config FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ShipCompliant config
CREATE TABLE public.shipcompliant_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  username text,
  password_hash text,
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id)
);
ALTER TABLE public.shipcompliant_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view shipcompliant_config in their org" ON public.shipcompliant_config FOR SELECT USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can insert shipcompliant_config in their org" ON public.shipcompliant_config FOR INSERT TO authenticated WITH CHECK (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can update shipcompliant_config in their org" ON public.shipcompliant_config FOR UPDATE USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can delete shipcompliant_config in their org" ON public.shipcompliant_config FOR DELETE USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Service role full access on shipcompliant_config" ON public.shipcompliant_config FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Integration sync logs
CREATE TABLE public.integration_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  integration text NOT NULL,
  sync_type text NOT NULL DEFAULT 'manual',
  records_synced integer NOT NULL DEFAULT 0,
  errors integer NOT NULL DEFAULT 0,
  error_details text,
  status text NOT NULL DEFAULT 'success',
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.integration_sync_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view integration_sync_logs in their org" ON public.integration_sync_logs FOR SELECT USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can insert integration_sync_logs in their org" ON public.integration_sync_logs FOR INSERT TO authenticated WITH CHECK (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Service role full access on integration_sync_logs" ON public.integration_sync_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Add compliance columns to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS compliance_status text DEFAULT 'unchecked';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS compliance_details jsonb;
