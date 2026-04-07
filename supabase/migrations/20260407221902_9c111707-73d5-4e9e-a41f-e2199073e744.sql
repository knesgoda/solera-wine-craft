
-- vintages: add columns for lot name, variety, clone, rootstock, and key dates
ALTER TABLE public.vintages ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.vintages ADD COLUMN IF NOT EXISTS variety text;
ALTER TABLE public.vintages ADD COLUMN IF NOT EXISTS clone text;
ALTER TABLE public.vintages ADD COLUMN IF NOT EXISTS rootstock text;
ALTER TABLE public.vintages ADD COLUMN IF NOT EXISTS fermentation_start date;
ALTER TABLE public.vintages ADD COLUMN IF NOT EXISTS ml_complete date;
ALTER TABLE public.vintages ADD COLUMN IF NOT EXISTS bottling_target date;

-- tasks: add category, priority, assigned_to_name
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS priority text;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS assigned_to_name text;

-- lab_samples: add sampled_by and gdd_cumulative
ALTER TABLE public.lab_samples ADD COLUMN IF NOT EXISTS sampled_by text;
ALTER TABLE public.lab_samples ADD COLUMN IF NOT EXISTS gdd_cumulative numeric;

-- fermentation_vessels: add current_fill_gal
ALTER TABLE public.fermentation_vessels ADD COLUMN IF NOT EXISTS current_fill_gal numeric;
