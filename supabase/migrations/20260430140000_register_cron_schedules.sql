-- Register pg_cron schedules for all scheduled edge functions.
-- IMPORTANT: Before applying this migration, set these Postgres config values:
--   ALTER DATABASE postgres SET app.supabase_url = 'https://[your-project-ref].supabase.co';
--   ALTER DATABASE postgres SET app.cron_secret = '[your CRON_SECRET value]';
-- These must match the CRON_SECRET runtime secret set in Edge Functions → Secrets.

SELECT cron.schedule(
  'weekly-summary',
  '0 6 * * 1',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/weekly-summary',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', current_setting('app.cron_secret')
    ),
    body := '{}'::jsonb
  )
  $$
);

SELECT cron.schedule(
  'check-harvest-alerts',
  '0 7 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/check-harvest-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', current_setting('app.cron_secret')
    ),
    body := '{}'::jsonb
  )
  $$
);

SELECT cron.schedule(
  'run-scheduled-backups',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/run-scheduled-backups',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', current_setting('app.cron_secret')
    ),
    body := '{}'::jsonb
  )
  $$
);

SELECT cron.schedule(
  'cleanup-expired-backups',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/cleanup-expired-backups',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', current_setting('app.cron_secret')
    ),
    body := '{}'::jsonb
  )
  $$
);
