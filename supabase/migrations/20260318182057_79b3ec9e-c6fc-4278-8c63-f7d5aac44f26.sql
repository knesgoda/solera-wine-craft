
-- Create weather_readings table
CREATE TABLE public.weather_readings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  vineyard_id uuid NOT NULL REFERENCES public.vineyards(id) ON DELETE CASCADE,
  recorded_at date NOT NULL,
  temp_f numeric,
  temp_min_f numeric,
  temp_max_f numeric,
  precip_inches numeric,
  wind_mph numeric,
  gdd_daily numeric,
  gdd_cumulative numeric,
  source text NOT NULL DEFAULT 'open_meteo',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(vineyard_id, recorded_at, source)
);
ALTER TABLE public.weather_readings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view weather_readings in their org" ON public.weather_readings
  FOR SELECT USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can insert weather_readings in their org" ON public.weather_readings
  FOR INSERT TO authenticated WITH CHECK (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can update weather_readings in their org" ON public.weather_readings
  FOR UPDATE USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can delete weather_readings in their org" ON public.weather_readings
  FOR DELETE USING (org_id = get_user_org_id(auth.uid()));

-- Create vineyard_weather_config table
CREATE TABLE public.vineyard_weather_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  vineyard_id uuid NOT NULL REFERENCES public.vineyards(id) ON DELETE CASCADE UNIQUE,
  latitude numeric,
  longitude numeric,
  gdd_base_temp_f numeric NOT NULL DEFAULT 50,
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.vineyard_weather_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view vineyard_weather_config in their org" ON public.vineyard_weather_config
  FOR SELECT USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can insert vineyard_weather_config in their org" ON public.vineyard_weather_config
  FOR INSERT TO authenticated WITH CHECK (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can update vineyard_weather_config in their org" ON public.vineyard_weather_config
  FOR UPDATE USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can delete vineyard_weather_config in their org" ON public.vineyard_weather_config
  FOR DELETE USING (org_id = get_user_org_id(auth.uid()));

-- Enable pg_cron and pg_net for scheduled weather ingestion
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
