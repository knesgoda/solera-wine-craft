
-- =============================================================================
-- Final pre-launch hardening: storage policies, orders INSERT, role tightening
-- =============================================================================

-- 1. CLIENT-DOCUMENTS STORAGE POLICIES
-- Files are uploaded under {client_org_id}/filename. Facility-side policies
-- previously compared the first path segment to the facility's own org_id,
-- which never matched. Rewrite them to verify the path's first segment is a
-- client_org owned by the caller's facility.

DROP POLICY IF EXISTS "Org users can read client docs" ON storage.objects;
DROP POLICY IF EXISTS "Org users can upload client docs" ON storage.objects;
DROP POLICY IF EXISTS "Org users can update client docs" ON storage.objects;
DROP POLICY IF EXISTS "Org users can delete client docs" ON storage.objects;

CREATE POLICY "Facility users can read their clients docs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'client-documents'
  AND EXISTS (
    SELECT 1 FROM public.client_orgs co
    WHERE co.id::text = (storage.foldername(name))[1]
      AND co.parent_org_id = public.get_user_org_id(auth.uid())
  )
);

CREATE POLICY "Facility users can upload to their clients docs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'client-documents'
  AND EXISTS (
    SELECT 1 FROM public.client_orgs co
    WHERE co.id::text = (storage.foldername(name))[1]
      AND co.parent_org_id = public.get_user_org_id(auth.uid())
  )
);

CREATE POLICY "Facility users can update their clients docs"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'client-documents'
  AND EXISTS (
    SELECT 1 FROM public.client_orgs co
    WHERE co.id::text = (storage.foldername(name))[1]
      AND co.parent_org_id = public.get_user_org_id(auth.uid())
  )
);

CREATE POLICY "Facility users can delete their clients docs"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'client-documents'
  AND EXISTS (
    SELECT 1 FROM public.client_orgs co
    WHERE co.id::text = (storage.foldername(name))[1]
      AND co.parent_org_id = public.get_user_org_id(auth.uid())
  )
);

-- 2. ORDERS — add explicit authenticated INSERT policy with same tier gating
CREATE POLICY "Users can create orders in their org"
ON public.orders FOR INSERT
TO authenticated
WITH CHECK (
  org_id = public.get_user_org_id(auth.uid())
  AND public.org_has_tier(org_id, 'small_boutique')
);

-- 3. RETARGET PUBLIC-ROLE POLICIES TO AUTHENTICATED
-- All SELECT/UPDATE/DELETE policies in public schema currently bound to the
-- 'public' role (which includes anon) are flipped to 'authenticated'.
-- Skips storage.objects (handled above) and policies legitimately bound to
-- service_role only. INSERT policies are already correctly scoped.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND 'public' = ANY(roles)
      AND cmd IN ('SELECT', 'UPDATE', 'DELETE')
  LOOP
    EXECUTE format(
      'ALTER POLICY %I ON %I.%I TO authenticated',
      r.policyname, r.schemaname, r.tablename
    );
  END LOOP;
END $$;
