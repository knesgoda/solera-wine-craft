
-- 1. Create referral_status enum
CREATE TYPE public.referral_status AS ENUM ('pending', 'signed_up', 'converted');

-- 2. Create referrals table
CREATE TABLE public.referrals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  referral_code TEXT NOT NULL,
  status public.referral_status NOT NULL DEFAULT 'pending',
  credit_days_earned INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  converted_at TIMESTAMPTZ
);

-- 3. Enable RLS
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- 4. RLS: users can read their own rows
CREATE POLICY "Users can view own referrals"
  ON public.referrals FOR SELECT TO authenticated
  USING (auth.uid() = referrer_user_id OR auth.uid() = referred_user_id);

-- 5. RLS: authenticated users can insert referrals (for signup flow)
CREATE POLICY "Authenticated users can create referrals"
  ON public.referrals FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = referred_user_id);

-- 6. Add referral_code to profiles
ALTER TABLE public.profiles ADD COLUMN referral_code TEXT UNIQUE;

-- 7. Update handle_new_user to generate referral code
CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  new_org_id UUID;
  new_referral_code TEXT;
BEGIN
  -- Create the organization using winery_name from metadata
  INSERT INTO public.organizations (name)
  VALUES (COALESCE(NEW.raw_user_meta_data->>'winery_name', 'My Winery'))
  RETURNING id INTO new_org_id;

  -- Generate unique 8-char referral code
  LOOP
    new_referral_code := substr(md5(gen_random_uuid()::text), 1, 8);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = new_referral_code);
  END LOOP;

  -- Create the profile linked to the new org
  INSERT INTO public.profiles (id, email, first_name, last_name, org_id, referral_code)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    new_org_id,
    new_referral_code
  );

  -- Assign owner role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'owner');

  RETURN NEW;
END;
$function$;

-- 8. Index for fast lookups
CREATE INDEX idx_referrals_referred_user_status ON public.referrals (referred_user_id, status);
CREATE INDEX idx_referrals_referrer_user ON public.referrals (referrer_user_id);
CREATE INDEX idx_referrals_referral_code ON public.referrals (referral_code);
