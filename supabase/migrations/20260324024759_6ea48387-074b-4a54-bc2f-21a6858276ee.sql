
CREATE TABLE public.waitlist_signups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name TEXT NOT NULL,
  email TEXT NOT NULL,
  operation_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX waitlist_signups_email_unique ON public.waitlist_signups (email);

ALTER TABLE public.waitlist_signups ENABLE ROW LEVEL SECURITY;

-- Allow public inserts (no auth required)
CREATE POLICY "Anyone can insert waitlist signups"
ON public.waitlist_signups
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Allow reads only for authenticated users with admin (owner) role
CREATE POLICY "Admins can read waitlist signups"
ON public.waitlist_signups
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'owner'));
