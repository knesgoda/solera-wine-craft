
-- TTB Bond Info
CREATE TABLE public.ttb_bond_info (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  bond_number text,
  bonded_winery_number text,
  proprietor_name text,
  premises_address text,
  registry_number text,
  report_period_start date,
  report_period_end date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id)
);

ALTER TABLE public.ttb_bond_info ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view ttb_bond_info in their org" ON public.ttb_bond_info
  FOR SELECT USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can insert ttb_bond_info in their org" ON public.ttb_bond_info
  FOR INSERT TO authenticated WITH CHECK (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can update ttb_bond_info in their org" ON public.ttb_bond_info
  FOR UPDATE USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can delete ttb_bond_info in their org" ON public.ttb_bond_info
  FOR DELETE USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Service role full access on ttb_bond_info" ON public.ttb_bond_info
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- TTB Report Status enum
CREATE TYPE public.ttb_report_status AS ENUM ('draft', 'ready', 'submitted');

-- TTB Wine Type enum
CREATE TYPE public.ttb_wine_type AS ENUM ('still_table_wine', 'sparkling_wine', 'dessert_wine', 'vermouth', 'other');

-- TTB Reports
CREATE TABLE public.ttb_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  report_period_start date NOT NULL,
  report_period_end date NOT NULL,
  status public.ttb_report_status NOT NULL DEFAULT 'draft',
  generated_at timestamptz DEFAULT now(),
  submitted_at timestamptz,
  pdf_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ttb_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view ttb_reports in their org" ON public.ttb_reports
  FOR SELECT USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can insert ttb_reports in their org" ON public.ttb_reports
  FOR INSERT TO authenticated WITH CHECK (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can update ttb_reports in their org" ON public.ttb_reports
  FOR UPDATE USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can delete ttb_reports in their org" ON public.ttb_reports
  FOR DELETE USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Service role full access on ttb_reports" ON public.ttb_reports
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- TTB Wine Premise Operations
CREATE TABLE public.ttb_wine_premise_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.ttb_reports(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  wine_type public.ttb_wine_type NOT NULL DEFAULT 'still_table_wine',
  beginning_inventory_gallons numeric NOT NULL DEFAULT 0,
  produced_gallons numeric NOT NULL DEFAULT 0,
  received_gallons numeric NOT NULL DEFAULT 0,
  bottled_gallons numeric NOT NULL DEFAULT 0,
  shipped_gallons numeric NOT NULL DEFAULT 0,
  dumped_gallons numeric NOT NULL DEFAULT 0,
  ending_inventory_gallons numeric NOT NULL DEFAULT 0,
  period_start date NOT NULL,
  period_end date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ttb_wine_premise_operations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view ttb_wine_premise_operations in their org" ON public.ttb_wine_premise_operations
  FOR SELECT USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can insert ttb_wine_premise_operations in their org" ON public.ttb_wine_premise_operations
  FOR INSERT TO authenticated WITH CHECK (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can update ttb_wine_premise_operations in their org" ON public.ttb_wine_premise_operations
  FOR UPDATE USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can delete ttb_wine_premise_operations in their org" ON public.ttb_wine_premise_operations
  FOR DELETE USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Service role full access on ttb_wine_premise_operations" ON public.ttb_wine_premise_operations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Storage bucket for TTB reports
INSERT INTO storage.buckets (id, name, public) VALUES ('ttb-reports', 'ttb-reports', false)
ON CONFLICT DO NOTHING;

-- Storage RLS for ttb-reports bucket
CREATE POLICY "Org users can upload ttb reports" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'ttb-reports');
CREATE POLICY "Org users can view ttb reports" ON storage.objects
  FOR SELECT USING (bucket_id = 'ttb-reports');
CREATE POLICY "Org users can update ttb reports" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'ttb-reports');
