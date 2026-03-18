
-- Create lifecycle stage enum
CREATE TYPE public.block_lifecycle_stage AS ENUM ('planting', 'establishment', 'bearing', 'mature', 'replanting');

-- Create block status enum
CREATE TYPE public.block_status AS ENUM ('active', 'inactive', 'removed');

-- Create vineyards table
CREATE TABLE public.vineyards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  coordinates TEXT,
  acres NUMERIC,
  region TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create blocks table
CREATE TABLE public.blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vineyard_id UUID NOT NULL REFERENCES public.vineyards(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  variety TEXT,
  clone TEXT,
  rootstock TEXT,
  acres NUMERIC,
  status block_status NOT NULL DEFAULT 'active',
  lifecycle_stage block_lifecycle_stage,
  soil_ph NUMERIC,
  soil_texture TEXT,
  soil_organic_matter NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vineyards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

-- Vineyards RLS: scoped to org_id
CREATE POLICY "Users can view vineyards in their org"
  ON public.vineyards FOR SELECT
  USING (org_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Users can insert vineyards in their org"
  ON public.vineyards FOR INSERT
  TO authenticated
  WITH CHECK (org_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Users can update vineyards in their org"
  ON public.vineyards FOR UPDATE
  USING (org_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Users can delete vineyards in their org"
  ON public.vineyards FOR DELETE
  USING (org_id = public.get_user_org_id(auth.uid()));

-- Helper function: get org_id from vineyard
CREATE OR REPLACE FUNCTION public.get_vineyard_org_id(_vineyard_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM public.vineyards WHERE id = _vineyard_id
$$;

-- Blocks RLS: scoped to org_id via vineyard
CREATE POLICY "Users can view blocks in their org"
  ON public.blocks FOR SELECT
  USING (public.get_vineyard_org_id(vineyard_id) = public.get_user_org_id(auth.uid()));

CREATE POLICY "Users can insert blocks in their org"
  ON public.blocks FOR INSERT
  TO authenticated
  WITH CHECK (public.get_vineyard_org_id(vineyard_id) = public.get_user_org_id(auth.uid()));

CREATE POLICY "Users can update blocks in their org"
  ON public.blocks FOR UPDATE
  USING (public.get_vineyard_org_id(vineyard_id) = public.get_user_org_id(auth.uid()));

CREATE POLICY "Users can delete blocks in their org"
  ON public.blocks FOR DELETE
  USING (public.get_vineyard_org_id(vineyard_id) = public.get_user_org_id(auth.uid()));

-- Indexes
CREATE INDEX idx_vineyards_org_id ON public.vineyards(org_id);
CREATE INDEX idx_blocks_vineyard_id ON public.blocks(vineyard_id);

-- Timestamp triggers
CREATE TRIGGER update_vineyards_updated_at
  BEFORE UPDATE ON public.vineyards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_blocks_updated_at
  BEFORE UPDATE ON public.blocks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
