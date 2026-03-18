
-- Drop the overly permissive policy
DROP POLICY "Authenticated users can insert orgs" ON public.organizations;

-- Replace with a more restrictive policy: users can only insert if they don't already belong to an org
CREATE POLICY "Authenticated users can create an org"
  ON public.organizations FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_org_id(auth.uid()) IS NULL);
