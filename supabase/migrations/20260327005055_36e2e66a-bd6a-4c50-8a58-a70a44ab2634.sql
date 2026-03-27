
-- Fix: inventory_skus anon policy - scope to storefront-enabled orgs
DROP POLICY IF EXISTS "Anon can view active DTC SKUs" ON public.inventory_skus;

CREATE POLICY "Anon can view active DTC SKUs"
ON public.inventory_skus FOR SELECT TO anon
USING (
  active = true
  AND org_id IN (SELECT org_id FROM public.storefront_config WHERE enabled = true)
);

-- Drop stale user_roles policy
DROP POLICY IF EXISTS "Authenticated users can insert their own roles" ON public.user_roles;
