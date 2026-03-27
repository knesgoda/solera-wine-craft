
-- Backup export format enum
CREATE TYPE public.backup_format AS ENUM ('csv', 'xlsx');

-- Backup job status enum
CREATE TYPE public.backup_status AS ENUM ('pending', 'processing', 'completed', 'failed');

-- Backup jobs table
CREATE TABLE public.backup_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  status public.backup_status NOT NULL DEFAULT 'pending',
  format public.backup_format NOT NULL DEFAULT 'csv',
  file_url text,
  file_size_bytes bigint,
  manifest_json jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  expires_at timestamptz,
  created_by uuid
);

-- RLS
ALTER TABLE public.backup_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org backup jobs"
  ON public.backup_jobs FOR SELECT TO authenticated
  USING (org_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Users can insert backup jobs for their org"
  ON public.backup_jobs FOR INSERT TO authenticated
  WITH CHECK (org_id = public.get_user_org_id(auth.uid()));

-- Storage bucket for backups (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('backups', 'backups', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: service role uploads, authenticated users download their org's files
CREATE POLICY "Authenticated users can read their org backups"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'backups' AND (storage.foldername(name))[1] = public.get_user_org_id(auth.uid())::text);
