
-- Client organizations table
CREATE TABLE public.client_orgs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  contact_name text,
  contact_email text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.client_orgs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view client_orgs in their org" ON public.client_orgs FOR SELECT USING (parent_org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can insert client_orgs in their org" ON public.client_orgs FOR INSERT TO authenticated WITH CHECK (parent_org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can update client_orgs in their org" ON public.client_orgs FOR UPDATE USING (parent_org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can delete client_orgs in their org" ON public.client_orgs FOR DELETE USING (parent_org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Service role full access on client_orgs" ON public.client_orgs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Client users table
CREATE TABLE public.client_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid,
  client_org_id uuid NOT NULL REFERENCES public.client_orgs(id) ON DELETE CASCADE,
  email text NOT NULL,
  first_name text,
  last_name text,
  role text NOT NULL DEFAULT 'client',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.client_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Facility users can view client_users" ON public.client_users FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.client_orgs co WHERE co.id = client_org_id AND co.parent_org_id = get_user_org_id(auth.uid()))
);
CREATE POLICY "Facility users can insert client_users" ON public.client_users FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.client_orgs co WHERE co.id = client_org_id AND co.parent_org_id = get_user_org_id(auth.uid()))
);
CREATE POLICY "Facility users can update client_users" ON public.client_users FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.client_orgs co WHERE co.id = client_org_id AND co.parent_org_id = get_user_org_id(auth.uid()))
);
CREATE POLICY "Client users can view own record" ON public.client_users FOR SELECT USING (auth_user_id = auth.uid());
CREATE POLICY "Service role full access on client_users" ON public.client_users FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Client messages table
CREATE TABLE public.client_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_org_id uuid NOT NULL REFERENCES public.client_orgs(id) ON DELETE CASCADE,
  vintage_id uuid REFERENCES public.vintages(id) ON DELETE SET NULL,
  sender_type text NOT NULL DEFAULT 'facility',
  sender_id uuid,
  message text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.client_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Facility users can view messages in their org" ON public.client_messages FOR SELECT USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Facility users can insert messages" ON public.client_messages FOR INSERT TO authenticated WITH CHECK (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Facility users can update messages" ON public.client_messages FOR UPDATE USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Service role full access on client_messages" ON public.client_messages FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Client users can view/insert messages for their own client_org
CREATE OR REPLACE FUNCTION public.get_client_org_id_for_user(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT client_org_id FROM public.client_users WHERE auth_user_id = _user_id LIMIT 1
$$;

CREATE POLICY "Client users can view own messages" ON public.client_messages FOR SELECT USING (
  client_org_id = get_client_org_id_for_user(auth.uid())
);
CREATE POLICY "Client users can insert own messages" ON public.client_messages FOR INSERT TO authenticated WITH CHECK (
  client_org_id = get_client_org_id_for_user(auth.uid()) AND sender_type = 'client'
);
CREATE POLICY "Client users can update own messages" ON public.client_messages FOR UPDATE USING (
  client_org_id = get_client_org_id_for_user(auth.uid())
);

-- Client invite tokens
CREATE TABLE public.client_invite_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_org_id uuid NOT NULL REFERENCES public.client_orgs(id) ON DELETE CASCADE,
  email text NOT NULL,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '48 hours'),
  used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.client_invite_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Facility users can manage invites" ON public.client_invite_tokens FOR ALL USING (
  EXISTS (SELECT 1 FROM public.client_orgs co WHERE co.id = client_org_id AND co.parent_org_id = get_user_org_id(auth.uid()))
);
CREATE POLICY "Service role full access on client_invite_tokens" ON public.client_invite_tokens FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Anon can view invite tokens" ON public.client_invite_tokens FOR SELECT TO anon USING (true);

-- Update vintages FK: drop old FK to organizations, add to client_orgs
ALTER TABLE public.vintages DROP CONSTRAINT IF EXISTS vintages_client_org_id_fkey;
ALTER TABLE public.vintages ADD CONSTRAINT vintages_client_org_id_fkey FOREIGN KEY (client_org_id) REFERENCES public.client_orgs(id) ON DELETE SET NULL;

-- RLS for client users to view vintages scoped to their client_org
CREATE POLICY "Client users can view their vintages" ON public.vintages FOR SELECT USING (
  client_org_id IS NOT NULL AND client_org_id = get_client_org_id_for_user(auth.uid())
);

-- RLS for client users to view lab_samples for their vintages
CREATE POLICY "Client users can view their lab_samples" ON public.lab_samples FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.vintages v WHERE v.id = vintage_id AND v.client_org_id = get_client_org_id_for_user(auth.uid()))
);

-- RLS for client users to view ttb_additions for their vintages
CREATE POLICY "Client users can view their ttb_additions" ON public.ttb_additions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.vintages v WHERE v.id = vintage_id AND v.client_org_id = get_client_org_id_for_user(auth.uid()))
);

-- RLS for client users to view blending_trials for their vintages (finalized only)
CREATE POLICY "Client users can view their blending_trials" ON public.blending_trials FOR SELECT USING (
  finalized = true AND vintage_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.vintages v WHERE v.id = vintage_id AND v.client_org_id = get_client_org_id_for_user(auth.uid()))
);

-- RLS for client users to view barrels for their vintages
CREATE POLICY "Client users can view their barrels" ON public.barrels FOR SELECT USING (
  vintage_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.vintages v WHERE v.id = vintage_id AND v.client_org_id = get_client_org_id_for_user(auth.uid()))
);

-- Storage bucket for client documents
INSERT INTO storage.buckets (id, name, public) VALUES ('client-documents', 'client-documents', false) ON CONFLICT DO NOTHING;
CREATE POLICY "Facility users can manage client docs" ON storage.objects FOR ALL USING (bucket_id = 'client-documents' AND (auth.role() = 'authenticated'));
