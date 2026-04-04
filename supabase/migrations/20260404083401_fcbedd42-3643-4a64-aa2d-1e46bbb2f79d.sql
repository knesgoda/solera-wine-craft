
-- CRITICAL FIX 1: Drop anonymous read on client_invite_tokens
DROP POLICY IF EXISTS "Anon can view invite tokens" ON public.client_invite_tokens;

-- CRITICAL FIX 2: TTB reports — restrict to org-scoped authenticated
DROP POLICY IF EXISTS "Org users can view ttb reports" ON storage.objects;
CREATE POLICY "Org users can view ttb reports"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'ttb-reports' AND (storage.foldername(name))[1] = get_user_org_id(auth.uid())::text);

DROP POLICY IF EXISTS "Org users can upload ttb reports" ON storage.objects;
CREATE POLICY "Org users can upload ttb reports"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'ttb-reports' AND (storage.foldername(name))[1] = get_user_org_id(auth.uid())::text);

DROP POLICY IF EXISTS "Org users can update ttb reports" ON storage.objects;
CREATE POLICY "Org users can update ttb reports"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'ttb-reports' AND (storage.foldername(name))[1] = get_user_org_id(auth.uid())::text);

-- CRITICAL FIX 3: Client documents — org-scoped access
DROP POLICY IF EXISTS "Facility users can manage client docs" ON storage.objects;

CREATE POLICY "Org users can read client docs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'client-documents' AND (storage.foldername(name))[1] = get_user_org_id(auth.uid())::text);

CREATE POLICY "Org users can upload client docs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'client-documents' AND (storage.foldername(name))[1] = get_user_org_id(auth.uid())::text);

CREATE POLICY "Org users can update client docs"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'client-documents' AND (storage.foldername(name))[1] = get_user_org_id(auth.uid())::text);

CREATE POLICY "Org users can delete client docs"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'client-documents' AND (storage.foldername(name))[1] = get_user_org_id(auth.uid())::text);

-- CRITICAL FIX 4: Remove notifications from realtime
ALTER PUBLICATION supabase_realtime DROP TABLE public.notifications;

-- MEDIUM FIX 5: Org-scope storage writes
DROP POLICY IF EXISTS "Authenticated users can upload task photos" ON storage.objects;
CREATE POLICY "Authenticated users can upload task photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'task-photos' AND (storage.foldername(name))[1] = get_user_org_id(auth.uid())::text);

DROP POLICY IF EXISTS "Authenticated users can delete their task photos" ON storage.objects;
CREATE POLICY "Authenticated users can delete their task photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'task-photos' AND (storage.foldername(name))[1] = get_user_org_id(auth.uid())::text);

DROP POLICY IF EXISTS "Authenticated users can upload label images" ON storage.objects;
CREATE POLICY "Authenticated users can upload label images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'label-images' AND (storage.foldername(name))[1] = get_user_org_id(auth.uid())::text);

DROP POLICY IF EXISTS "Authenticated users can update label images" ON storage.objects;
CREATE POLICY "Authenticated users can update label images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'label-images' AND (storage.foldername(name))[1] = get_user_org_id(auth.uid())::text);

DROP POLICY IF EXISTS "Authenticated users can delete label images" ON storage.objects;
CREATE POLICY "Authenticated users can delete label images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'label-images' AND (storage.foldername(name))[1] = get_user_org_id(auth.uid())::text);

DROP POLICY IF EXISTS "Authenticated users can upload store assets" ON storage.objects;
CREATE POLICY "Authenticated users can upload store assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'store-assets' AND (storage.foldername(name))[1] = get_user_org_id(auth.uid())::text);

DROP POLICY IF EXISTS "Authenticated users can update store assets" ON storage.objects;
CREATE POLICY "Authenticated users can update store assets"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'store-assets' AND (storage.foldername(name))[1] = get_user_org_id(auth.uid())::text);

-- MEDIUM FIX 6: Restrict anon DTC SKU access
DROP POLICY IF EXISTS "Anon can view active DTC SKUs" ON public.inventory_skus;
DROP POLICY IF EXISTS "Anon can view active DTC inventory_skus" ON public.inventory_skus;

CREATE POLICY "Anon can view active DTC SKUs"
ON public.inventory_skus FOR SELECT TO anon
USING (
  active = true
  AND allocation_type = 'dtc'
  AND org_id IN (SELECT org_id FROM storefront_config WHERE enabled = true)
);

-- MEDIUM FIX 7: Roadmap votes - keep read but note: voter_ip still in table
-- The read policy stays but we'll handle voter_ip exposure in code
DROP POLICY IF EXISTS "Anyone can read votes" ON public.roadmap_votes;
CREATE POLICY "Anyone can read vote counts"
ON public.roadmap_votes FOR SELECT TO anon, authenticated
USING (true);

-- QUALITY FIX 12: Contract auto-expiry trigger
CREATE OR REPLACE FUNCTION public.auto_expire_contracts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'active' AND NEW.delivery_end_date IS NOT NULL
     AND NEW.delivery_end_date < CURRENT_DATE THEN
    NEW.status := 'expired';
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_expire_contracts
BEFORE UPDATE ON public.grower_contracts
FOR EACH ROW
EXECUTE FUNCTION public.auto_expire_contracts();

CREATE TRIGGER trg_auto_expire_contracts_insert
BEFORE INSERT ON public.grower_contracts
FOR EACH ROW
EXECUTE FUNCTION public.auto_expire_contracts();
