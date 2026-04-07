
Root cause
- The uploaded file is being detected correctly as `harvest_predictions` (the function log shows that), so file detection is not the problem.
- The real bug is in `supabase/functions/suggest-mapping/index.ts`:
  - `harvest_predictions` has no file-specific alias for `block_id`
  - `pick_windows` also has no file-specific alias for `block_id`
  - `harvest_progress` incorrectly maps `block_id` to `harvest_progress.block_name`
  - when a detected file is missing a file-specific alias, the mapper falls back to `GLOBAL_ALIASES`, where `block_id` maps to `blocks.external_block_id`
- That causes one harvest row to be split across two tables: the intended harvest table and `blocks`. The `blocks` insert then fails because your file does not include a vineyard reference, which is expected for a harvest predictions file.
- The mapping UI makes this harder to fix manually because `block_id` is not available as a target field for the harvest tables.

Plan
1. Fix harvest table aliases in `suggest-mapping`
- Add `block_id` aliases for:
  - `harvest_predictions.block_id`
  - `pick_windows.block_id`
- Correct `harvest_progress.block_id` so it maps to `harvest_progress.block_id`, not `block_name`
- Keep `block_name` mapped separately to the readable name field

2. Stop unrelated global alias fallback after file detection
- Change the mapping logic so that once a file type is detected, fallback aliases cannot silently map headers into unrelated tables like `blocks`
- This prevents the same class of bug for other shared headers in future imports

3. Make the manual mapping UI support the fix
- Add `block_id` as a selectable target field in `src/components/import/MappingReview.tsx` for:
  - `harvest_progress`
  - `harvest_predictions`
  - `pick_windows`
- This lets users correct a bad suggestion without being forced into `block_name`

4. Add importer hardening as a safety net
- In `supabase/functions/run-import/index.ts`, keep the current block resolution path but also add a raw-row fallback for harvest tables if `block_id` was not mapped correctly
- If a non-UUID `block_id` comes in, resolve it through `blocks.external_block_id` before insert

5. Expected result after implementation
- Your current CSV should map like this:
  - `prediction_id` → `harvest_predictions.external_prediction_id`
  - `block_id` → `harvest_predictions.block_id`
  - `block_name` → `harvest_predictions.block_name`
- The mapping screen should stop showing `blocks` as a detected target
- The vineyard warning should disappear
- Imports should write only to `harvest_predictions`, with block IDs resolved from existing blocks when possible

Files to update
- `supabase/functions/suggest-mapping/index.ts`
- `src/components/import/MappingReview.tsx`
- `supabase/functions/run-import/index.ts`

Database changes
- No migration needed; the current schema already supports this flow
