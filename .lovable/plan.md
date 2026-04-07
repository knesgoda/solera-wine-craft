

## Fix: Vessel CSV `vessel_name` and `capacity_gal` not mapping

**Root cause**: The CSV uses `vessel_name` and `capacity_gal`, but the alias map only has `name` and `capacity_gallons`. Since `vessel_name` is unmapped, the `name` column stays null, violating the not-null constraint.

**Changes**

### 1. `supabase/functions/suggest-mapping/index.ts`
- Add aliases in the `fermentation_vessels` context map:
  - `vessel_name` → `fermentation_vessels.name`
  - `capacity_gal` → `fermentation_vessels.capacity_gallons`
- Add `vessel_name` and `capacity_gal` to the file signature for `fermentation_vessels` so detection is stronger.

### 2. `supabase/functions/run-import/index.ts`
- Add a pre-insert normalization for vessels: if `data.name` is missing but `data.vessel_name` exists in the raw row, use it.
- Similarly for `capacity_gal` → `capacity_gallons`.

**Files**: `supabase/functions/suggest-mapping/index.ts`, `supabase/functions/run-import/index.ts`

