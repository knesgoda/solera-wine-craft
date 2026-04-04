
-- ============================================================
-- 1. user_roles: replace write policies with org-scoped versions
-- ============================================================

-- Drop existing write policies
DROP POLICY IF EXISTS "Owners can insert user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Owners can update user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Owners can delete user_roles" ON public.user_roles;

-- Recreate with org-scoping through profiles
CREATE POLICY "Owners can insert user_roles (org-scoped)"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'owner')
  AND (SELECT org_id FROM public.profiles WHERE id = user_id)
    = get_user_org_id(auth.uid())
);

CREATE POLICY "Owners can update user_roles (org-scoped)"
ON public.user_roles FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'owner')
  AND (SELECT org_id FROM public.profiles WHERE id = user_id)
    = get_user_org_id(auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'owner')
  AND (SELECT org_id FROM public.profiles WHERE id = user_id)
    = get_user_org_id(auth.uid())
);

CREATE POLICY "Owners can delete user_roles (org-scoped)"
ON public.user_roles FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'owner')
  AND (SELECT org_id FROM public.profiles WHERE id = user_id)
    = get_user_org_id(auth.uid())
);

-- ============================================================
-- 2. roadmap_votes: unique constraint + drop public SELECT
-- ============================================================

-- Add unique constraint to prevent vote stuffing
ALTER TABLE public.roadmap_votes
ADD CONSTRAINT roadmap_votes_item_ip_unique UNIQUE (item_id, voter_ip);

-- Drop public SELECT policy (vote counts are on roadmap_items)
DROP POLICY IF EXISTS "Anyone can read votes" ON public.roadmap_votes;

-- ============================================================
-- 3. Storage DELETE policies for ttb-reports and store-assets
-- ============================================================

CREATE POLICY "Org users can delete ttb-reports"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'ttb-reports'
  AND (storage.foldername(name))[1] = get_user_org_id(auth.uid())::text
);

CREATE POLICY "Org users can delete store-assets"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'store-assets'
  AND (storage.foldername(name))[1] = get_user_org_id(auth.uid())::text
);
