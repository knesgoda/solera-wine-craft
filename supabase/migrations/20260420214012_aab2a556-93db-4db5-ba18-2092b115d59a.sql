-- Add pdf_path column for URL regeneration (signed URLs expire)
ALTER TABLE public.ttb_reports
  ADD COLUMN IF NOT EXISTS pdf_path text;

-- Audit log for additions log exports
CREATE TABLE IF NOT EXISTS public.ttb_export_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  exported_by uuid REFERENCES auth.users(id),
  export_type text NOT NULL,
  period_start date,
  period_end date,
  row_count integer NOT NULL DEFAULT 0,
  storage_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ttb_export_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org users can view ttb_export_log"
  ON public.ttb_export_log FOR SELECT
  USING (org_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Service role full access on ttb_export_log"
  ON public.ttb_export_log FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_ttb_export_log_org_created
  ON public.ttb_export_log (org_id, created_at DESC);