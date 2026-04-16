
-- Add provenance columns to lab_samples
ALTER TABLE public.lab_samples ADD COLUMN IF NOT EXISTS import_source text;
ALTER TABLE public.lab_samples ADD COLUMN IF NOT EXISTS source_image_id uuid;

-- Add provenance columns to fermentation_logs
ALTER TABLE public.fermentation_logs ADD COLUMN IF NOT EXISTS import_source text;
ALTER TABLE public.fermentation_logs ADD COLUMN IF NOT EXISTS source_image_id uuid;

-- Create handwritten_import_sessions table
CREATE TABLE public.handwritten_import_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  page_count integer NOT NULL DEFAULT 1,
  rows_accepted integer NOT NULL DEFAULT 0,
  rows_rejected integer NOT NULL DEFAULT 0,
  storage_object_ids uuid[] DEFAULT '{}'
);

ALTER TABLE public.handwritten_import_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org sessions"
  ON public.handwritten_import_sessions FOR SELECT TO authenticated
  USING (org_id = get_user_org_id(auth.uid()));

CREATE POLICY "Users can create own org sessions"
  ON public.handwritten_import_sessions FOR INSERT TO authenticated
  WITH CHECK (org_id = get_user_org_id(auth.uid()));

CREATE POLICY "Users can update own org sessions"
  ON public.handwritten_import_sessions FOR UPDATE TO authenticated
  USING (org_id = get_user_org_id(auth.uid()));

CREATE POLICY "Users can delete own org sessions"
  ON public.handwritten_import_sessions FOR DELETE TO authenticated
  USING (org_id = get_user_org_id(auth.uid()));

-- Create private storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('handwritten-imports', 'handwritten-imports', false);

-- Storage RLS policies scoped to org
CREATE POLICY "Org members can upload handwritten imports"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'handwritten-imports' AND (storage.foldername(name))[1] = get_user_org_id(auth.uid())::text);

CREATE POLICY "Org members can view handwritten imports"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'handwritten-imports' AND (storage.foldername(name))[1] = get_user_org_id(auth.uid())::text);

CREATE POLICY "Org members can update handwritten imports"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'handwritten-imports' AND (storage.foldername(name))[1] = get_user_org_id(auth.uid())::text);

CREATE POLICY "Org members can delete handwritten imports"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'handwritten-imports' AND (storage.foldername(name))[1] = get_user_org_id(auth.uid())::text);
