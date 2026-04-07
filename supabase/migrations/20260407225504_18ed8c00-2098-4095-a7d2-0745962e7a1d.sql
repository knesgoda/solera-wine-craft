ALTER TABLE public.grower_contracts
ADD COLUMN IF NOT EXISTS variety text,
ADD COLUMN IF NOT EXISTS clone text,
ADD COLUMN IF NOT EXISTS rootstock text;