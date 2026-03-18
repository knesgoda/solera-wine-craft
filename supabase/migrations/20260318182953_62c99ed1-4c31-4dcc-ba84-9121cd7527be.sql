
-- Notification type and channel enums
CREATE TYPE public.notification_type AS ENUM ('alert', 'harvest', 'system', 'task');
CREATE TYPE public.alert_channel AS ENUM ('email', 'push', 'both');
CREATE TYPE public.alert_operator AS ENUM ('gte', 'lte', 'eq');
CREATE TYPE public.alert_parameter AS ENUM ('brix', 'ph', 'ta', 'va', 'so2_free', 'so2_total', 'temp_f', 'gdd_cumulative');

-- Notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  user_id uuid NOT NULL,
  message text NOT NULL,
  type public.notification_type NOT NULL DEFAULT 'alert',
  channel public.alert_channel NOT NULL DEFAULT 'both',
  read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT TO public
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE TO public
  USING (user_id = auth.uid());

CREATE POLICY "Service role full access on notifications"
  ON public.notifications FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, read, created_at DESC);

-- Alert rules table
CREATE TABLE public.alert_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  parameter public.alert_parameter NOT NULL,
  operator public.alert_operator NOT NULL,
  threshold numeric NOT NULL,
  channel public.alert_channel NOT NULL DEFAULT 'both',
  active boolean NOT NULL DEFAULT true,
  last_triggered_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view alert_rules in their org"
  ON public.alert_rules FOR SELECT TO public
  USING (org_id = get_user_org_id(auth.uid()));

CREATE POLICY "Users can insert alert_rules in their org"
  ON public.alert_rules FOR INSERT TO authenticated
  WITH CHECK (org_id = get_user_org_id(auth.uid()));

CREATE POLICY "Users can update alert_rules in their org"
  ON public.alert_rules FOR UPDATE TO public
  USING (org_id = get_user_org_id(auth.uid()));

CREATE POLICY "Users can delete alert_rules in their org"
  ON public.alert_rules FOR DELETE TO public
  USING (org_id = get_user_org_id(auth.uid()));

CREATE POLICY "Service role full access on alert_rules"
  ON public.alert_rules FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Function to create default alert rules for new orgs
CREATE OR REPLACE FUNCTION public.create_default_alert_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.alert_rules (org_id, parameter, operator, threshold, channel)
  VALUES
    (NEW.id, 'brix', 'gte', 24.0, 'both'),
    (NEW.id, 'va', 'gte', 0.8, 'email'),
    (NEW.id, 'so2_free', 'lte', 25, 'email');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_org_created_default_alerts
  AFTER INSERT ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_alert_rules();
