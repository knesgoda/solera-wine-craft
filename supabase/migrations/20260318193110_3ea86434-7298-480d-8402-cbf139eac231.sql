
-- Enum for allocation types
CREATE TYPE public.allocation_type AS ENUM (
  'dtc', 'wine_club', 'wholesale', 'restaurant', 'library', 'custom_crush_client'
);

-- Enum for adjustment reasons
CREATE TYPE public.adjustment_reason AS ENUM (
  'production_addition', 'sale', 'breakage', 'comp', 'audit_correction', 'custom_crush_transfer'
);

-- Alter existing inventory_skus table to add new columns
ALTER TABLE public.inventory_skus
  ADD COLUMN IF NOT EXISTS bottles_per_case integer NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS loose_bottles integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_per_bottle numeric NULL,
  ADD COLUMN IF NOT EXISTS allocation_type public.allocation_type NOT NULL DEFAULT 'dtc',
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS vintage_id uuid REFERENCES public.vintages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS label_image_url text NULL;

-- Rename 'bottles' to make room if it exists (it's the old column defaulting to 0)
-- We'll keep bottles as-is since it might have data; we use cases + loose_bottles going forward

-- Add notes column if not exists (it may already exist as nullable text)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_skus' AND column_name = 'notes') THEN
    ALTER TABLE public.inventory_skus ADD COLUMN notes text NULL;
  END IF;
END $$;

-- Create inventory_adjustments table
CREATE TABLE public.inventory_adjustments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  sku_id uuid NOT NULL REFERENCES public.inventory_skus(id) ON DELETE CASCADE,
  adjusted_at timestamptz NOT NULL DEFAULT now(),
  cases_delta integer NOT NULL DEFAULT 0,
  bottles_delta integer NOT NULL DEFAULT 0,
  reason public.adjustment_reason NOT NULL,
  notes text NULL,
  adjusted_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_adjustments ENABLE ROW LEVEL SECURITY;

-- RLS for inventory_adjustments
CREATE POLICY "Users can view inventory_adjustments in their org"
  ON public.inventory_adjustments FOR SELECT
  USING (org_id = get_user_org_id(auth.uid()));

CREATE POLICY "Users can insert inventory_adjustments in their org"
  ON public.inventory_adjustments FOR INSERT TO authenticated
  WITH CHECK (org_id = get_user_org_id(auth.uid()));

CREATE POLICY "Users can delete inventory_adjustments in their org"
  ON public.inventory_adjustments FOR DELETE
  USING (org_id = get_user_org_id(auth.uid()));

CREATE POLICY "Service role full access on inventory_adjustments"
  ON public.inventory_adjustments FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Storage bucket for label images
INSERT INTO storage.buckets (id, name, public)
VALUES ('label-images', 'label-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS for label-images bucket
CREATE POLICY "Authenticated users can upload label images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'label-images');

CREATE POLICY "Anyone can view label images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'label-images');

CREATE POLICY "Authenticated users can update label images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'label-images');

CREATE POLICY "Authenticated users can delete label images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'label-images');
