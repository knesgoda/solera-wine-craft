
-- SSO Provider enum
CREATE TYPE public.sso_provider AS ENUM ('okta', 'azure_ad', 'google_workspace', 'generic_saml');

-- SSO Configs table
CREATE TABLE public.sso_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  provider public.sso_provider NOT NULL DEFAULT 'generic_saml',
  entity_id text,
  sso_url text,
  certificate text,
  attribute_mapping_json jsonb DEFAULT '{"email":"email","first_name":"firstName","last_name":"lastName"}'::jsonb,
  active boolean NOT NULL DEFAULT false,
  enforce_sso boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id)
);

ALTER TABLE public.sso_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view sso_configs in their org" ON public.sso_configs
  FOR SELECT USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can insert sso_configs in their org" ON public.sso_configs
  FOR INSERT TO authenticated WITH CHECK (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can update sso_configs in their org" ON public.sso_configs
  FOR UPDATE USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can delete sso_configs in their org" ON public.sso_configs
  FOR DELETE USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Service role full access on sso_configs" ON public.sso_configs
  FOR ALL TO service_role USING (true) WITH CHECK (true);
