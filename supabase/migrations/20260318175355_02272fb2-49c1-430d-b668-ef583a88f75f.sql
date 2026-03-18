
-- Addition type enum
CREATE TYPE public.addition_type AS ENUM ('so2', 'yeast_nutrient', 'enzyme', 'fining_agent', 'acid', 'other');

-- Addition unit enum
CREATE TYPE public.addition_unit AS ENUM ('g', 'kg', 'mL', 'L', 'oz', 'lb');

-- TTB Additions table
CREATE TABLE public.ttb_additions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vintage_id uuid NOT NULL REFERENCES public.vintages(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  addition_type public.addition_type NOT NULL,
  ttb_code text,
  amount numeric NOT NULL,
  unit public.addition_unit NOT NULL,
  batch_size numeric,
  added_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ttb_additions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view ttb_additions in their org" ON public.ttb_additions FOR SELECT USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can insert ttb_additions in their org" ON public.ttb_additions FOR INSERT TO authenticated WITH CHECK (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can update ttb_additions in their org" ON public.ttb_additions FOR UPDATE USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can delete ttb_additions in their org" ON public.ttb_additions FOR DELETE USING (org_id = get_user_org_id(auth.uid()));
