# Field Expansion: 7 Modules with HelpTooltips

Extend forms and detail views across Cellar, Lab/Vintage, TTB, Custom Crush, Vineyard, and Tasks. Add ~30 new labeled inputs (each with a HelpTooltip), wire them to the database, and surface them in detail views. Reuse the existing `HelpTooltip` component — do not modify it.

## Schema reality check (from live DB)

Some columns the brief asks for already exist. Plan respects what's actually there:

- `blocks` — already has `row_spacing_ft`, `vine_spacing_ft`, `year_planted`. Only `row_orientation` is missing.
- `tasks` — already has `category` and `priority`. Need `task_type`, `assigned_to_user_id`. (Reuse `category` for visual badge; add `task_type` as a new finer-grained field per spec.)
- `fermentation_vessels` — already has `vessel_type`, `status`, `current_fill_gal`, `capacity_gallons`. Missing: `oak_type`, `toast_level`, `barrel_age_fills`, `fill_level_pct`.
- `fermentation_logs` — has `temp_f`, `brix`. Missing: `cap_management`.
- `vintages` — has `fermentation_start`, `ml_complete` (bool). Missing: `target_brix`, `target_ph`, `mlf_status`, `yeast_strain`, `inoculation_date`, plus Part 5 custom-crush fields.
- `lab_samples` — Missing: `sample_source`, `malic_acid`.
- `ttb_bond_info` — already has `bond_number`. No `ttb_settings` or `ow1_reports` table — both will be created.
- **No `lots` or `client_lots` table** — Custom Crush is modeled as `vintages` with `client_org_id`. Part 5 fields go on `vintages`.

## Part 1 — Cellar: NewVesselDialog

File: `src/components/cellar/NewVesselDialog.tsx`, `src/pages/cellar/VesselDetail.tsx`

Add to dialog: Vessel Type select (required, before Capacity), Vessel Status select (after type, default `empty_clean`), Fill Level % (after capacity), and a barrel-only conditional block (Oak Type, Toast Level, Barrel Age) shown only when type is `barrel`.

Migration: add `oak_type text`, `toast_level text`, `barrel_age_fills integer DEFAULT 0 CHECK >= 0`, `fill_level_pct integer DEFAULT 0 CHECK 0..100`. Reuse existing `vessel_type` and `status`.

Display new fields in `VesselDetail` via the existing InfoRow pattern; barrel fields gated on `vessel_type === 'barrel'`.

## Part 2 — Cellar: Fermentation log + ferment start fields

Find the fermentation log entry surface in `VesselDetail.tsx` (or sibling). Add `cap_management` select to the per-log form. Brix and Temp already exist — just ensure both are labeled with HelpTooltip.

Add `yeast_strain` (text) and `inoculation_date` (date) to `NewVintageDialog` and the vintage edit surface in `VintageDetail`. Migration adds `cap_management text` on `fermentation_logs` and `yeast_strain text`, `inoculation_date date` on `vintages`.

History view (existing fermentation log table) shows `cap_management` as a new column.

## Part 3 — Vintage & Lab

Files: `src/components/vintages/NewLabSampleDialog.tsx`, `src/components/vintages/NewVintageDialog.tsx`, `src/pages/vintages/VintageDetail.tsx`.

NewLabSampleDialog: add `sample_source` select and `malic_acid` numeric.

VintageDetail (and NewVintageDialog where appropriate): add `target_brix`, `target_ph`, `fermentation_start_date`, `mlf_status` select. Note: existing `fermentation_start` (timestamp) is kept for backward compatibility; new `fermentation_start_date` is a date-only convenience field per spec. Existing `ml_complete` boolean is preserved; the new `mlf_status` enum string is independent.

Migration: lab_samples gets `sample_source text`, `malic_acid numeric`. Vintages gets `target_brix numeric`, `target_ph numeric`, `fermentation_start_date date`, `mlf_status text`.

Display all new fields in the vintage detail read-only section.

## Part 4 — TTB OW-1 Form

Build a new "OW-1 Reports" surface inside the existing TTB module (`src/pages/compliance/ComplianceReports.tsx` is the host).

Bond Number stays on existing `ttb_bond_info` (already present) — surface as a banner/link if missing.

New table `ow1_reports` with columns per spec, including the generated `wine_on_hand_ending` stored column and unique `(org_id, reporting_month, reporting_year)`. RLS: org-scoped via `get_user_org_id(auth.uid())`.

UI: list of reports (month/year, status, ending balance), "New Report" dialog with Month, Year, the four numeric inputs and a live-calculated read-only Ending. Edit drafts; mark submitted.

## Part 5 — Custom Crush lot fields (on `vintages`)

Files: `src/pages/clients/ClientDetail.tsx`, `src/pages/vintages/VintageDetail.tsx` (since custom crush lots are vintages with `client_org_id`).

Add to the vintage edit/create surface for client lots: `grapes_received_tons`, `expected_yield_gallons` (with auto-suggest = tons * 150 placeholder), `contract_status` select (default `pending`), `coa_status` select (default `not_requested`).

Lot list view (`ClientDetail` lot tab + `ClientList` if applicable): color-coded badges per spec for both statuses.

Pending-contract guard: warning banner at top of `VintageDetail` when `contract_status = 'pending'` and the vintage has a `client_org_id`.

Migration adds the 4 columns to `vintages`.

## Part 6 — Vineyard BlockDetail

File: `src/pages/operations/BlockDetail.tsx`.

Edit dialog adds `row_orientation` select. Vine/Row spacing and Year Planted already in DB — surface inputs if not already present in the edit form.

InfoRow display section adds: Row Orientation, Vine Spacing (`X ft`), Row Spacing (`X ft`), Year Planted, GDD Accumulation (read-only from existing weather data / `lab_samples.gdd_cumulative` or weather hook), Estimated Harvest Date (from `useHarvestPrediction`). Each gets a tooltip. Null values render as nothing (existing InfoRow behavior).

Migration adds only `row_orientation text` to `blocks`.

## Part 7 — Tasks

File: `src/components/tasks/NewTaskDialog.tsx`, `src/pages/tasks/TaskList.tsx`, `src/pages/tasks/TaskDetail.tsx`.

NewTaskDialog adds: `task_type` select, `priority` select (default `normal`, column already exists), `assigned_to_user_id` select populated from `profiles WHERE org_id = current org`.

Migration adds `task_type text` and `assigned_to_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL` on `tasks`. Reuses existing `priority` column.

Task list cards: render `task_type` as a neutral badge and `priority` as a colored dot/border (gray/blue/orange/red).

## Final verification

After all parts:

1. `rg -c 'HelpTooltip content=' src/` summed across files — report total.
2. `rg -o 'content="[^"]{301,}"' src/` — report any over-length tooltip strings.
3. List every migration file created.
4. Confirm no new field added without a HelpTooltip.
5. Build/typecheck runs automatically; report any TS errors.
6. Manually verify barrel-only block in `NewVesselDialog` only renders when `vessel_type === 'barrel'`.

Output **FIELD EXPANSION COMPLETE** if all clean.

## Technical notes

- All new selects use shadcn `Select` already in the codebase.
- All RLS policies follow the existing org-scoped pattern with `get_user_org_id(auth.uid())` and `has_role`. New tables `ow1_reports` get standard 4-policy CRUD scoped to org.
- The generated column `wine_on_hand_ending numeric GENERATED ALWAYS AS (...) STORED` works in Postgres 12+ which Supabase runs.
- Migrations are idempotent (`ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`).
- Custom Crush lot model uses `vintages` with `client_org_id` — no new `client_lots` table is created (the brief assumes one exists; the codebase took a different path, and creating a parallel table would split the schema).
- Memory rule: no em dashes in user-facing copy. All tooltip strings supplied with em dashes will be normalized to en dashes or hyphens before insertion.
- Tailwind classes remain static utilities per project memory.
- No changes to `HelpTooltip.tsx` itself.

## Out of scope / explicit deviations from the brief

- No `client_lots` / `lots` table created — Part 5 fields land on `vintages` since that is how custom crush lots already work in this codebase.
- `ttb_settings` table not created — `ttb_bond_info` already stores bond number org-scoped; reusing it.
- `tasks.priority` column already exists; brief's "create migration adding priority" reduces to seeding the input control only.
- Fermentation `temp_f` and `brix` columns already exist; no schema change for those — only label + tooltip wiring.
- `vintages.fermentation_start` (timestamptz) is preserved alongside the new `fermentation_start_date` (date) per the brief's wording. If you'd prefer to consolidate, say so before approval and I'll drop the new column and reuse the old one.
