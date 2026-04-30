-- Widen ai_conversations SELECT policy from user_id scope to org_id scope.
-- This allows winery owners to view all conversations within their org
-- (e.g. for AI usage reporting) while still enforcing org isolation.

DROP POLICY IF EXISTS "Users can view their own conversations" ON public.ai_conversations;

CREATE POLICY "Org members can view their org conversations"
ON public.ai_conversations FOR SELECT
TO authenticated
USING (
  org_id IN (
    SELECT org_id FROM public.profiles WHERE id = auth.uid()
  )
);

-- Apply the same fix to ai_messages: scope to org via conversation's org_id
-- rather than requiring the conversation to belong to the exact user.

DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.ai_messages;

CREATE POLICY "Org members can view messages in their org conversations"
ON public.ai_messages FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.ai_conversations c
    WHERE c.id = conversation_id
      AND c.org_id IN (
        SELECT org_id FROM public.profiles WHERE id = auth.uid()
      )
  )
);
