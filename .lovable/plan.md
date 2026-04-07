

# Expand Data Import Field Mappings

## Problem
The current import system only supports a limited set of target fields. The uploaded CSVs from a real winery contain many fields that cannot be mapped — blocks are missing vineyard/elevation/irrigation/notes, vessels are missing status/location/type/notes, tasks are missing priority/category/notes, and there's no support for vineyards as a target table at all.

## What Changes

### 1. Add missing columns to database tables via migrations

Several CSV fields map to real winery concepts but the database columns don't exist yet:

**`blocks` table** — add: `row_spacing_ft`, `vine_spacing_ft`, `year_planted`, `exposure`, `elevation_ft`, `irrigation`, `notes`

**`fermentation_vessels` table** — add: `vessel_type`, `status`, `location`, `capacity_gallons` (to support US-unit imports alongside `capacity_liters`)

**`vineyards` table** — add: `notes` (currently has name, coordinates, acres, region)

### 2. Expand `targetOptions` in MappingReview.tsx

Add all new fields and tables:

```text
vineyards:  [name, region, acres, notes]
blocks:     + row_spacing_ft, vine_spacing_ft, year_planted, exposure, elevation_ft, irrigation, notes, drainage
fermentation_vessels: + vessel_type, status, location, capacity_gallons, notes, temp_controlled
tasks:      [title, due_date, status, instructions]  (new target table)
lab_samples: (no changes needed — existing fields cover the CSV)
vintages:   + gallons, cases_projected, pick_date, press_date, winemaker_notes
```

**Tasks** is already a table with: title, due_date, status, instructions. We add it as a mapping target.

**Vintages** gains additional lot-level fields for gallons, cases, pick/press dates, and winemaker notes (requires migration).

### 3. Update the `suggest-mapping` edge function

Mirror the same expanded `soleraFields` object so the AI can suggest mappings to the new fields.

### 4. Update the `run-import` edge function

Add `tasks`, `vineyards` to the `tablesWithOrg` list so `org_id` is injected on insert. Add numeric field casts for the new numeric columns.

## Files Changed

| File | Change |
|------|--------|
| Migration (new) | Add columns to `blocks`, `fermentation_vessels`, `vineyards`, `vintages` |
| `src/components/import/MappingReview.tsx` | Expand `targetOptions` with new tables and fields |
| `supabase/functions/suggest-mapping/index.ts` | Update `soleraFields` to match |
| `supabase/functions/run-import/index.ts` | Add new tables to `tablesWithOrg`, add new numeric fields |

## Technical Notes
- Capacity: vessels CSV uses gallons; we add `capacity_gallons` column rather than forcing unit conversion at import time. The UI can display either.
- Wine lots map to the existing `vintages` table (each lot = a vintage record).
- Harvest predictions are read-only analytical data — not a core import target. Can be added later if needed.
- All new columns are nullable with no defaults, so existing data is unaffected.

