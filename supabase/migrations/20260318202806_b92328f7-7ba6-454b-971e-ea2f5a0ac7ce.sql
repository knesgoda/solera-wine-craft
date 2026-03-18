
-- API scopes enum
CREATE TYPE public.api_scope AS ENUM (
  'read:vintages', 'write:vintages',
  'read:lab_samples', 'write:lab_samples',
  'read:inventory', 'write:inventory',
  'read:orders', 'read:tasks', 'write:tasks',
  'read:analytics'
);

-- Webhook event types enum
CREATE TYPE public.webhook_event_type AS ENUM (
  'vintage.created', 'vintage.updated',
  'lab_sample.created', 'harvest_window.entered',
  'task.completed', 'order.created', 'order.shipped',
  'anomaly.detected', 'weekly_summary.generated'
);

-- API Keys table
CREATE TABLE public.api_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  label TEXT NOT NULL,
  scopes api_scope[] NOT NULL DEFAULT '{}',
  rate_limit_per_hour INTEGER NOT NULL DEFAULT 1000,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  revoked_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view api_keys in their org" ON public.api_keys FOR SELECT USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can insert api_keys in their org" ON public.api_keys FOR INSERT TO authenticated WITH CHECK (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can update api_keys in their org" ON public.api_keys FOR UPDATE USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can delete api_keys in their org" ON public.api_keys FOR DELETE USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Service role full access on api_keys" ON public.api_keys FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Webhook Subscriptions table
CREATE TABLE public.webhook_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_type webhook_event_type NOT NULL,
  endpoint_url TEXT NOT NULL,
  secret_hash TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  last_triggered_at TIMESTAMP WITH TIME ZONE,
  failure_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.webhook_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view webhook_subscriptions in their org" ON public.webhook_subscriptions FOR SELECT USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can insert webhook_subscriptions in their org" ON public.webhook_subscriptions FOR INSERT TO authenticated WITH CHECK (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can update webhook_subscriptions in their org" ON public.webhook_subscriptions FOR UPDATE USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can delete webhook_subscriptions in their org" ON public.webhook_subscriptions FOR DELETE USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Service role full access on webhook_subscriptions" ON public.webhook_subscriptions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Webhook Delivery Logs table
CREATE TABLE public.webhook_delivery_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subscription_id UUID NOT NULL REFERENCES public.webhook_subscriptions(id) ON DELETE CASCADE,
  triggered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  response_code INTEGER,
  response_body TEXT,
  success BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE public.webhook_delivery_logs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_webhook_sub_org_id(_sub_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$ SELECT org_id FROM public.webhook_subscriptions WHERE id = _sub_id $$;

CREATE POLICY "Users can view webhook_delivery_logs in their org" ON public.webhook_delivery_logs FOR SELECT USING (get_webhook_sub_org_id(subscription_id) = get_user_org_id(auth.uid()));
CREATE POLICY "Service role full access on webhook_delivery_logs" ON public.webhook_delivery_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
