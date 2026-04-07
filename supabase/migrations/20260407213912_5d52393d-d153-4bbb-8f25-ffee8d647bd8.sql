
-- blocks: add vineyard-detail columns
ALTER TABLE public.blocks
  ADD COLUMN IF NOT EXISTS row_spacing_ft NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS vine_spacing_ft NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS year_planted INTEGER,
  ADD COLUMN IF NOT EXISTS exposure TEXT,
  ADD COLUMN IF NOT EXISTS elevation_ft NUMERIC(8,1),
  ADD COLUMN IF NOT EXISTS irrigation TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- fermentation_vessels: add vessel detail columns
ALTER TABLE public.fermentation_vessels
  ADD COLUMN IF NOT EXISTS vessel_type TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'available',
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS capacity_gallons NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS temp_controlled BOOLEAN DEFAULT false;

-- vineyards: add notes
ALTER TABLE public.vineyards
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- vintages: add lot-level fields
ALTER TABLE public.vintages
  ADD COLUMN IF NOT EXISTS gallons NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS cases_projected INTEGER,
  ADD COLUMN IF NOT EXISTS pick_date DATE,
  ADD COLUMN IF NOT EXISTS press_date DATE,
  ADD COLUMN IF NOT EXISTS winemaker_notes TEXT;
