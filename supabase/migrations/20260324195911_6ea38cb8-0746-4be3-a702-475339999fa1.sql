
-- Change contract_block_assignments.block_id from ON DELETE CASCADE to ON DELETE SET NULL
-- First make block_id nullable, then change the FK constraint
ALTER TABLE public.contract_block_assignments ALTER COLUMN block_id DROP NOT NULL;

ALTER TABLE public.contract_block_assignments 
  DROP CONSTRAINT IF EXISTS contract_block_assignments_block_id_fkey;

ALTER TABLE public.contract_block_assignments
  ADD CONSTRAINT contract_block_assignments_block_id_fkey
  FOREIGN KEY (block_id) REFERENCES public.blocks(id) ON DELETE SET NULL;
