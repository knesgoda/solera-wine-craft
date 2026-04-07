
Goal: stop `pick_windows` CSVs from ever trying to insert into `blocks`, which is what triggers the `vineyard_id is required` error.

What I found
- Your uploaded file is a clean `pick_windows` file with headers like `window_id`, `block_id`, `window_open_date`, `window_close_date`.
- The current repo already contains the earlier harvest-table fix:
  - `suggest-mapping` has `pick_windows.block_id -> pick_windows._block_ref`
  - global `block_id -> blocks.external_block_id` fallback is disabled once a file type is detected
  - `run-import` resolves harvest `block_id` values into real block UUIDs
  - the mapping UI already exposes `pick_windows.block_id`
- So the remaining failure is most likely this: a `blocks.*` mapping is still reaching `run-import` at runtime, and `run-import` currently inserts every mapped table it sees. If even one column is still mapped to `blocks`, it attempts a `blocks` insert and fails because this file has no vineyard column.

Implementation plan

1. Harden `run-import` so stale/wrong mappings cannot create orphan `blocks` rows
- In `supabase/functions/run-import/index.ts`, add a pre-processing step before table inserts:
  - infer the row’s primary import target from mappings
  - if the file is a harvest table (`pick_windows`, `harvest_predictions`, `harvest_progress`), strip accidental `blocks` payloads unless the row truly contains block-creation data like `vineyard`, `vineyard_name`, or `vineyard_id`
- Add a fallback rewrite:
  - if `block_id` was mapped to `blocks.external_block_id` by mistake, reinterpret it as the harvest table’s block reference and resolve it normally
  - if `block_name` was mapped to `blocks.name`, reinterpret it as the harvest table’s readable block reference

2. Add a second safety net in `suggest-mapping`
- In `supabase/functions/suggest-mapping/index.ts`, keep current deterministic detection, but add a final normalization pass:
  - when the detected file type is `pick_windows`, `harvest_predictions`, or `harvest_progress`, remap any accidental `blocks.*` result for `block_id` / `block_name` back into the harvest table before returning mappings
- Add lightweight logging of:
  - detected file type
  - final target tables in the mapping response
- This will make future import debugging much easier.

3. Make the UI catch this exact bad state early
- In `src/components/import/MappingReview.tsx`, add a specific validation rule:
  - if mappings contain a harvest table plus `blocks`, show a targeted warning that `block_id` is being routed into `blocks` instead of the harvest table
- Update the warning logic so this case is flagged even when only 2 tables are present
- Disable or block “Confirm Mapping” when the only `blocks` mapping is an invalid harvest spillover with no vineyard field.

4. Add a preview/preflight guard before import runs
- In `src/pages/DataImport.tsx` or `src/components/import/ImportPreview.tsx`, add a final validation before calling `run-import`:
  - if mappings imply a harvest import but also contain `blocks` rows without a vineyard reference, stop the import and send the user back to mapping review with a clear message
- This prevents batch imports that are guaranteed to fail row-by-row.

5. Expected result
- A `pick_windows` CSV like your uploaded file should map only to `pick_windows`
- `block_id` should resolve against existing blocks, not create new block rows
- The `blocks` vineyard warning should no longer appear for harvest/pick-window files
- Even if a stale or bad mapping somehow slips through, the importer will refuse to treat it as a block creation request

Files to update
- `supabase/functions/run-import/index.ts`
- `supabase/functions/suggest-mapping/index.ts`
- `src/components/import/MappingReview.tsx`
- `src/pages/DataImport.tsx` or `src/components/import/ImportPreview.tsx`

Database changes
- No migration needed
