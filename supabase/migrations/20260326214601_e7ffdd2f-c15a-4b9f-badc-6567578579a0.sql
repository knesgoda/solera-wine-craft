-- Add ripening_divergence to alert_parameter enum
ALTER TYPE public.alert_parameter ADD VALUE IF NOT EXISTS 'ripening_divergence';

-- Add variety_filter and brix_spread_threshold columns to alert_rules
ALTER TABLE public.alert_rules
  ADD COLUMN IF NOT EXISTS variety_filter text,
  ADD COLUMN IF NOT EXISTS brix_spread_threshold numeric DEFAULT 4.0;