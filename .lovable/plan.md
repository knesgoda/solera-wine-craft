

# Fix: Import Failures for All CSV Files

## Root Cause Analysis

Five imports were attempted; only vessels succeeded (17 rows). The other four failed due to these distinct issues:

| CSV File | Error | Root Cause |
|----------|-------|------------|
| Blocks | `vineyard_id NOT NULL violation` | `blocks.vineyard_id` is required but the CSV has no vineyard UUID — only a vineyard name. The import function doesn't look up or create vineyard records. |
| Tasks | `invalid enum value: "Completed"` | CSV uses "Completed", "In Progress", "Scheduled" but the `task_status` enum only has `pending`, `in_progress`, `complete`. |
| Wine Lots → Vintages | `invalid enum value: "Active Fermentation"` | CSV uses descriptive statuses ("Active Fermentation", "Barrel Aging", "Waiting Fruit") but `vintage_status` enum only has `planned`, `in_progress`, `harvested`, `in_cellar`, `bottled`, `released`. |
| Blocks (secondary) | `'notes' not in schema cache` | The edge function's Supabase client doesn't see newly added columns until redeployed with a fresh connection — likely a stale PostgREST cache issue. |
| Lab Samples | Not attempted yet | Likely would also fail due to missing `vintage_id` (NOT NULL). |

## Fix Plan

### 1. Add enum value normalization to `run-import` edge function

Add a normalization step in the import loop that lowercases and maps human-readable status values to valid enum values before inserting:

```text
Task status mapping:
  "Completed" / "Done"       → "complete"
  "In Progress" / "Active"   → "in_progress"
  "Scheduled" / "Pending"/ "Todo" → "pending"

Vintage status mapping:
  "Active Fermentation" / "Fermenting"  → "in_progress"
  "Barrel Aging" / "Aging*"             → "in_cellar"
  "Waiting Fruit" / "Pre-harvest"       → "planned"
  "Press & Settle"                      → "in_progress"
  "Bottled"                             → "bottled"
  "Released"                            → "released"
```

### 2. Add vineyard lookup/create logic for blocks import

When importing blocks, if the CSV contains a vineyard name (mapped to a field like `vineyard_name`) but no `vineyard_id`:
- Look up an existing vineyard by name + org_id
- If not found, create it automatically
- Set `vineyard_id` on the block row before inserting

### 3. Add vintage lookup/create logic for lab_samples import

Similar to blocks: lab samples require a `vintage_id`. The import function should resolve a vintage by name or lot_id, or create one if needed.

### 4. Redeploy edge function to clear schema cache

The `notes` column on `blocks` exists in the DB but the PostgREST schema cache hasn't refreshed. Redeploying the function will use a fresh client that picks up the new columns.

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/run-import/index.ts` | Add enum normalization maps, vineyard lookup/create for blocks, vintage lookup/create for lab_samples |

## Steps
1. Add enum normalization maps (task_status, vintage_status) to run-import
2. Add vineyard resolution logic (lookup by name, auto-create if missing) for blocks import
3. Add vintage resolution logic for lab_samples import
4. Redeploy the edge function (clears PostgREST schema cache)

