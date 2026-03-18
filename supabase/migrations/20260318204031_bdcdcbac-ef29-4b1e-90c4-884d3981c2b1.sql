
-- Add new roles to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'manager';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'cellar';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'field';

-- Add needs_onboarding_call to organizations
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS needs_onboarding_call boolean NOT NULL DEFAULT false;

-- Audit logs table (Enterprise)
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid,
  action text NOT NULL,
  record_type text,
  record_id text,
  metadata_json jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on audit_logs" ON public.audit_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Users can view audit_logs in their org" ON public.audit_logs FOR SELECT USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can insert audit_logs in their org" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (org_id = get_user_org_id(auth.uid()));

CREATE INDEX idx_audit_logs_org_created ON public.audit_logs (org_id, created_at DESC);

-- SMS config table (Enterprise add-on)
CREATE TABLE public.sms_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE UNIQUE,
  twilio_account_sid text,
  twilio_auth_token_encrypted text,
  from_number text,
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sms_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on sms_config" ON public.sms_config FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Users can view sms_config in their org" ON public.sms_config FOR SELECT USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can insert sms_config in their org" ON public.sms_config FOR INSERT TO authenticated WITH CHECK (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can update sms_config in their org" ON public.sms_config FOR UPDATE USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can delete sms_config in their org" ON public.sms_config FOR DELETE USING (org_id = get_user_org_id(auth.uid()));

-- Add weather_source to vineyard_weather_config
ALTER TABLE public.vineyard_weather_config ADD COLUMN IF NOT EXISTS weather_source text NOT NULL DEFAULT 'open_meteo';
ALTER TABLE public.vineyard_weather_config ADD COLUMN IF NOT EXISTS tomorrow_io_api_key text;

-- Add sms to alert_channel enum
ALTER TYPE public.alert_channel ADD VALUE IF NOT EXISTS 'sms';

-- Add role column to profiles for quick access
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'member';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_active_at timestamptz;
