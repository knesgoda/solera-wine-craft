
Goal: fix the remaining import failures by aligning the database, mapping engine, and importer around the actual CSV shapes now failing.

What’s actually broken now
- grower_contracts fails because `clone` is being mapped, but `grower_contracts` still does not have `clone` (and likely also lacks `variety` / `rootstock`) in the database.
- blocks still fails because header aliases are global and not context-aware. A file can expose `vineyard`, but if mapping does not end up on `blocks.vineyard_name`, `run-import` still throws for missing `vineyard_id`.
- lab_samples still fails because the importer only succeeds when `vintage_name` or `lot_name` is mapped into `lab_samples`, but the current alias logic can send shared headers like `lot_name`, `block_name`, or `block_id` to the wrong table based on generic rules.

Implementation plan

1. Add the missing contract columns to the database
- Create a migration to add these nullable columns to `grower_contracts`:
  - `variety text`
  - `clone text`
  - `rootstock text`
- Keep the existing contract import fields already added.
- Do not change existing enums or required columns.

2. Make mapping file-type aware instead of global-first
- Refactor `suggest-mapping` so deterministic aliases are applied in the context of the detected file type first.
- Example behavior:
  - blocks file: `vineyard` -> `blocks.vineyard_name`
  - lab samples file: `lot_name` -> `lab_samples.lot_name`, `block_name` -> `lab_samples.block_name`, `block_id` -> lab-sample block linkage path
  - vintages file: `lot_name` -> `vintages.name`, `lot_id` -> `vintages.external_lot_id`
  - grower contracts file: `clone` -> `grower_contracts.clone`
- Keep fallback AI mapping, but only after contextual deterministic rules are applied.

3. Add stronger file signatures for the failing CSV types
- Expand file detection in `suggest-mapping` so these formats are classified reliably:
  - blocks
  - lab_samples
  - vintages / wine lots
  - grower_contracts
- Use combinations of headers rather than single shared names to avoid cross-table bleed.

4. Harden `run-import` for blocks imports
- Keep current vineyard auto-create logic.
- Add a pre-insert normalization layer so if a blocks row includes a likely vineyard source under alias variants, it is coerced into the vineyard resolution path before validation.
- Improve the thrown error so it includes the source column expectation when vineyard mapping is missing.

5. Improve `run-import` for lab samples
- Add a second resolution path:
  - if `block_name` or external `block_id` resolves to a block, attempt to derive the target vintage from that block when possible
  - if `lot_name` exists, prefer resolving vintage from `lot_name`
- Only fail after trying all three:
  - `vintage_name`
  - `lot_name`
  - block-based resolution
- Keep `block_id` storage on `lab_samples` for traceability.

6. Add import validation before execution
- In the preview/import flow, warn early when a file is about to fail:
  - blocks must map a vineyard reference
  - lab samples must map at least one vintage or block reference
  - grower contracts should not target fields missing from the schema
- This should block obvious bad runs before the edge function is called.

7. Make the mapping review clearer for users
- In `MappingReview`, group or highlight the likely detected destination table.
- Surface a warning when a file has mappings split across multiple unrelated tables unexpectedly.
- This is especially important for shared column names like `block_name`, `lot_name`, and `block_id`.

Files to update
- New migration in `supabase/migrations/`
- `supabase/functions/suggest-mapping/index.ts`
- `supabase/functions/run-import/index.ts`
- `src/components/import/MappingReview.tsx`
- `src/components/import/ImportPreview.tsx`
- `src/pages/DataImport.tsx`

Technical notes
- The current issue is no longer mainly schema cache refresh; it is schema mismatch plus context-insensitive mapping.
- Existing RLS for `blocks` and `lab_samples` appears compatible once the correct foreign keys are resolved.
- The most important fix is to stop reusing the same alias rules across unrelated file types.

Expected outcome
- grower contracts imports stop failing on `clone`
- blocks imports consistently resolve `vineyard_id`
- lab sample imports succeed when the file provides lot, vintage, or block context
- users get earlier warnings instead of learning about mapping mistakes only after a failed import
