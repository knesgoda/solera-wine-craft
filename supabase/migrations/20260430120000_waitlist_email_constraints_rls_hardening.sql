-- Add email format and max-length constraints to waitlist_signups
ALTER TABLE public.waitlist_signups
  ADD CONSTRAINT waitlist_signups_email_format
    CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  ADD CONSTRAINT waitlist_signups_email_max_length
    CHECK (char_length(email) <= 254);

-- Tighten RLS: change TO public → TO authenticated on all user-data policies.
-- The waitlist_signups insert policy (TO anon, authenticated) is intentionally left unchanged.

-- harvest_alerts_sent
ALTER POLICY "Users can view harvest_alerts_sent in their org"
  ON public.harvest_alerts_sent TO authenticated;

-- notifications
ALTER POLICY "Users can view their own notifications"
  ON public.notifications TO authenticated;
ALTER POLICY "Users can update their own notifications"
  ON public.notifications TO authenticated;

-- alert_rules
ALTER POLICY "Users can view alert_rules in their org"
  ON public.alert_rules TO authenticated;
ALTER POLICY "Users can update alert_rules in their org"
  ON public.alert_rules TO authenticated;
ALTER POLICY "Users can delete alert_rules in their org"
  ON public.alert_rules TO authenticated;

-- google_sheet_connections
ALTER POLICY "Users can view google_sheet_connections in their org"
  ON public.google_sheet_connections TO authenticated;
ALTER POLICY "Users can update google_sheet_connections in their org"
  ON public.google_sheet_connections TO authenticated;
ALTER POLICY "Users can delete google_sheet_connections in their org"
  ON public.google_sheet_connections TO authenticated;

-- sync_logs
ALTER POLICY "Users can view sync_logs in their org"
  ON public.sync_logs TO authenticated;

-- saved_reports
ALTER POLICY "Users can view saved_reports in their org"
  ON public.saved_reports TO authenticated;
ALTER POLICY "Users can update saved_reports in their org"
  ON public.saved_reports TO authenticated;
ALTER POLICY "Users can delete saved_reports in their org"
  ON public.saved_reports TO authenticated;

-- analog_vintages
ALTER POLICY "Users can view analog_vintages in their org"
  ON public.analog_vintages TO authenticated;
ALTER POLICY "Users can update analog_vintages in their org"
  ON public.analog_vintages TO authenticated;
ALTER POLICY "Users can delete analog_vintages in their org"
  ON public.analog_vintages TO authenticated;

-- public_ratings_config
ALTER POLICY "Users can view public_ratings_config in their org"
  ON public.public_ratings_config TO authenticated;
ALTER POLICY "Users can update public_ratings_config in their org"
  ON public.public_ratings_config TO authenticated;
ALTER POLICY "Users can delete public_ratings_config in their org"
  ON public.public_ratings_config TO authenticated;
