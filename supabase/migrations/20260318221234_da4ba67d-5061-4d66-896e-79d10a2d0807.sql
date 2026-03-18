CREATE POLICY "Users can always view their own profile"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());