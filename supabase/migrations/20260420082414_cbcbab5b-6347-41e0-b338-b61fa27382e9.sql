-- Wrap RLS policies on Pro-tier and Enterprise-tier tables with org_has_tier() checks
-- Preserves existing org_id scoping; preserves client-portal and storefront and service-role policies

-- ============================================================
-- PRO TIER (small_boutique+) TABLES
-- ============================================================

-- fermentation_vessels (org_id)
DROP POLICY IF EXISTS "Users can view fermentation_vessels in their org" ON public.fermentation_vessels;
DROP POLICY IF EXISTS "Users can insert fermentation_vessels in their org" ON public.fermentation_vessels;
DROP POLICY IF EXISTS "Users can update fermentation_vessels in their org" ON public.fermentation_vessels;
DROP POLICY IF EXISTS "Users can delete fermentation_vessels in their org" ON public.fermentation_vessels;
CREATE POLICY "Users can view fermentation_vessels in their org" ON public.fermentation_vessels FOR SELECT TO authenticated USING (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'small_boutique'));
CREATE POLICY "Users can insert fermentation_vessels in their org" ON public.fermentation_vessels FOR INSERT TO authenticated WITH CHECK (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'small_boutique'));
CREATE POLICY "Users can update fermentation_vessels in their org" ON public.fermentation_vessels FOR UPDATE TO authenticated USING (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'small_boutique'));
CREATE POLICY "Users can delete fermentation_vessels in their org" ON public.fermentation_vessels FOR DELETE TO authenticated USING (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'small_boutique'));

-- barrels (org_id) - preserve "Client users can view their barrels" untouched
DROP POLICY IF EXISTS "Users can view barrels in their org" ON public.barrels;
DROP POLICY IF EXISTS "Users can insert barrels in their org" ON public.barrels;
DROP POLICY IF EXISTS "Users can update barrels in their org" ON public.barrels;
DROP POLICY IF EXISTS "Users can delete barrels in their org" ON public.barrels;
CREATE POLICY "Users can view barrels in their org" ON public.barrels FOR SELECT TO authenticated USING (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'small_boutique'));
CREATE POLICY "Users can insert barrels in their org" ON public.barrels FOR INSERT TO authenticated WITH CHECK (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'small_boutique'));
CREATE POLICY "Users can update barrels in their org" ON public.barrels FOR UPDATE TO authenticated USING (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'small_boutique'));
CREATE POLICY "Users can delete barrels in their org" ON public.barrels FOR DELETE TO authenticated USING (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'small_boutique'));

-- barrel_groups (org_id)
DROP POLICY IF EXISTS "Users can view barrel_groups in their org" ON public.barrel_groups;
DROP POLICY IF EXISTS "Users can insert barrel_groups in their org" ON public.barrel_groups;
DROP POLICY IF EXISTS "Users can update barrel_groups in their org" ON public.barrel_groups;
DROP POLICY IF EXISTS "Users can delete barrel_groups in their org" ON public.barrel_groups;
CREATE POLICY "Users can view barrel_groups in their org" ON public.barrel_groups FOR SELECT TO authenticated USING (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'small_boutique'));
CREATE POLICY "Users can insert barrel_groups in their org" ON public.barrel_groups FOR INSERT TO authenticated WITH CHECK (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'small_boutique'));
CREATE POLICY "Users can update barrel_groups in their org" ON public.barrel_groups FOR UPDATE TO authenticated USING (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'small_boutique'));
CREATE POLICY "Users can delete barrel_groups in their org" ON public.barrel_groups FOR DELETE TO authenticated USING (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'small_boutique'));

-- customers (org_id)
DROP POLICY IF EXISTS "Users can view customers in their org" ON public.customers;
DROP POLICY IF EXISTS "Users can insert customers in their org" ON public.customers;
DROP POLICY IF EXISTS "Users can update customers in their org" ON public.customers;
DROP POLICY IF EXISTS "Users can delete customers in their org" ON public.customers;
CREATE POLICY "Users can view customers in their org" ON public.customers FOR SELECT TO authenticated USING (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'small_boutique'));
CREATE POLICY "Users can insert customers in their org" ON public.customers FOR INSERT TO authenticated WITH CHECK (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'small_boutique'));
CREATE POLICY "Users can update customers in their org" ON public.customers FOR UPDATE TO authenticated USING (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'small_boutique'));
CREATE POLICY "Users can delete customers in their org" ON public.customers FOR DELETE TO authenticated USING (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'small_boutique'));

-- orders (org_id) - no INSERT policy exists (orders are inserted via service role)
DROP POLICY IF EXISTS "Users can view orders in their org" ON public.orders;
DROP POLICY IF EXISTS "Users can update orders in their org" ON public.orders;
DROP POLICY IF EXISTS "Users can delete orders in their org" ON public.orders;
CREATE POLICY "Users can view orders in their org" ON public.orders FOR SELECT TO authenticated USING (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'small_boutique'));
CREATE POLICY "Users can update orders in their org" ON public.orders FOR UPDATE TO authenticated USING (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'small_boutique'));
CREATE POLICY "Users can delete orders in their org" ON public.orders FOR DELETE TO authenticated USING (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'small_boutique'));

-- wine_clubs (org_id) - preserve "Anon can view active wine_clubs" untouched
DROP POLICY IF EXISTS "Users can view wine_clubs in their org" ON public.wine_clubs;
DROP POLICY IF EXISTS "Users can insert wine_clubs in their org" ON public.wine_clubs;
DROP POLICY IF EXISTS "Users can update wine_clubs in their org" ON public.wine_clubs;
DROP POLICY IF EXISTS "Users can delete wine_clubs in their org" ON public.wine_clubs;
CREATE POLICY "Users can view wine_clubs in their org" ON public.wine_clubs FOR SELECT TO authenticated USING (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'small_boutique'));
CREATE POLICY "Users can insert wine_clubs in their org" ON public.wine_clubs FOR INSERT TO authenticated WITH CHECK (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'small_boutique'));
CREATE POLICY "Users can update wine_clubs in their org" ON public.wine_clubs FOR UPDATE TO authenticated USING (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'small_boutique'));
CREATE POLICY "Users can delete wine_clubs in their org" ON public.wine_clubs FOR DELETE TO authenticated USING (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'small_boutique'));

-- club_members (org_id)
DROP POLICY IF EXISTS "Users can view club_members in their org" ON public.club_members;
DROP POLICY IF EXISTS "Users can insert club_members in their org" ON public.club_members;
DROP POLICY IF EXISTS "Users can update club_members in their org" ON public.club_members;
DROP POLICY IF EXISTS "Users can delete club_members in their org" ON public.club_members;
CREATE POLICY "Users can view club_members in their org" ON public.club_members FOR SELECT TO authenticated USING (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'small_boutique'));
CREATE POLICY "Users can insert club_members in their org" ON public.club_members FOR INSERT TO authenticated WITH CHECK (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'small_boutique'));
CREATE POLICY "Users can update club_members in their org" ON public.club_members FOR UPDATE TO authenticated USING (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'small_boutique'));
CREATE POLICY "Users can delete club_members in their org" ON public.club_members FOR DELETE TO authenticated USING (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'small_boutique'));

-- club_shipments (org_id)
DROP POLICY IF EXISTS "Users can view club_shipments in their org" ON public.club_shipments;
DROP POLICY IF EXISTS "Users can insert club_shipments in their org" ON public.club_shipments;
DROP POLICY IF EXISTS "Users can update club_shipments in their org" ON public.club_shipments;
DROP POLICY IF EXISTS "Users can delete club_shipments in their org" ON public.club_shipments;
CREATE POLICY "Users can view club_shipments in their org" ON public.club_shipments FOR SELECT TO authenticated USING (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'small_boutique'));
CREATE POLICY "Users can insert club_shipments in their org" ON public.club_shipments FOR INSERT TO authenticated WITH CHECK (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'small_boutique'));
CREATE POLICY "Users can update club_shipments in their org" ON public.club_shipments FOR UPDATE TO authenticated USING (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'small_boutique'));
CREATE POLICY "Users can delete club_shipments in their org" ON public.club_shipments FOR DELETE TO authenticated USING (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'small_boutique'));

-- club_shipment_members (uses get_shipment_org_id helper)
DROP POLICY IF EXISTS "Users can view club_shipment_members in their org" ON public.club_shipment_members;
DROP POLICY IF EXISTS "Users can insert club_shipment_members in their org" ON public.club_shipment_members;
DROP POLICY IF EXISTS "Users can update club_shipment_members in their org" ON public.club_shipment_members;
DROP POLICY IF EXISTS "Users can delete club_shipment_members in their org" ON public.club_shipment_members;
CREATE POLICY "Users can view club_shipment_members in their org" ON public.club_shipment_members FOR SELECT TO authenticated USING (get_shipment_org_id(shipment_id) = get_user_org_id(auth.uid()) AND org_has_tier(get_shipment_org_id(shipment_id), 'small_boutique'));
CREATE POLICY "Users can insert club_shipment_members in their org" ON public.club_shipment_members FOR INSERT TO authenticated WITH CHECK (get_shipment_org_id(shipment_id) = get_user_org_id(auth.uid()) AND org_has_tier(get_shipment_org_id(shipment_id), 'small_boutique'));
CREATE POLICY "Users can update club_shipment_members in their org" ON public.club_shipment_members FOR UPDATE TO authenticated USING (get_shipment_org_id(shipment_id) = get_user_org_id(auth.uid()) AND org_has_tier(get_shipment_org_id(shipment_id), 'small_boutique'));
CREATE POLICY "Users can delete club_shipment_members in their org" ON public.club_shipment_members FOR DELETE TO authenticated USING (get_shipment_org_id(shipment_id) = get_user_org_id(auth.uid()) AND org_has_tier(get_shipment_org_id(shipment_id), 'small_boutique'));

-- ============================================================
-- ENTERPRISE TIER TABLES
-- ============================================================

-- growers (org_id)
DROP POLICY IF EXISTS "Users can view growers in their org" ON public.growers;
DROP POLICY IF EXISTS "Users can insert growers in their org" ON public.growers;
DROP POLICY IF EXISTS "Users can update growers in their org" ON public.growers;
DROP POLICY IF EXISTS "Users can delete growers in their org" ON public.growers;
CREATE POLICY "Users can view growers in their org" ON public.growers FOR SELECT TO authenticated USING (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'enterprise'));
CREATE POLICY "Users can insert growers in their org" ON public.growers FOR INSERT TO authenticated WITH CHECK (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'enterprise'));
CREATE POLICY "Users can update growers in their org" ON public.growers FOR UPDATE TO authenticated USING (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'enterprise'));
CREATE POLICY "Users can delete growers in their org" ON public.growers FOR DELETE TO authenticated USING (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'enterprise'));

-- grower_contracts (org_id)
DROP POLICY IF EXISTS "Users can view grower_contracts in their org" ON public.grower_contracts;
DROP POLICY IF EXISTS "Users can insert grower_contracts in their org" ON public.grower_contracts;
DROP POLICY IF EXISTS "Users can update grower_contracts in their org" ON public.grower_contracts;
DROP POLICY IF EXISTS "Users can delete grower_contracts in their org" ON public.grower_contracts;
CREATE POLICY "Users can view grower_contracts in their org" ON public.grower_contracts FOR SELECT TO authenticated USING (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'enterprise'));
CREATE POLICY "Users can insert grower_contracts in their org" ON public.grower_contracts FOR INSERT TO authenticated WITH CHECK (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'enterprise'));
CREATE POLICY "Users can update grower_contracts in their org" ON public.grower_contracts FOR UPDATE TO authenticated USING (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'enterprise'));
CREATE POLICY "Users can delete grower_contracts in their org" ON public.grower_contracts FOR DELETE TO authenticated USING (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'enterprise'));

-- contract_block_assignments (org_id)
DROP POLICY IF EXISTS "Users can view cba in their org" ON public.contract_block_assignments;
DROP POLICY IF EXISTS "Users can insert cba in their org" ON public.contract_block_assignments;
DROP POLICY IF EXISTS "Users can update cba in their org" ON public.contract_block_assignments;
DROP POLICY IF EXISTS "Users can delete cba in their org" ON public.contract_block_assignments;
CREATE POLICY "Users can view cba in their org" ON public.contract_block_assignments FOR SELECT TO authenticated USING (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'enterprise'));
CREATE POLICY "Users can insert cba in their org" ON public.contract_block_assignments FOR INSERT TO authenticated WITH CHECK (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'enterprise'));
CREATE POLICY "Users can update cba in their org" ON public.contract_block_assignments FOR UPDATE TO authenticated USING (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'enterprise'));
CREATE POLICY "Users can delete cba in their org" ON public.contract_block_assignments FOR DELETE TO authenticated USING (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'enterprise'));

-- weigh_tags (org_id)
DROP POLICY IF EXISTS "Users can view weigh_tags in their org" ON public.weigh_tags;
DROP POLICY IF EXISTS "Users can insert weigh_tags in their org" ON public.weigh_tags;
DROP POLICY IF EXISTS "Users can update weigh_tags in their org" ON public.weigh_tags;
DROP POLICY IF EXISTS "Users can delete weigh_tags in their org" ON public.weigh_tags;
CREATE POLICY "Users can view weigh_tags in their org" ON public.weigh_tags FOR SELECT TO authenticated USING (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'enterprise'));
CREATE POLICY "Users can insert weigh_tags in their org" ON public.weigh_tags FOR INSERT TO authenticated WITH CHECK (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'enterprise'));
CREATE POLICY "Users can update weigh_tags in their org" ON public.weigh_tags FOR UPDATE TO authenticated USING (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'enterprise'));
CREATE POLICY "Users can delete weigh_tags in their org" ON public.weigh_tags FOR DELETE TO authenticated USING (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'enterprise'));

-- audit_logs (org_id) - no DELETE policy exists; preserve service-role ALL
DROP POLICY IF EXISTS "Users can view audit_logs in their org" ON public.audit_logs;
DROP POLICY IF EXISTS "Users can insert audit_logs in their org" ON public.audit_logs;
CREATE POLICY "Users can view audit_logs in their org" ON public.audit_logs FOR SELECT TO authenticated USING (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'enterprise'));
CREATE POLICY "Users can insert audit_logs in their org" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'enterprise'));

-- facilities (parent_org_id, not org_id)
DROP POLICY IF EXISTS "Users can view facilities in their org" ON public.facilities;
DROP POLICY IF EXISTS "Users can insert facilities in their org" ON public.facilities;
DROP POLICY IF EXISTS "Users can update facilities in their org" ON public.facilities;
DROP POLICY IF EXISTS "Users can delete facilities in their org" ON public.facilities;
CREATE POLICY "Users can view facilities in their org" ON public.facilities FOR SELECT TO authenticated USING (parent_org_id = get_user_org_id(auth.uid()) AND org_has_tier(parent_org_id, 'enterprise'));
CREATE POLICY "Users can insert facilities in their org" ON public.facilities FOR INSERT TO authenticated WITH CHECK (parent_org_id = get_user_org_id(auth.uid()) AND org_has_tier(parent_org_id, 'enterprise'));
CREATE POLICY "Users can update facilities in their org" ON public.facilities FOR UPDATE TO authenticated USING (parent_org_id = get_user_org_id(auth.uid()) AND org_has_tier(parent_org_id, 'enterprise'));
CREATE POLICY "Users can delete facilities in their org" ON public.facilities FOR DELETE TO authenticated USING (parent_org_id = get_user_org_id(auth.uid()) AND org_has_tier(parent_org_id, 'enterprise'));

-- api_keys (org_id)
DROP POLICY IF EXISTS "Users can view api_keys in their org" ON public.api_keys;
DROP POLICY IF EXISTS "Users can insert api_keys in their org" ON public.api_keys;
DROP POLICY IF EXISTS "Users can update api_keys in their org" ON public.api_keys;
DROP POLICY IF EXISTS "Users can delete api_keys in their org" ON public.api_keys;
CREATE POLICY "Users can view api_keys in their org" ON public.api_keys FOR SELECT TO authenticated USING (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'enterprise'));
CREATE POLICY "Users can insert api_keys in their org" ON public.api_keys FOR INSERT TO authenticated WITH CHECK (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'enterprise'));
CREATE POLICY "Users can update api_keys in their org" ON public.api_keys FOR UPDATE TO authenticated USING (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'enterprise'));
CREATE POLICY "Users can delete api_keys in their org" ON public.api_keys FOR DELETE TO authenticated USING (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'enterprise'));

-- webhook_subscriptions (org_id)
DROP POLICY IF EXISTS "Users can view webhook_subscriptions in their org" ON public.webhook_subscriptions;
DROP POLICY IF EXISTS "Users can insert webhook_subscriptions in their org" ON public.webhook_subscriptions;
DROP POLICY IF EXISTS "Users can update webhook_subscriptions in their org" ON public.webhook_subscriptions;
DROP POLICY IF EXISTS "Users can delete webhook_subscriptions in their org" ON public.webhook_subscriptions;
CREATE POLICY "Users can view webhook_subscriptions in their org" ON public.webhook_subscriptions FOR SELECT TO authenticated USING (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'enterprise'));
CREATE POLICY "Users can insert webhook_subscriptions in their org" ON public.webhook_subscriptions FOR INSERT TO authenticated WITH CHECK (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'enterprise'));
CREATE POLICY "Users can update webhook_subscriptions in their org" ON public.webhook_subscriptions FOR UPDATE TO authenticated USING (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'enterprise'));
CREATE POLICY "Users can delete webhook_subscriptions in their org" ON public.webhook_subscriptions FOR DELETE TO authenticated USING (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'enterprise'));