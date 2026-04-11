-- Helper: get org tier without recursion (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_org_tier(_org_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(tier, 'hobbyist') FROM public.organizations WHERE id = _org_id
$$;

-- Helper: check if org tier meets minimum requirement
CREATE OR REPLACE FUNCTION public.org_has_tier(_org_id uuid, _min_tier text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE get_org_tier(_org_id)
    WHEN 'enterprise' THEN true
    WHEN 'mid_size' THEN _min_tier IN ('mid_size', 'small_boutique', 'hobbyist')
    WHEN 'small_boutique' THEN _min_tier IN ('small_boutique', 'hobbyist')
    WHEN 'hobbyist' THEN _min_tier = 'hobbyist'
    ELSE false
  END
$$;

-- Gap 2: Add tier-based RLS to Growth-gated tables
-- cost_entries: require mid_size+
DROP POLICY IF EXISTS "Users can view cost entries" ON public.cost_entries;
CREATE POLICY "Users can view cost entries" ON public.cost_entries
  FOR SELECT TO authenticated
  USING (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'mid_size'));

DROP POLICY IF EXISTS "Users can insert cost entries" ON public.cost_entries;
CREATE POLICY "Users can insert cost entries" ON public.cost_entries
  FOR INSERT TO authenticated
  WITH CHECK (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'mid_size'));

DROP POLICY IF EXISTS "Users can update cost entries" ON public.cost_entries;
CREATE POLICY "Users can update cost entries" ON public.cost_entries
  FOR UPDATE TO authenticated
  USING (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'mid_size'));

DROP POLICY IF EXISTS "Users can delete cost entries" ON public.cost_entries;
CREATE POLICY "Users can delete cost entries" ON public.cost_entries
  FOR DELETE TO authenticated
  USING (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'mid_size'));

-- cost_categories: require mid_size+
DROP POLICY IF EXISTS "Users can view cost categories" ON public.cost_categories;
CREATE POLICY "Users can view cost categories" ON public.cost_categories
  FOR SELECT TO authenticated
  USING (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'mid_size'));

DROP POLICY IF EXISTS "Users can insert cost categories" ON public.cost_categories;
CREATE POLICY "Users can insert cost categories" ON public.cost_categories
  FOR INSERT TO authenticated
  WITH CHECK (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'mid_size'));

DROP POLICY IF EXISTS "Users can update cost categories" ON public.cost_categories;
CREATE POLICY "Users can update cost categories" ON public.cost_categories
  FOR UPDATE TO authenticated
  USING (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'mid_size'));

DROP POLICY IF EXISTS "Users can delete cost categories" ON public.cost_categories;
CREATE POLICY "Users can delete cost categories" ON public.cost_categories
  FOR DELETE TO authenticated
  USING (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'mid_size'));

-- lot_cost_summaries: require mid_size+
DROP POLICY IF EXISTS "Users can view lot cost summaries" ON public.lot_cost_summaries;
CREATE POLICY "Users can view lot cost summaries" ON public.lot_cost_summaries
  FOR SELECT TO authenticated
  USING (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'mid_size'));

DROP POLICY IF EXISTS "Users can insert lot cost summaries" ON public.lot_cost_summaries;
CREATE POLICY "Users can insert lot cost summaries" ON public.lot_cost_summaries
  FOR INSERT TO authenticated
  WITH CHECK (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'mid_size'));

DROP POLICY IF EXISTS "Users can update lot cost summaries" ON public.lot_cost_summaries;
CREATE POLICY "Users can update lot cost summaries" ON public.lot_cost_summaries
  FOR UPDATE TO authenticated
  USING (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'mid_size'));

-- blending_trials: require mid_size+
DROP POLICY IF EXISTS "Users can view blending trials" ON public.blending_trials;
CREATE POLICY "Users can view blending trials" ON public.blending_trials
  FOR SELECT TO authenticated
  USING (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'mid_size'));

DROP POLICY IF EXISTS "Users can create blending trials" ON public.blending_trials;
CREATE POLICY "Users can create blending trials" ON public.blending_trials
  FOR INSERT TO authenticated
  WITH CHECK (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'mid_size'));

DROP POLICY IF EXISTS "Users can update blending trials" ON public.blending_trials;
CREATE POLICY "Users can update blending trials" ON public.blending_trials
  FOR UPDATE TO authenticated
  USING (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'mid_size'));

DROP POLICY IF EXISTS "Users can delete blending trials" ON public.blending_trials;
CREATE POLICY "Users can delete blending trials" ON public.blending_trials
  FOR DELETE TO authenticated
  USING (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'mid_size'));

-- blending_trial_lots: require mid_size+ (via trial's org)
DROP POLICY IF EXISTS "Users can view trial lots" ON public.blending_trial_lots;
CREATE POLICY "Users can view trial lots" ON public.blending_trial_lots
  FOR SELECT TO authenticated
  USING (get_trial_org_id(trial_id) = get_user_org_id(auth.uid()) AND org_has_tier(get_trial_org_id(trial_id), 'mid_size'));

DROP POLICY IF EXISTS "Users can insert trial lots" ON public.blending_trial_lots;
CREATE POLICY "Users can insert trial lots" ON public.blending_trial_lots
  FOR INSERT TO authenticated
  WITH CHECK (get_trial_org_id(trial_id) = get_user_org_id(auth.uid()) AND org_has_tier(get_trial_org_id(trial_id), 'mid_size'));

DROP POLICY IF EXISTS "Users can update trial lots" ON public.blending_trial_lots;
CREATE POLICY "Users can update trial lots" ON public.blending_trial_lots
  FOR UPDATE TO authenticated
  USING (get_trial_org_id(trial_id) = get_user_org_id(auth.uid()) AND org_has_tier(get_trial_org_id(trial_id), 'mid_size'));

DROP POLICY IF EXISTS "Users can delete trial lots" ON public.blending_trial_lots;
CREATE POLICY "Users can delete trial lots" ON public.blending_trial_lots
  FOR DELETE TO authenticated
  USING (get_trial_org_id(trial_id) = get_user_org_id(auth.uid()) AND org_has_tier(get_trial_org_id(trial_id), 'mid_size'));

-- Gap 5: User count enforcement trigger
CREATE OR REPLACE FUNCTION public.enforce_user_count_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_tier text;
  max_users integer;
  current_count integer;
BEGIN
  IF NEW.org_id IS NULL THEN
    RETURN NEW;
  END IF;

  org_tier := get_org_tier(NEW.org_id);

  max_users := CASE org_tier
    WHEN 'hobbyist' THEN 1
    WHEN 'small_boutique' THEN 5
    WHEN 'mid_size' THEN 15
    WHEN 'enterprise' THEN 999999
    ELSE 1
  END;

  SELECT COUNT(*) INTO current_count
  FROM public.profiles
  WHERE org_id = NEW.org_id;

  IF current_count >= max_users THEN
    RAISE EXCEPTION 'User limit reached for % tier (max: %)', org_tier, max_users;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER check_user_count_limit
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_user_count_limit();
