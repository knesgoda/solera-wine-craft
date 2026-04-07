

# Expand Database Schema & Import Mappings for All Winery CSV Fields

## Problem
The new CSVs contain many fields that have no corresponding database column yet, causing imports to fail silently or drop data. Additionally, three new CSV types (grower contracts, harvest progress, pick windows) have no import target at all.

## Database Migrations Needed

### `vintages` table — add 5 columns
| Column | Type | Notes |
|--------|------|-------|
| `name` | text, nullable | Lot name (e.g. "2025 Pinot Noir Las Colinas") |
| `variety` | text, nullable | Grape variety |
| `clone` | text, nullable | Clone designation |
| `rootstock` | text, nullable | Rootstock |
| `fermentation_start` | date, nullable | Date fermentation began |
| `ml_complete` | date, nullable | Malolactic fermentation complete date |
| `bottling_target` | date, nullable | Target bottling date |

### `tasks` table — add 3 columns
| Column | Type | Notes |
|--------|------|-------|
| `category` | text, nullable | e.g. "Vineyard", "Fermentation", "Compliance" |
| `priority` | text, nullable | e.g. "High", "Medium", "Low" |
| `assigned_to_name` | text, nullable | Free-text assignee (CSV has names, not UUIDs) |

### `lab_samples` table — add 2 columns
| Column | Type | Notes |
|--------|------|-------|
| `sampled_by` | text, nullable | Who collected the sample |
| `gdd_cumulative` | numeric, nullable | Growing degree-days at sample time |

### `fermentation_vessels` table — add 1 column
| Column | Type | Notes |
|--------|------|-------|
| `current_fill_gal` | numeric, nullable | Current fill level in gallons |

## UI & Edge Function Updates

### `MappingReview.tsx` — expand `targetOptions`
- **vintages**: add `variety`, `clone`, `rootstock`, `fermentation_start`, `ml_complete`, `bottling_target`
- **tasks**: add `category`, `priority`, `assigned_to_name`
- **lab_samples**: add `sampled_by`, `gdd_cumulative`, `block_name` (pseudo-field for block resolution)
- **fermentation_vessels**: add `current_fill_gal`

### `suggest-mapping/index.ts` — mirror the same expanded fields in `soleraFields`

### `run-import/index.ts`
- Add `block_name` pseudo-field resolution for lab_samples (look up block → get vintage from block)
- Add new numeric fields to the cast list: `gdd_cumulative`, `current_fill_gal`
- Normalize `priority` values to lowercase

## Files Changed

| File | Change |
|------|--------|
| Migration (new) | Add columns to `vintages`, `tasks`, `lab_samples`, `fermentation_vessels` |
| `src/components/import/MappingReview.tsx` | Add new fields to `targetOptions` |
| `supabase/functions/suggest-mapping/index.ts` | Mirror new fields in `soleraFields` |
| `supabase/functions/run-import/index.ts` | Add numeric casts, block_name resolution for lab_samples |

## Steps
1. Run database migration adding all missing columns
2. Update MappingReview targetOptions with new fields
3. Update suggest-mapping soleraFields to match
4. Update run-import with new numeric casts and block_name resolution
5. Redeploy both edge functions

