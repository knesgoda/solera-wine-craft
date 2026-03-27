
-- 1. Create backup_schedules table
CREATE TABLE public.backup_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  frequency text NOT NULL DEFAULT 'weekly' CHECK (frequency IN ('weekly', 'monthly')),
  format text NOT NULL DEFAULT 'csv' CHECK (format IN ('csv', 'xlsx')),
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id)
);

ALTER TABLE public.backup_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org schedules"
  ON public.backup_schedules FOR SELECT
  TO authenticated
  USING (org_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Users can insert own org schedules"
  ON public.backup_schedules FOR INSERT
  TO authenticated
  WITH CHECK (org_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Users can update own org schedules"
  ON public.backup_schedules FOR UPDATE
  TO authenticated
  USING (org_id = public.get_user_org_id(auth.uid()));

-- 2. Add triggered_by column to backup_jobs
ALTER TABLE public.backup_jobs
  ADD COLUMN IF NOT EXISTS triggered_by text NOT NULL DEFAULT 'manual'
  CHECK (triggered_by IN ('manual', 'scheduled', 'cancellation'));

-- 3. Add cancelled_at column to organizations
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

-- 4. Updated_at trigger for backup_schedules
CREATE TRIGGER update_backup_schedules_updated_at
  BEFORE UPDATE ON public.backup_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
