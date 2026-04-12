-- Fix 1: Restrict organizations UPDATE policy to authenticated role only
DROP POLICY IF EXISTS "Owners can update their org" ON public.organizations;
CREATE POLICY "Owners can update their org" ON public.organizations
  FOR UPDATE TO authenticated
  USING (id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'owner'))
  WITH CHECK (id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'owner'));