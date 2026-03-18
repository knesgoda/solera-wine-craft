
-- Enums for sync config
CREATE TYPE public.sync_schedule AS ENUM ('manual', 'hourly', 'daily');
CREATE TYPE public.conflict_resolution AS ENUM ('solera_wins', 'sheet_wins', 'flag_for_review');
CREATE TYPE public.sync_status AS ENUM ('success', 'partial', 'failed', 'running');
CREATE TYPE public.sheet_module AS ENUM ('vintage_lab', 'tasks', 'inventory');

-- Google Sheet Connections
CREATE TABLE public.google_sheet_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  google_sheet_id text NOT NULL,
  sheet_name text NOT NULL,
  tab_name text NOT NULL,
  module public.sheet_module NOT NULL,
  sync_schedule public.sync_schedule NOT NULL DEFAULT 'manual',
  last_synced_at timestamp with time zone,
  conflict_resolution public.conflict_resolution NOT NULL DEFAULT 'solera_wins',
  active boolean NOT NULL DEFAULT true,
  google_access_token text,
  google_refresh_token text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.google_sheet_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view google_sheet_connections in their org"
  ON public.google_sheet_connections FOR SELECT TO public
  USING (org_id = get_user_org_id(auth.uid()));

CREATE POLICY "Users can insert google_sheet_connections in their org"
  ON public.google_sheet_connections FOR INSERT TO authenticated
  WITH CHECK (org_id = get_user_org_id(auth.uid()));

CREATE POLICY "Users can update google_sheet_connections in their org"
  ON public.google_sheet_connections FOR UPDATE TO public
  USING (org_id = get_user_org_id(auth.uid()));

CREATE POLICY "Users can delete google_sheet_connections in their org"
  ON public.google_sheet_connections FOR DELETE TO public
  USING (org_id = get_user_org_id(auth.uid()));

CREATE POLICY "Service role full access on google_sheet_connections"
  ON public.google_sheet_connections FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Sync Logs
CREATE TABLE public.sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.google_sheet_connections(id) ON DELETE CASCADE,
  synced_at timestamp with time zone NOT NULL DEFAULT now(),
  rows_synced integer NOT NULL DEFAULT 0,
  conflicts integer NOT NULL DEFAULT 0,
  errors integer NOT NULL DEFAULT 0,
  status public.sync_status NOT NULL DEFAULT 'running',
  error_details text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;

-- Helper function
CREATE OR REPLACE FUNCTION public.get_sheet_connection_org_id(_connection_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT org_id FROM public.google_sheet_connections WHERE id = _connection_id
$$;

CREATE POLICY "Users can view sync_logs in their org"
  ON public.sync_logs FOR SELECT TO public
  USING (get_sheet_connection_org_id(connection_id) = get_user_org_id(auth.uid()));

CREATE POLICY "Service role full access on sync_logs"
  ON public.sync_logs FOR ALL TO service_role
  USING (true) WITH CHECK (true);
