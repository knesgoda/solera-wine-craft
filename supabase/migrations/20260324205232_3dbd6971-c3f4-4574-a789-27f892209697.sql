
-- Add qb_account_name column to cost_categories for QuickBooks mapping
ALTER TABLE public.cost_categories ADD COLUMN IF NOT EXISTS qb_account_name TEXT;

-- Set default QB mappings for existing system categories
UPDATE public.cost_categories SET qb_account_name = '5100 - Cost of Goods Sold' WHERE name = 'Grape Purchase' AND qb_account_name IS NULL;
UPDATE public.cost_categories SET qb_account_name = '5200 - Labor' WHERE name = 'Labor' AND qb_account_name IS NULL;
UPDATE public.cost_categories SET qb_account_name = '5300 - Supplies' WHERE name = 'Cooperage' AND qb_account_name IS NULL;
UPDATE public.cost_categories SET qb_account_name = '5400 - Chemicals' WHERE name = 'Chemicals' AND qb_account_name IS NULL;
UPDATE public.cost_categories SET qb_account_name = '5500 - Bottling' WHERE name = 'Bottling' AND qb_account_name IS NULL;
UPDATE public.cost_categories SET qb_account_name = '5600 - Overhead' WHERE name = 'Overhead' AND qb_account_name IS NULL;
UPDATE public.cost_categories SET qb_account_name = '5700 - Lab Analysis' WHERE name = 'Lab Analysis' AND qb_account_name IS NULL;
UPDATE public.cost_categories SET qb_account_name = '5800 - Freight' WHERE name = 'Freight' AND qb_account_name IS NULL;
UPDATE public.cost_categories SET qb_account_name = '5900 - Other COGS' WHERE name = 'Other' AND qb_account_name IS NULL;

-- Trigger to auto-void grape cost when weigh tag status changes from approved
CREATE OR REPLACE FUNCTION public.void_grape_cost_on_unapprove()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.status = 'approved' AND NEW.status != 'approved' THEN
    UPDATE public.cost_entries
    SET status = 'voided',
        voided_at = now(),
        void_reason = 'Weigh tag status changed to ' || NEW.status
    WHERE weigh_tag_id = NEW.id AND status = 'active';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_void_grape_cost_on_unapprove
AFTER UPDATE ON public.weigh_tags
FOR EACH ROW EXECUTE FUNCTION public.void_grape_cost_on_unapprove();
