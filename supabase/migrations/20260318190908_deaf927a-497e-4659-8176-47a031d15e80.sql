
-- AI Conversations table
CREATE TABLE public.ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'New Conversation',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

-- AI Messages table
CREATE TABLE public.ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

-- Helper function to get conversation org_id
CREATE OR REPLACE FUNCTION public.get_conversation_org_id(_conversation_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT org_id FROM public.ai_conversations WHERE id = _conversation_id
$$;

-- RLS for ai_conversations
CREATE POLICY "Users can view their own conversations"
  ON public.ai_conversations FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert conversations in their org"
  ON public.ai_conversations FOR INSERT TO authenticated
  WITH CHECK (org_id = get_user_org_id(auth.uid()) AND user_id = auth.uid());

CREATE POLICY "Users can update their own conversations"
  ON public.ai_conversations FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own conversations"
  ON public.ai_conversations FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "Service role full access on ai_conversations"
  ON public.ai_conversations FOR ALL TO service_role USING (true) WITH CHECK (true);

-- RLS for ai_messages
CREATE POLICY "Users can view messages in their conversations"
  ON public.ai_messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.ai_conversations WHERE id = conversation_id AND user_id = auth.uid()));

CREATE POLICY "Users can insert messages in their conversations"
  ON public.ai_messages FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.ai_conversations WHERE id = conversation_id AND user_id = auth.uid()));

CREATE POLICY "Users can delete messages in their conversations"
  ON public.ai_messages FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.ai_conversations WHERE id = conversation_id AND user_id = auth.uid()));

CREATE POLICY "Service role full access on ai_messages"
  ON public.ai_messages FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_ai_conversations_updated_at
  BEFORE UPDATE ON public.ai_conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
