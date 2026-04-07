
Goal: fix the remaining lab import failures by making lab block references resolve correctly before `vintage_id` is required.

What I found
- `suggest-mapping` is correctly detecting the file as `lab_samples`.
- The main bug is in the alias map: for lab files, `block_id` is currently mapped to `lab_samples.block_name` instead of a block ID/external ID resolution path.
- In `run-import`, lab samples only try to derive `vintage_id` from:
  - `vintage_name`
  - `lot_name`
  - `block_name` via `resolveBlock(...)`
- So when the CSV provides `block_id`, that value gets treated like a block name, the block lookup fails, and the row errors with `vintage_id is required`.
- The mapping UI warning logic also misses this case because it only treats `vintage_name`, `lot_name`, and `block_name` as valid lab references.

Implementation plan

1. Fix lab file mapping
- Update `supabase/functions/suggest-mapping/index.ts` so:
  - `block_id` in a lab file maps to a dedicated lab block reference field, not `lab_samples.block_name`
  - `block_name` continues to map to `lab_samples.block_name`
- Keep existing aliases for `sample_date`, `ta_g_l`, `va_g_l`, and `so2_free_ppm`.

2. Fix lab block resolution in the importer
- Update `supabase/functions/run-import/index.ts` so lab imports can resolve a block from either:
  - `block_id` as an external source ID (`blocks.external_block_id`)
  - `block_name` as a human-readable block name
- Only after resolving that block should the importer derive or create the matching vintage.
- Preserve the resolved UUID in `lab_samples.block_id`.

3. Improve vintage derivation for labs
- Keep the current fallback behavior, but make the order explicit:
  1. `vintage_id`
  2. `vintage_name`
  3. `lot_name`
  4. resolved block from external `block_id`
  5. resolved block from `block_name`
  6. auto-create vintage from the resolved block if needed
- This makes lab imports work even when the file does not include a direct lot/vintage column.

4. Tighten validation in the UI
- Update `src/components/import/MappingReview.tsx` so lab imports count `block_id` as a valid reference source.
- Show clearer warnings when a lab file has neither:
  - `vintage_name`
  - `lot_name`
  - `block_name`
  - `block_id`

5. Add a pre-import check
- Update the import flow so labs can be blocked early if there is no usable vintage/block reference mapped at all.
- This avoids running a full import that is guaranteed to fail row-by-row.

6. Harden block lookups
- In `run-import`, make block resolution org-scoped and support both exact external ID lookup and name lookup.
- This avoids false matches and makes lab imports reliable if multiple orgs or repeated block names exist.

Files to update
- `supabase/functions/suggest-mapping/index.ts`
- `supabase/functions/run-import/index.ts`
- `src/components/import/MappingReview.tsx`
- `src/pages/DataImport.tsx` or `src/components/import/ImportPreview.tsx` for the pre-run validation gate

Expected outcome
- Lab sample CSVs that include `block_id` will stop failing just because they lack `vintage_name`.
- The importer will resolve the block first, then derive or create the correct vintage as intended.
- Users will get an earlier warning only when the file truly lacks any usable lot/vintage/block reference.
