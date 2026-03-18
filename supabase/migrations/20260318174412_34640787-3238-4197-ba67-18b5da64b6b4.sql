
-- Create task_status enum
CREATE TYPE public.task_status AS ENUM ('pending', 'in_progress', 'complete');

-- Create tasks table
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  block_id uuid REFERENCES public.blocks(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL,
  due_date date,
  status public.task_status NOT NULL DEFAULT 'pending',
  instructions text,
  photos text[] DEFAULT '{}',
  gps_lat numeric,
  gps_lng numeric,
  offline_queued boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- RLS policies scoped to org_id
CREATE POLICY "Users can view tasks in their org"
  ON public.tasks FOR SELECT
  USING (org_id = get_user_org_id(auth.uid()));

CREATE POLICY "Users can insert tasks in their org"
  ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (org_id = get_user_org_id(auth.uid()));

CREATE POLICY "Users can update tasks in their org"
  ON public.tasks FOR UPDATE
  USING (org_id = get_user_org_id(auth.uid()));

CREATE POLICY "Users can delete tasks in their org"
  ON public.tasks FOR DELETE
  USING (org_id = get_user_org_id(auth.uid()));

-- Updated_at trigger
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Storage bucket for task photos
INSERT INTO storage.buckets (id, name, public) VALUES ('task-photos', 'task-photos', true);

-- Storage policies
CREATE POLICY "Authenticated users can upload task photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'task-photos');

CREATE POLICY "Anyone can view task photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'task-photos');

CREATE POLICY "Authenticated users can delete their task photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'task-photos');
