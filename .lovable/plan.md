
## What I found

The current import failures are not just “one more missing field” issue. The logs show 5 separate problems happening at once:

1. **Wrong auto-mapping for whole file types**
   - `harvest_progress`, `harvest_predictions`, `pick_windows`, and `grower_contracts` CSVs are being mapped into existing tables like `blocks` and `vintages` because there are no proper import targets for them.
   - That is why those imports keep failing with `blocks: vineyard_id is required`.

2. **Blocks CSV alias mismatch**
   - Your blocks file uses the header `vineyard`, but the importer only knows how to resolve `blocks.vineyard_name`.
   - So the block rows never get a `vineyard_id`.

3. **Vintage status normalization is incomplete**
   - The importer handles `Barrel Aging` but not values like:
     - `Active — Barrel Aging`
     - `Active — Fermenting`
     - `Active — Settling`
     - `Active — Awaiting Fruit`
     - `Active — Aging`
     - `Aging — Concrete Egg`
   - Those are the exact values currently failing in the logs.

4. **Duplicate detection for vintages is wrong**
   - Right now duplicates are detected by **year only**.
   - That means multiple 2025 lots are treated as the same record, which is incorrect for winery lots.

5. **The success/failure summary is misleading**
   - A row that errors is also being counted as skipped in some paths.
   - That is why you’re seeing results like `Imported 0 / Skipped 8 / Errors 8` for an 8-row file.

## Updated plan

### 1. Expand the database so every uploaded CSV has a real home

Add missing columns to existing operational tables so imported source identifiers and relationships can be preserved:

- **`blocks`**
  - add `external_block_id`
- **`vintages`**
  - add `external_vintage_id`
  - add `external_lot_id`
- **`fermentation_vessels`**
  - add `external_vessel_id`
- **`tasks`**
  - add `external_task_id`
  - add `source_reference`
- **`lab_samples`**
  - add `external_sample_id`
  - add `block_id` so vineyard/block sampling can be stored directly
- **`grower_contracts`**
  - add `approval_status`
  - add `payment_status`
  - add `payment_due_date`
  - add `contract_type`
  - add `source_vineyard_name`
  - add `ava`
  - add `external_contract_id`

Create dedicated tables for the three CSV types that currently have nowhere valid to import:

- **`harvest_progress`**
- **`harvest_predictions`**
- **`pick_windows`**

Each should include:
- `org_id`
- external/source id from the CSV
- block linkage (`block_id` or resolved block UUID)
- all source columns from the uploaded files
- timestamps / created_at

Also add org-scoped RLS policies matching the rest of the app.

### 2. Make mapping deterministic for known winery CSV formats

Update `suggest-mapping` so it does not rely only on free-form AI guesses.

Add header aliases and file-shape rules such as:
- `vineyard` → `blocks.vineyard_name`
- `lot_name` → `vintages.name`
- `vintage_id` → `vintages.external_vintage_id`
- `lot_id` → `vintages.external_lot_id`
- `block_id` → `blocks.external_block_id` or `lab_samples/block link`
- `sample_id` → `lab_samples.external_sample_id`
- `contract_id` → `grower_contracts.contract_number` or `external_contract_id`
- `vessel_id` → `fermentation_vessels.external_vessel_id`

Add explicit target groups for:
- `grower_contracts`
- `harvest_progress`
- `harvest_predictions`
- `pick_windows`

This prevents those files from being misrouted into `blocks` or `vintages`.

### 3. Fix importer resolution logic

Update `run-import` to support real winery relationships:

- **Blocks**
  - accept both `vineyard_name` and `vineyard`
  - auto-create / resolve vineyard by name
- **Vintages**
  - resolve `block_id` from imported external block id
  - stop duplicate detection by year only
  - detect duplicates by stronger keys:
    - external IDs first
    - otherwise `org_id + year + name`
- **Lab samples**
  - resolve by `block_id` / `block_name`
  - if no matching vintage exists yet, create or resolve the correct lot for that block/year
- **Grower contracts**
  - resolve or create grower from `grower_name`
  - map `price_per_ton` to `base_price_per_unit`
  - set `pricing_unit = per_ton`
- **Tasks**
  - store free-text assignee in `assigned_to_name`
  - optionally resolve `block_vessel` into `block_id` later when it is a clean single block reference

### 4. Expand status normalization

Add normalization for the status values actually seen in your files:

```text
Vintages:
"Active — Fermenting"     -> in_progress
"Active — Settling"       -> in_progress
"Active — Awaiting Fruit" -> planned
"Active — Barrel Aging"   -> in_cellar
"Active — Aging"          -> in_cellar
"Aging — Concrete Egg"    -> in_cellar
"Barrel Aging"            -> in_cellar
"Press & Settle"          -> in_progress
"Waiting Fruit"           -> planned
```

Also normalize em dash / en dash / hyphen variants before matching.

### 5. Add pre-import validation and clearer error reporting

Before running import:
- block imports must have either `vineyard_name`/`vineyard` or `vineyard_id`
- lab samples must have a date plus a block/lot/vintage reference
- prevent two source columns mapping to the same target field unless user overrides it intentionally

Improve UI feedback:
- show top error messages from `import_errors`
- distinguish **skipped** from **failed**
- fix row accounting so one row cannot count as both

## Files to update

- new migration(s) for schema additions and new tables
- `src/components/import/MappingReview.tsx`
- `src/components/import/ImportPreview.tsx`
- `src/components/import/ImportReport.tsx`
- `src/pages/DataImport.tsx`
- `supabase/functions/suggest-mapping/index.ts`
- `supabase/functions/run-import/index.ts`

## Technical notes

- The React ref warning in `MappingReview` is real but **not** the reason the imports are failing.
- The biggest functional bug is that several CSVs still have no real target table, so the AI is inventing mappings into unrelated tables.
- The biggest data-integrity bug is vintage duplicate detection by `year` only.
- Once implemented, the same uploaded files should import into:
  - core operational tables where appropriate
  - dedicated raw/analytical tables for harvest progress, predictions, and pick windows
  - with preserved external IDs for re-imports and merge/replace behavior
