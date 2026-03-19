
-- admin_metrics: weekly Search Console + strategy notes
CREATE TABLE IF NOT EXISTS public.admin_metrics (
  id uuid primary key default gen_random_uuid(),
  week_of date unique not null,
  sc_impressions int default 0,
  sc_clicks int default 0,
  sc_avg_position decimal,
  sc_top_queries jsonb default '[]'::jsonb,
  notes text,
  created_at timestamptz default now()
);

ALTER TABLE public.admin_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_metrics_owner_only" ON public.admin_metrics
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

-- admin_org_notes: internal notes per organization
CREATE TABLE IF NOT EXISTS public.admin_org_notes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade not null,
  note text not null,
  created_by uuid,
  created_at timestamptz default now()
);

ALTER TABLE public.admin_org_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_org_notes_owner_only" ON public.admin_org_notes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

-- admin_keywords: SEO keyword tracking
CREATE TABLE IF NOT EXISTS public.admin_keywords (
  id uuid primary key default gen_random_uuid(),
  keyword text not null,
  target_page text,
  current_ranking int,
  notes text,
  created_at timestamptz default now()
);

ALTER TABLE public.admin_keywords ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_keywords_owner_only" ON public.admin_keywords
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

-- admin_system_status: manual service health tracking
CREATE TABLE IF NOT EXISTS public.admin_system_status (
  id uuid primary key default gen_random_uuid(),
  service text unique not null,
  status text not null default 'operational',
  notes text,
  updated_at timestamptz default now()
);

ALTER TABLE public.admin_system_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_system_status_owner_only" ON public.admin_system_status
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

-- Add SEO tracking columns to blog_posts
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS target_keyword text;
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS current_ranking int;
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS weekly_clicks int;
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS weekly_impressions int;

-- Seed keyword targets
INSERT INTO public.admin_keywords (keyword, target_page, notes) VALUES
  ('winery management software', '/features', 'Primary keyword cluster'),
  ('Innovint alternative', '/compare/innovint', 'Competitor comparison'),
  ('winery software for small wineries', '/features', 'Long-tail variant'),
  ('custom crush management software', '/features', 'Custom crush niche'),
  ('winery inventory management', '/features', 'Inventory focused');

-- Seed system status
INSERT INTO public.admin_system_status (service, status) VALUES
  ('Supabase', 'operational'),
  ('Stripe', 'operational'),
  ('Anthropic AI', 'operational'),
  ('Open-Meteo', 'operational'),
  ('Resend', 'operational');
