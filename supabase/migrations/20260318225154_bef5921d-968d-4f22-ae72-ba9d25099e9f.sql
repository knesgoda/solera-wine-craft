ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'none';

CREATE INDEX IF NOT EXISTS idx_organizations_stripe_customer_id
  ON public.organizations (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;