-- Audit table for account/org deletion requests (right to erasure)
CREATE TABLE public.data_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID,
  org_name_snapshot TEXT NOT NULL,
  org_tier_snapshot TEXT,
  requested_by_user_id UUID,
  requested_by_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed')),
  error_message TEXT,
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  metadata_json JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_ddr_org_id ON public.data_deletion_requests(org_id);
CREATE INDEX idx_ddr_status ON public.data_deletion_requests(status);
CREATE INDEX idx_ddr_requested_at ON public.data_deletion_requests(requested_at DESC);

ALTER TABLE public.data_deletion_requests ENABLE ROW LEVEL SECURITY;

-- Owners can view their own org's deletion requests (before deletion completes)
CREATE POLICY "Owners view their own deletion requests"
ON public.data_deletion_requests
FOR SELECT
TO authenticated
USING (
  org_id = public.get_user_org_id(auth.uid())
  AND public.has_role(auth.uid(), 'owner'::app_role)
);

-- Inserts/updates handled by service role only (edge function)
-- No INSERT/UPDATE/DELETE policies for authenticated users.