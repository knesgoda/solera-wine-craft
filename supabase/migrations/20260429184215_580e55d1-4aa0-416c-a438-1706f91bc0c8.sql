-- Backfill missing lab sample block references from the parent vintage's block.
UPDATE public.lab_samples AS ls
SET block_id = v.block_id
FROM public.vintages AS v
JOIN public.blocks AS b ON b.id = v.block_id
WHERE ls.vintage_id = v.id
  AND ls.block_id IS NULL;

-- Stop the migration if any rows still cannot be resolved safely.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.lab_samples WHERE block_id IS NULL) THEN
    RAISE EXCEPTION 'Cannot set lab_samples.block_id NOT NULL: unresolved lab_samples rows remain without a parent vintage block';
  END IF;
END;
$$;

-- Ensure every lab sample has a block.
ALTER TABLE public.lab_samples
  ALTER COLUMN block_id SET NOT NULL;

-- Add the block foreign key if it is not already present.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'lab_samples_block_id_fkey'
      AND conrelid = 'public.lab_samples'::regclass
  ) THEN
    ALTER TABLE public.lab_samples
      ADD CONSTRAINT lab_samples_block_id_fkey
      FOREIGN KEY (block_id)
      REFERENCES public.blocks(id);
  END IF;
END;
$$;

-- Add indexes for block and vintage reporting by sample date.
CREATE INDEX IF NOT EXISTS idx_lab_samples_vintage_sampled_at_desc
  ON public.lab_samples (vintage_id, sampled_at DESC);

CREATE INDEX IF NOT EXISTS idx_lab_samples_block_sampled_at_desc
  ON public.lab_samples (block_id, sampled_at DESC);

-- Add updated_at tracking for offline sync and auditability.
ALTER TABLE public.lab_samples
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS update_lab_samples_updated_at ON public.lab_samples;
CREATE TRIGGER update_lab_samples_updated_at
  BEFORE UPDATE ON public.lab_samples
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();