

# Fix Remaining Import Failures

## Root Causes Found

### 1. grower_contracts: `"completed"` is not a valid enum value
The `contract_status` enum has values: `draft`, `active`, `fulfilled`, `cancelled`, `expired`. The normalizer on line 337 maps `"completed"` and `"fulfilled"` → `"completed"`, but "completed" does not exist. The CSV also has `"Fulfilled"` which should stay as `"fulfilled"`, and `"Active"` which is fine.

**Fix**: Change the normalizer to map `"completed"` → `"fulfilled"` (since that's the actual enum value).

### 2. blocks: vineyard_name not reaching the importer
The suggest-mapping logs show blocks CSV was **not detected** in this latest upload session — it's missing from the logs entirely. The blocks file may have been uploaded in a batch where the mapping wasn't applied. However, the alias mapping itself is correct (`vineyard` → `blocks.vineyard_name`). The issue is that the blocks CSV also has `block_id` as an external ID field, and the suggest-mapping maps it as `blocks.external_block_id` — but the `blocks` table may not have this column yet.

Actually, looking more carefully: the blocks detection should work. But the `vineyard` column value is reaching run-import as `data.vineyard_name` — the resolution code on line 255 checks `data.vineyard_name || data.vineyard`. This should work. The likely issue is that **during the actual import**, the `vineyard` header isn't being mapped to `blocks.vineyard_name` by the user — perhaps the UI shows it unmapped or the user didn't confirm the mapping.

**More likely root cause**: The `blocks` table doesn't have `external_block_id` column, so the insert fails on that column before even checking vineyard. But wait — the migration should have added it. Let me verify.

Actually, the clearest fix is to add a **fallback in run-import** that also checks for the raw `vineyard` key in the data object (in case the mapping sends it as `vineyard` instead of `vineyard_name`), and to also handle cases where unmapped columns like `sample_date` (should be `sampled_at`) and `ta_g_l` (should be `ta`) are present.

### 3. lab_samples: vintage_id resolution fails
The lab CSV has `block_id` and `block_name` but no `vintage_name` or `lot_name`. The block resolution tries to find the block by name, then derive a vintage from it. But:
- `block_name` resolution uses `ilike` on `blocks.name` — this should work IF blocks were imported first
- `deriveVintageFromBlock` just grabs the latest vintage by year — it works but only if vintages exist
- The CSV has `sample_date` (not `sampled_at`) which is unmapped, and `ta_g_l` / `va_g_l` / `so2_free_ppm` which don't match the alias names `ta` / `va` / `so2_free`

**Fix**: Add more lab sample header aliases for the actual CSV column names.

### 4. pick_windows detected as harvest_predictions
The pick_windows CSV is being misclassified because `harvest_predictions` signature matches first (both have `current_brix`, `brix_per_day`). The pick_windows signature needs higher priority or more specific detection.

**Fix**: Reorder FILE_SIGNATURES so pick_windows is checked before harvest_predictions, and add `window_status` / `window_open_date` as distinguishing signatures.

## Changes

### Migration (new)
- Add `contract_status` enum value `completed` so both `completed` and `fulfilled` work — OR just fix the normalizer (cheaper, no enum change needed)

### `supabase/functions/run-import/index.ts`
1. Fix contract status normalizer: `"completed"` and `"fulfilled"` → `"fulfilled"` (the actual enum value)
2. Add lab_samples field aliases in the importer: map `sample_date` → `sampled_at`, `ta_g_l` → `ta`, `va_g_l` → `va`, `so2_free_ppm` → `so2_free`, `ybn` → ignore/skip
3. In blocks handler, also check for raw `vineyard` key as fallback for vineyard resolution
4. For lab_samples, if no vintage can be derived, auto-create a vintage from the block's variety + current year instead of failing

### `supabase/functions/suggest-mapping/index.ts`
1. Add lab_samples aliases: `sample_date` → `lab_samples.sampled_at`, `ta_g_l` → `lab_samples.ta`, `va_g_l` → `lab_samples.va`, `so2_free_ppm` → `lab_samples.so2_free`
2. Reorder FILE_SIGNATURES: move `pick_windows` before `harvest_predictions`
3. Add `contract_year` → `grower_contracts.vintage_year` alias

## Files to update
- `supabase/functions/run-import/index.ts`
- `supabase/functions/suggest-mapping/index.ts`

