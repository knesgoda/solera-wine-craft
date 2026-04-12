
-- 1. Wine clubs: scope anon policy to storefront-enabled orgs
DROP POLICY IF EXISTS "Anon can view active wine_clubs" ON public.wine_clubs;
CREATE POLICY "Anon can view active wine_clubs" ON public.wine_clubs
  FOR SELECT TO anon
  USING (active = true AND org_id IN (SELECT org_id FROM public.storefront_config WHERE enabled = true));

-- 2. User roles: remove unscoped policies (keep org-scoped ones)
DROP POLICY IF EXISTS "Owners and admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Owners can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Owners can delete roles" ON public.user_roles;

-- Also deduplicate SELECT policies
DROP POLICY IF EXISTS "Users can read own roles" ON public.user_roles;

-- 3. Client invite tokens: replace ALL policy with scoped per-command policies
DROP POLICY IF EXISTS "Facility users can manage invites" ON public.client_invite_tokens;

CREATE POLICY "Owners and admins can manage invites" ON public.client_invite_tokens
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM client_orgs co
      WHERE co.id = client_invite_tokens.client_org_id
        AND co.parent_org_id = get_user_org_id(auth.uid())
    )
    AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'))
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM client_orgs co
      WHERE co.id = client_invite_tokens.client_org_id
        AND co.parent_org_id = get_user_org_id(auth.uid())
    )
    AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'))
  );

-- 4. Roadmap votes: remove public SELECT to prevent voter_ip exposure
DROP POLICY IF EXISTS "Anyone can read vote counts" ON public.roadmap_votes;

-- 5. Fix search_path on email queue functions
CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name text, payload jsonb)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN pgmq.send(queue_name, payload);
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN pgmq.send(queue_name, payload);
END;
$$;

CREATE OR REPLACE FUNCTION public.read_email_batch(queue_name text, batch_size integer, vt integer)
RETURNS TABLE(msg_id bigint, read_ct integer, message jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY SELECT r.msg_id, r.read_ct, r.message FROM pgmq.read(queue_name, vt, batch_size) r;
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_email(queue_name text, message_id bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN pgmq.delete(queue_name, message_id);
EXCEPTION WHEN undefined_table THEN
  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE new_id BIGINT;
BEGIN
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  PERFORM pgmq.delete(source_queue, message_id);
  RETURN new_id;
EXCEPTION WHEN undefined_table THEN
  BEGIN
    PERFORM pgmq.create(dlq_name);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  BEGIN
    PERFORM pgmq.delete(source_queue, message_id);
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;
  RETURN new_id;
END;
$$;
