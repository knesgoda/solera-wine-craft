
-- QuickBooks config table
CREATE TABLE public.quickbooks_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE UNIQUE,
  realm_id text,
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expiry timestamptz,
  company_name text,
  last_synced_at timestamptz,
  active boolean NOT NULL DEFAULT false,
  sync_invoices boolean NOT NULL DEFAULT false,
  sync_expenses boolean NOT NULL DEFAULT false,
  sync_inventory_value boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.quickbooks_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on quickbooks_config" ON public.quickbooks_config FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Users can view quickbooks_config in their org" ON public.quickbooks_config FOR SELECT USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can insert quickbooks_config in their org" ON public.quickbooks_config FOR INSERT TO authenticated WITH CHECK (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can update quickbooks_config in their org" ON public.quickbooks_config FOR UPDATE USING (org_id = get_user_org_id(auth.uid()));
CREATE POLICY "Users can delete quickbooks_config in their org" ON public.quickbooks_config FOR DELETE USING (org_id = get_user_org_id(auth.uid()));

-- Add quickbooks_invoice_id to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS quickbooks_invoice_id text;

-- Add cost_per_unit to ttb_additions
ALTER TABLE public.ttb_additions ADD COLUMN IF NOT EXISTS cost_per_unit numeric;

-- Add quickbooks_expense_id to ttb_additions
ALTER TABLE public.ttb_additions ADD COLUMN IF NOT EXISTS quickbooks_expense_id text;
