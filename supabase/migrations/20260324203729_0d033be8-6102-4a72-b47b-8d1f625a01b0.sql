
-- ============================================================
-- ENUM TYPES
-- ============================================================
CREATE TYPE public.cost_method AS ENUM ('apportioned', 'transactional', 'ad_hoc');
CREATE TYPE public.cost_entry_status AS ENUM ('active', 'voided', 'transferred');

-- ============================================================
-- TABLE: cost_categories
-- ============================================================
CREATE TABLE public.cost_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,
  is_system BOOLEAN DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, name)
);
CREATE INDEX idx_cost_categories_org ON public.cost_categories(org_id);

-- ============================================================
-- TABLE: material_unit_costs
-- ============================================================
CREATE TABLE public.material_unit_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category_id UUID REFERENCES public.cost_categories(id),
  unit TEXT NOT NULL,
  cost_per_unit NUMERIC(10,4) NOT NULL,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, name)
);
CREATE INDEX idx_material_costs_org ON public.material_unit_costs(org_id);

-- ============================================================
-- TABLE: cost_entries
-- ============================================================
CREATE TABLE public.cost_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  vintage_id UUID NOT NULL REFERENCES public.vintages(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.cost_categories(id),
  method public.cost_method NOT NULL,
  status public.cost_entry_status NOT NULL DEFAULT 'active',
  description TEXT NOT NULL,
  total_amount NUMERIC(12,2) NOT NULL,
  quantity NUMERIC(10,4),
  unit TEXT,
  cost_per_unit NUMERIC(10,4),
  lot_gallons_at_entry NUMERIC(10,2),
  cost_per_gallon NUMERIC(10,4) GENERATED ALWAYS AS (
    CASE WHEN lot_gallons_at_entry > 0 THEN total_amount / lot_gallons_at_entry ELSE NULL END
  ) STORED,
  weigh_tag_id UUID REFERENCES public.weigh_tags(id),
  addition_log_id UUID,
  barrel_id UUID REFERENCES public.barrels(id),
  vessel_id UUID REFERENCES public.fermentation_vessels(id),
  source_cost_entry_id UUID REFERENCES public.cost_entries(id),
  blend_trial_id UUID,
  source_vintage_id UUID REFERENCES public.vintages(id),
  transfer_ratio NUMERIC(8,6),
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id),
  voided_at TIMESTAMPTZ,
  voided_by UUID REFERENCES public.profiles(id),
  void_reason TEXT
);

CREATE INDEX idx_cost_entries_org ON public.cost_entries(org_id);
CREATE INDEX idx_cost_entries_vintage ON public.cost_entries(vintage_id);
CREATE INDEX idx_cost_entries_category ON public.cost_entries(category_id);
CREATE INDEX idx_cost_entries_status ON public.cost_entries(org_id, status);
CREATE INDEX idx_cost_entries_date ON public.cost_entries(org_id, effective_date);
CREATE INDEX idx_cost_entries_weigh_tag ON public.cost_entries(weigh_tag_id) WHERE weigh_tag_id IS NOT NULL;
CREATE INDEX idx_cost_entries_source ON public.cost_entries(source_cost_entry_id) WHERE source_cost_entry_id IS NOT NULL;

-- ============================================================
-- TABLE: lot_cost_summaries
-- ============================================================
CREATE TABLE public.lot_cost_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  vintage_id UUID NOT NULL REFERENCES public.vintages(id) ON DELETE CASCADE UNIQUE,
  total_cost NUMERIC(12,2) DEFAULT 0,
  grape_cost NUMERIC(12,2) DEFAULT 0,
  labor_cost NUMERIC(12,2) DEFAULT 0,
  cooperage_cost NUMERIC(12,2) DEFAULT 0,
  chemicals_cost NUMERIC(12,2) DEFAULT 0,
  bottling_cost NUMERIC(12,2) DEFAULT 0,
  overhead_cost NUMERIC(12,2) DEFAULT 0,
  other_cost NUMERIC(12,2) DEFAULT 0,
  total_gallons NUMERIC(10,2),
  cost_per_gallon NUMERIC(10,4),
  cost_per_barrel NUMERIC(10,4),
  cost_per_case NUMERIC(10,4),
  entry_count INTEGER DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_lot_summaries_org ON public.lot_cost_summaries(org_id);

-- ============================================================
-- RLS POLICIES
-- ============================================================
ALTER TABLE public.cost_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_unit_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lot_cost_summaries ENABLE ROW LEVEL SECURITY;

-- cost_categories
CREATE POLICY "Users can view cost categories in their org"
  ON public.cost_categories FOR SELECT TO authenticated
  USING (org_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Users can insert cost categories in their org"
  ON public.cost_categories FOR INSERT TO authenticated
  WITH CHECK (org_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Users can update cost categories in their org"
  ON public.cost_categories FOR UPDATE TO authenticated
  USING (org_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Users can delete cost categories in their org"
  ON public.cost_categories FOR DELETE TO authenticated
  USING (org_id = public.get_user_org_id(auth.uid()));

-- material_unit_costs
CREATE POLICY "Users can view material costs in their org"
  ON public.material_unit_costs FOR SELECT TO authenticated
  USING (org_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Users can insert material costs in their org"
  ON public.material_unit_costs FOR INSERT TO authenticated
  WITH CHECK (org_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Users can update material costs in their org"
  ON public.material_unit_costs FOR UPDATE TO authenticated
  USING (org_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Users can delete material costs in their org"
  ON public.material_unit_costs FOR DELETE TO authenticated
  USING (org_id = public.get_user_org_id(auth.uid()));

-- cost_entries
CREATE POLICY "Users can view cost entries in their org"
  ON public.cost_entries FOR SELECT TO authenticated
  USING (org_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Users can insert cost entries in their org"
  ON public.cost_entries FOR INSERT TO authenticated
  WITH CHECK (org_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Users can update cost entries in their org"
  ON public.cost_entries FOR UPDATE TO authenticated
  USING (org_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Admins can delete cost entries in their org"
  ON public.cost_entries FOR DELETE TO authenticated
  USING (org_id = public.get_user_org_id(auth.uid()) AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin')));

-- lot_cost_summaries
CREATE POLICY "Users can view lot cost summaries in their org"
  ON public.lot_cost_summaries FOR SELECT TO authenticated
  USING (org_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Users can insert lot cost summaries in their org"
  ON public.lot_cost_summaries FOR INSERT TO authenticated
  WITH CHECK (org_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Users can update lot cost summaries in their org"
  ON public.lot_cost_summaries FOR UPDATE TO authenticated
  USING (org_id = public.get_user_org_id(auth.uid()));

-- ============================================================
-- TRIGGER: Recalculate lot_cost_summaries
-- Uses actual column names: size_liters on barrels, capacity_liters on vessels
-- Converts liters to gallons (1 gal = 3.78541 L)
-- ============================================================
CREATE OR REPLACE FUNCTION public.recalculate_lot_cost_summary()
RETURNS TRIGGER AS $$
DECLARE
  v_id UUID;
  v_org UUID;
  v_total NUMERIC(12,2);
  v_grape NUMERIC(12,2);
  v_labor NUMERIC(12,2);
  v_cooperage NUMERIC(12,2);
  v_chemicals NUMERIC(12,2);
  v_bottling NUMERIC(12,2);
  v_overhead NUMERIC(12,2);
  v_other NUMERIC(12,2);
  v_count INTEGER;
  v_gallons NUMERIC(10,2);
BEGIN
  v_id := COALESCE(NEW.vintage_id, OLD.vintage_id);
  v_org := COALESCE(NEW.org_id, OLD.org_id);

  SELECT
    COALESCE(SUM(ce.total_amount), 0),
    COALESCE(SUM(CASE WHEN cc.name = 'Grape Purchase' THEN ce.total_amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN cc.name = 'Labor' THEN ce.total_amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN cc.name = 'Cooperage' THEN ce.total_amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN cc.name = 'Chemicals' THEN ce.total_amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN cc.name = 'Bottling' THEN ce.total_amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN cc.name = 'Overhead' THEN ce.total_amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN cc.name NOT IN ('Grape Purchase','Labor','Cooperage','Chemicals','Bottling','Overhead') THEN ce.total_amount ELSE 0 END), 0),
    COUNT(*)
  INTO v_total, v_grape, v_labor, v_cooperage, v_chemicals, v_bottling, v_overhead, v_other, v_count
  FROM public.cost_entries ce
  JOIN public.cost_categories cc ON ce.category_id = cc.id
  WHERE ce.vintage_id = v_id AND ce.status = 'active';

  -- Estimate gallons from vessels and barrels linked to this vintage
  -- Convert liters to gallons (1 gal = 3.78541 L)
  SELECT COALESCE(
    (SELECT SUM(fv.capacity_liters / 3.78541) FROM public.fermentation_vessels fv WHERE fv.vintage_id = v_id),
    0
  ) + COALESCE(
    (SELECT SUM(b.size_liters / 3.78541) FROM public.barrels b WHERE b.vintage_id = v_id),
    0
  ) INTO v_gallons;

  -- Fallback: estimate from tons_harvested if no vessel/barrel data (1 ton ≈ 170 gallons)
  IF v_gallons = 0 OR v_gallons IS NULL THEN
    SELECT COALESCE(v.tons_harvested * 170, 0) INTO v_gallons
    FROM public.vintages v WHERE v.id = v_id;
  END IF;

  INSERT INTO public.lot_cost_summaries (org_id, vintage_id, total_cost, grape_cost, labor_cost, cooperage_cost, chemicals_cost, bottling_cost, overhead_cost, other_cost, total_gallons, cost_per_gallon, cost_per_barrel, cost_per_case, entry_count, last_updated)
  VALUES (v_org, v_id, v_total, v_grape, v_labor, v_cooperage, v_chemicals, v_bottling, v_overhead, v_other, v_gallons,
    CASE WHEN v_gallons > 0 THEN v_total / v_gallons ELSE NULL END,
    CASE WHEN v_gallons > 0 THEN v_total / (v_gallons / 59.0) ELSE NULL END,
    CASE WHEN v_gallons > 0 THEN v_total / (v_gallons / 2.378) ELSE NULL END,
    v_count, now())
  ON CONFLICT (vintage_id) DO UPDATE SET
    total_cost = EXCLUDED.total_cost,
    grape_cost = EXCLUDED.grape_cost,
    labor_cost = EXCLUDED.labor_cost,
    cooperage_cost = EXCLUDED.cooperage_cost,
    chemicals_cost = EXCLUDED.chemicals_cost,
    bottling_cost = EXCLUDED.bottling_cost,
    overhead_cost = EXCLUDED.overhead_cost,
    other_cost = EXCLUDED.other_cost,
    total_gallons = EXCLUDED.total_gallons,
    cost_per_gallon = EXCLUDED.cost_per_gallon,
    cost_per_barrel = EXCLUDED.cost_per_barrel,
    cost_per_case = EXCLUDED.cost_per_case,
    entry_count = EXCLUDED.entry_count,
    last_updated = now();

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

CREATE TRIGGER trg_recalculate_lot_costs
AFTER INSERT OR UPDATE OR DELETE ON public.cost_entries
FOR EACH ROW EXECUTE FUNCTION public.recalculate_lot_cost_summary();

-- ============================================================
-- FUNCTION: Seed default cost categories
-- ============================================================
CREATE OR REPLACE FUNCTION public.seed_cost_categories(p_org_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.cost_categories (org_id, name, color, is_system, sort_order) VALUES
    (p_org_id, 'Grape Purchase', '#6B1B2A', true, 1),
    (p_org_id, 'Labor', '#C8902A', false, 2),
    (p_org_id, 'Cooperage', '#8B4513', false, 3),
    (p_org_id, 'Chemicals', '#2E86AB', false, 4),
    (p_org_id, 'Bottling', '#A23B72', false, 5),
    (p_org_id, 'Overhead', '#666666', false, 6),
    (p_org_id, 'Lab Analysis', '#4A7C59', false, 7),
    (p_org_id, 'Freight', '#D4A373', false, 8),
    (p_org_id, 'Other', '#999999', false, 9)
  ON CONFLICT (org_id, name) DO NOTHING;
END;
$$ LANGUAGE plpgsql SET search_path = 'public';

-- ============================================================
-- TRIGGER: Auto-create grape cost from approved weigh_tag
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_grape_cost_from_weigh_tag()
RETURNS TRIGGER AS $$
DECLARE
  grape_cat_id UUID;
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') AND NEW.vintage_id IS NOT NULL THEN
    SELECT id INTO grape_cat_id FROM public.cost_categories
    WHERE org_id = NEW.org_id AND name = 'Grape Purchase' LIMIT 1;

    IF grape_cat_id IS NOT NULL AND NEW.total_value IS NOT NULL AND NEW.total_value > 0 THEN
      INSERT INTO public.cost_entries (org_id, vintage_id, category_id, method, description, total_amount, effective_date, weigh_tag_id, created_by)
      VALUES (
        NEW.org_id,
        NEW.vintage_id,
        grape_cat_id,
        'transactional',
        'Grape purchase: ' || COALESCE(NEW.tag_number, 'Unknown') || ' (' || COALESCE(NEW.net_tons::TEXT, '0') || ' tons)',
        NEW.total_value,
        NEW.delivery_date,
        NEW.id,
        NEW.approved_by
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

CREATE TRIGGER trg_create_grape_cost
AFTER UPDATE ON public.weigh_tags
FOR EACH ROW EXECUTE FUNCTION public.create_grape_cost_from_weigh_tag();

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================
CREATE TRIGGER trg_material_unit_costs_updated_at
BEFORE UPDATE ON public.material_unit_costs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_cost_entries_updated_at
BEFORE UPDATE ON public.cost_entries
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- Seed categories for existing Growth+ orgs
-- ============================================================
SELECT public.seed_cost_categories(id) FROM public.organizations WHERE tier IN ('mid_size', 'enterprise');
