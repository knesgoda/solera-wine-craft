-- Protect sensitive storefront_config columns from anonymous reads by using column privileges.
REVOKE SELECT ON public.storefront_config FROM anon;
GRANT SELECT (id, org_id, enabled, store_name, store_description, store_logo_url, age_gate_enabled, custom_domain, created_at, updated_at) ON public.storefront_config TO anon;

-- Make roadmap vote privacy explicit. No client role can read voter IP rows.
DROP POLICY IF EXISTS "Service role can view roadmap votes" ON public.roadmap_votes;
CREATE POLICY "Service role can view roadmap votes"
ON public.roadmap_votes
FOR SELECT
TO service_role
USING (true);

-- Prevent public listing of public buckets while preserving direct public URL access.
DROP POLICY IF EXISTS "Anyone can view task photos" ON storage.objects;
CREATE POLICY "Anyone can view task photos by known path"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'task-photos'
  AND coalesce((storage.foldername(name))[1], '') <> ''
  AND name = (storage.foldername(name))[1] || '/' || (storage.filename(name))
);

DROP POLICY IF EXISTS "Anyone can view label images" ON storage.objects;
CREATE POLICY "Anyone can view label images by known path"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'label-images'
  AND coalesce((storage.foldername(name))[1], '') <> ''
  AND name = (storage.foldername(name))[1] || '/' || (storage.filename(name))
);

DROP POLICY IF EXISTS "Anyone can view store assets" ON storage.objects;
CREATE POLICY "Anyone can view store assets by known path"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'store-assets'
  AND coalesce((storage.foldername(name))[1], '') <> ''
  AND name = (storage.foldername(name))[1] || '/' || (storage.filename(name))
);

-- Restrict direct execution of privileged helper functions. Policies, triggers, and definer code can still use them internally.
REVOKE EXECUTE ON FUNCTION public.auto_expire_contracts() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_default_alert_rules() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_grape_cost_from_weigh_tag() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_user_count_limit() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_client_org_id_for_user(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_conversation_org_id(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_facility_org_id(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_import_job_org_id(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_org_tier(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_sheet_connection_org_id(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_shipment_org_id(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_trial_org_id(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_org_id(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_vessel_org_id(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_vineyard_org_id(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_vintage_org_id(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_webhook_sub_org_id(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_roadmap_votes() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.org_has_tier(uuid, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_client_user_role() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_profile_role() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalculate_lot_cost_summary() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_contract_totals() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.void_grape_cost_on_unapprove() FROM anon, authenticated;

-- Re-grant only the helper functions intentionally used by RLS policies to authenticated callers so policy evaluation remains reliable.
GRANT EXECUTE ON FUNCTION public.get_client_org_id_for_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_conversation_org_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_facility_org_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_import_job_org_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_org_tier(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_sheet_connection_org_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_shipment_org_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_trial_org_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_org_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_vessel_org_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_vineyard_org_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_vintage_org_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_webhook_sub_org_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_has_tier(uuid, text) TO authenticated;