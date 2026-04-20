-- P1: Allow client users to SELECT their own documents in client-documents bucket
CREATE POLICY "Client users can read own documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'client-documents'
  AND (storage.foldername(name))[1] = public.get_client_org_id_for_user(auth.uid())::text
);

-- P2: Trigger to prevent client users from modifying their own role
CREATE OR REPLACE FUNCTION public.protect_client_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- If the role is being changed AND the caller IS the client user themselves, revert
  IF NEW.role IS DISTINCT FROM OLD.role
     AND OLD.auth_user_id IS NOT NULL
     AND auth.uid() = OLD.auth_user_id THEN
    NEW.role := OLD.role;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_client_user_role_trigger ON public.client_users;
CREATE TRIGGER protect_client_user_role_trigger
BEFORE UPDATE ON public.client_users
FOR EACH ROW
EXECUTE FUNCTION public.protect_client_user_role();