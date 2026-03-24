
-- ENUM TYPES
CREATE TYPE public.grower_status AS ENUM ('active', 'inactive', 'prospect');
CREATE TYPE public.contract_status AS ENUM ('draft', 'active', 'fulfilled', 'cancelled', 'expired');
CREATE TYPE public.contract_pricing_unit AS ENUM ('per_ton', 'per_acre');
CREATE TYPE public.payment_term AS ENUM ('net_30', 'net_45', 'net_60', 'net_90', 'on_delivery', 'custom');
CREATE TYPE public.grading_direction AS ENUM ('higher_is_better', 'lower_is_better');
CREATE TYPE public.weigh_tag_status AS ENUM ('pending', 'graded', 'approved', 'disputed', 'paid');
CREATE TYPE public.metric_data_type AS ENUM ('numeric', 'percentage', 'boolean');

-- TABLE: growers
CREATE TABLE public.growers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  country TEXT DEFAULT 'US',
  tax_id TEXT,
  notes TEXT,
  status public.grower_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id)
);
CREATE INDEX idx_growers_org ON public.growers(org_id);
CREATE INDEX idx_growers_status ON public.growers(org_id, status);

-- TABLE: grower_contacts
CREATE TABLE public.grower_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  grower_id UUID NOT NULL REFERENCES public.growers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  email TEXT,
  phone TEXT,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_grower_contacts_grower ON public.grower_contacts(grower_id);

-- TABLE: grower_contracts
CREATE TABLE public.grower_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  grower_id UUID NOT NULL REFERENCES public.growers(id) ON DELETE CASCADE,
  contract_number TEXT,
  vintage_year INTEGER NOT NULL,
  status public.contract_status NOT NULL DEFAULT 'draft',
  pricing_unit public.contract_pricing_unit NOT NULL DEFAULT 'per_ton',
  base_price_per_unit NUMERIC(10,2) NOT NULL,
  estimated_tons NUMERIC(10,2),
  estimated_acres NUMERIC(10,2),
  min_tons NUMERIC(10,2),
  max_tons NUMERIC(10,2),
  payment_term public.payment_term NOT NULL DEFAULT 'net_30',
  payment_term_custom_days INTEGER,
  delivery_start_date DATE,
  delivery_end_date DATE,
  special_terms TEXT,
  notes TEXT,
  total_delivered_tons NUMERIC(10,2) DEFAULT 0,
  total_contract_value NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id)
);
CREATE INDEX idx_contracts_org ON public.grower_contracts(org_id);
CREATE INDEX idx_contracts_grower ON public.grower_contracts(grower_id);
CREATE INDEX idx_contracts_vintage ON public.grower_contracts(org_id, vintage_year);
CREATE INDEX idx_contracts_status ON public.grower_contracts(org_id, status);

-- TABLE: contract_block_assignments
CREATE TABLE public.contract_block_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contract_id UUID NOT NULL REFERENCES public.grower_contracts(id) ON DELETE CASCADE,
  block_id UUID NOT NULL REFERENCES public.blocks(id) ON DELETE CASCADE,
  estimated_tons NUMERIC(10,2),
  notes TEXT,
  UNIQUE(contract_id, block_id)
);
CREATE INDEX idx_cba_contract ON public.contract_block_assignments(contract_id);

-- TABLE: grading_scales
CREATE TABLE public.grading_scales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contract_id UUID NOT NULL REFERENCES public.grower_contracts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_template BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(contract_id)
);
CREATE INDEX idx_grading_scales_contract ON public.grading_scales(contract_id);
CREATE INDEX idx_grading_scales_org_template ON public.grading_scales(org_id, is_template) WHERE is_template = true;

-- TABLE: grading_scale_metrics
CREATE TABLE public.grading_scale_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  grading_scale_id UUID NOT NULL REFERENCES public.grading_scales(id) ON DELETE CASCADE,
  metric_name TEXT NOT NULL,
  metric_key TEXT NOT NULL,
  data_type public.metric_data_type NOT NULL DEFAULT 'numeric',
  unit TEXT,
  direction public.grading_direction NOT NULL,
  weight NUMERIC(5,2) DEFAULT 1.0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE(grading_scale_id, metric_key)
);
CREATE INDEX idx_gsm_scale ON public.grading_scale_metrics(grading_scale_id);

-- TABLE: grading_scale_tiers
CREATE TABLE public.grading_scale_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  metric_id UUID NOT NULL REFERENCES public.grading_scale_metrics(id) ON DELETE CASCADE,
  tier_label TEXT NOT NULL,
  min_value NUMERIC(10,4),
  max_value NUMERIC(10,4),
  price_adjustment NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_reject BOOLEAN DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE(metric_id, sort_order)
);
CREATE INDEX idx_tiers_metric ON public.grading_scale_tiers(metric_id);

-- TABLE: weigh_tags
CREATE TABLE public.weigh_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contract_id UUID NOT NULL REFERENCES public.grower_contracts(id) ON DELETE CASCADE,
  grower_id UUID NOT NULL REFERENCES public.growers(id),
  tag_number TEXT NOT NULL,
  vintage_id UUID REFERENCES public.vintages(id),
  block_id UUID REFERENCES public.blocks(id),
  delivery_date DATE NOT NULL DEFAULT CURRENT_DATE,
  truck_id TEXT,
  driver_name TEXT,
  gross_weight_lbs NUMERIC(10,2),
  tare_weight_lbs NUMERIC(10,2),
  net_weight_lbs NUMERIC(10,2) GENERATED ALWAYS AS (gross_weight_lbs - tare_weight_lbs) STORED,
  net_tons NUMERIC(10,4) GENERATED ALWAYS AS ((gross_weight_lbs - tare_weight_lbs) / 2000.0) STORED,
  total_price_adjustment NUMERIC(10,2) DEFAULT 0,
  final_price_per_unit NUMERIC(10,2),
  total_value NUMERIC(12,2),
  is_rejected BOOLEAN DEFAULT false,
  rejection_reason TEXT,
  status public.weigh_tag_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  photo_urls TEXT[],
  graded_at TIMESTAMPTZ,
  graded_by UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id)
);
CREATE INDEX idx_weigh_tags_org ON public.weigh_tags(org_id);
CREATE INDEX idx_weigh_tags_contract ON public.weigh_tags(contract_id);
CREATE INDEX idx_weigh_tags_grower ON public.weigh_tags(grower_id);
CREATE INDEX idx_weigh_tags_status ON public.weigh_tags(org_id, status);
CREATE INDEX idx_weigh_tags_date ON public.weigh_tags(org_id, delivery_date);

-- TABLE: weigh_tag_metrics
CREATE TABLE public.weigh_tag_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  weigh_tag_id UUID NOT NULL REFERENCES public.weigh_tags(id) ON DELETE CASCADE,
  metric_id UUID NOT NULL REFERENCES public.grading_scale_metrics(id),
  measured_value NUMERIC(10,4) NOT NULL,
  matched_tier_id UUID REFERENCES public.grading_scale_tiers(id),
  price_adjustment NUMERIC(10,2) DEFAULT 0,
  is_reject BOOLEAN DEFAULT false,
  notes TEXT,
  UNIQUE(weigh_tag_id, metric_id)
);
CREATE INDEX idx_wtm_weigh_tag ON public.weigh_tag_metrics(weigh_tag_id);

-- RLS
ALTER TABLE public.growers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grower_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grower_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_block_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grading_scales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grading_scale_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grading_scale_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weigh_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weigh_tag_metrics ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES
CREATE POLICY "Users can view growers in their org" ON public.growers FOR SELECT USING (org_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Users can insert growers in their org" ON public.growers FOR INSERT WITH CHECK (org_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Users can update growers in their org" ON public.growers FOR UPDATE USING (org_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Users can delete growers in their org" ON public.growers FOR DELETE USING (org_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Users can view grower_contacts in their org" ON public.grower_contacts FOR SELECT USING (org_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Users can insert grower_contacts in their org" ON public.grower_contacts FOR INSERT WITH CHECK (org_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Users can update grower_contacts in their org" ON public.grower_contacts FOR UPDATE USING (org_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Users can delete grower_contacts in their org" ON public.grower_contacts FOR DELETE USING (org_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Users can view grower_contracts in their org" ON public.grower_contracts FOR SELECT USING (org_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Users can insert grower_contracts in their org" ON public.grower_contracts FOR INSERT WITH CHECK (org_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Users can update grower_contracts in their org" ON public.grower_contracts FOR UPDATE USING (org_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Users can delete grower_contracts in their org" ON public.grower_contracts FOR DELETE USING (org_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Users can view cba in their org" ON public.contract_block_assignments FOR SELECT USING (org_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Users can insert cba in their org" ON public.contract_block_assignments FOR INSERT WITH CHECK (org_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Users can update cba in their org" ON public.contract_block_assignments FOR UPDATE USING (org_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Users can delete cba in their org" ON public.contract_block_assignments FOR DELETE USING (org_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Users can view grading_scales in their org" ON public.grading_scales FOR SELECT USING (org_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Users can insert grading_scales in their org" ON public.grading_scales FOR INSERT WITH CHECK (org_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Users can update grading_scales in their org" ON public.grading_scales FOR UPDATE USING (org_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Users can delete grading_scales in their org" ON public.grading_scales FOR DELETE USING (org_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Users can view grading_scale_metrics in their org" ON public.grading_scale_metrics FOR SELECT USING (org_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Users can insert grading_scale_metrics in their org" ON public.grading_scale_metrics FOR INSERT WITH CHECK (org_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Users can update grading_scale_metrics in their org" ON public.grading_scale_metrics FOR UPDATE USING (org_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Users can delete grading_scale_metrics in their org" ON public.grading_scale_metrics FOR DELETE USING (org_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Users can view grading_scale_tiers in their org" ON public.grading_scale_tiers FOR SELECT USING (org_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Users can insert grading_scale_tiers in their org" ON public.grading_scale_tiers FOR INSERT WITH CHECK (org_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Users can update grading_scale_tiers in their org" ON public.grading_scale_tiers FOR UPDATE USING (org_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Users can delete grading_scale_tiers in their org" ON public.grading_scale_tiers FOR DELETE USING (org_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Users can view weigh_tags in their org" ON public.weigh_tags FOR SELECT USING (org_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Users can insert weigh_tags in their org" ON public.weigh_tags FOR INSERT WITH CHECK (org_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Users can update weigh_tags in their org" ON public.weigh_tags FOR UPDATE USING (org_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Users can delete weigh_tags in their org" ON public.weigh_tags FOR DELETE USING (org_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Users can view weigh_tag_metrics in their org" ON public.weigh_tag_metrics FOR SELECT USING (org_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Users can insert weigh_tag_metrics in their org" ON public.weigh_tag_metrics FOR INSERT WITH CHECK (org_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Users can update weigh_tag_metrics in their org" ON public.weigh_tag_metrics FOR UPDATE USING (org_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Users can delete weigh_tag_metrics in their org" ON public.weigh_tag_metrics FOR DELETE USING (org_id = public.get_user_org_id(auth.uid()));

-- TRIGGERS: updated_at
CREATE TRIGGER trg_growers_updated_at BEFORE UPDATE ON public.growers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_grower_contracts_updated_at BEFORE UPDATE ON public.grower_contracts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_grading_scales_updated_at BEFORE UPDATE ON public.grading_scales FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_weigh_tags_updated_at BEFORE UPDATE ON public.weigh_tags FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- TRIGGER: auto-update contract totals from weigh tags
CREATE OR REPLACE FUNCTION public.update_contract_totals()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.grower_contracts
  SET
    total_delivered_tons = COALESCE((
      SELECT SUM(net_tons) FROM public.weigh_tags
      WHERE contract_id = COALESCE(NEW.contract_id, OLD.contract_id)
      AND status != 'disputed' AND is_rejected = false
    ), 0),
    total_contract_value = COALESCE((
      SELECT SUM(total_value) FROM public.weigh_tags
      WHERE contract_id = COALESCE(NEW.contract_id, OLD.contract_id)
      AND status != 'disputed' AND is_rejected = false
    ), 0),
    updated_at = now()
  WHERE id = COALESCE(NEW.contract_id, OLD.contract_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_update_contract_totals
AFTER INSERT OR UPDATE OR DELETE ON public.weigh_tags
FOR EACH ROW EXECUTE FUNCTION public.update_contract_totals();

-- TRIGGER: auto-generate contract_number
CREATE OR REPLACE FUNCTION public.generate_contract_number()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
BEGIN
  IF NEW.contract_number IS NULL OR NEW.contract_number = '' THEN
    SELECT COALESCE(MAX(
      CAST(SUBSTRING(contract_number FROM 'GC-[0-9]+-([0-9]+)') AS INTEGER)
    ), 0) + 1
    INTO next_num
    FROM public.grower_contracts
    WHERE org_id = NEW.org_id AND vintage_year = NEW.vintage_year;
    NEW.contract_number := 'GC-' || NEW.vintage_year || '-' || LPAD(next_num::TEXT, 3, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_generate_contract_number
BEFORE INSERT ON public.grower_contracts
FOR EACH ROW EXECUTE FUNCTION public.generate_contract_number();

-- TRIGGER: auto-generate tag_number
CREATE OR REPLACE FUNCTION public.generate_tag_number()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
BEGIN
  IF NEW.tag_number IS NULL OR NEW.tag_number = '' THEN
    SELECT COALESCE(MAX(
      CAST(SUBSTRING(tag_number FROM 'WT-[0-9]+-([0-9]+)') AS INTEGER)
    ), 0) + 1
    INTO next_num
    FROM public.weigh_tags
    WHERE org_id = NEW.org_id AND EXTRACT(YEAR FROM delivery_date) = EXTRACT(YEAR FROM NEW.delivery_date);
    NEW.tag_number := 'WT-' || EXTRACT(YEAR FROM NEW.delivery_date)::TEXT || '-' || LPAD(next_num::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_generate_tag_number
BEFORE INSERT ON public.weigh_tags
FOR EACH ROW EXECUTE FUNCTION public.generate_tag_number();
