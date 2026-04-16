

# Handwritten Notes Digitization — Implementation Plan

## Summary
Add a feature that lets users photograph handwritten lab notebook pages, extract structured winemaking data via Claude Vision, review/edit the results in a confidence-coded table, and import accepted rows into existing database tables.

## Adjustments from the PDF

The PDF references a `task_completions` table and `org_members` table — neither exists in this project. We will skip `task_completions` columns and use `profiles.org_id` for RLS instead of `org_members`. The PDF also calls for the Anthropic API directly; since `ANTHROPIC_API_KEY` is already configured as a secret, this is ready to go.

---

## Step 1 — Database & Storage

**Migration SQL:**

1. Add `import_source text` and `source_image_id uuid` columns to `lab_samples` and `fermentation_logs` (skip `task_completions` — table doesn't exist)

2. Create `handwritten_import_sessions` table:
   - `id`, `org_id` (FK organizations), `created_by` (FK auth.users), `created_at`, `page_count`, `rows_accepted`, `rows_rejected`, `storage_object_ids uuid[]`
   - RLS: org members can manage sessions where `org_id = get_user_org_id(auth.uid())`

3. Create private storage bucket `handwritten-imports` with org-scoped RLS (path starts with `org_id/`)

## Step 2 — Edge Function: `extract-handwritten-notes`

- New function at `supabase/functions/extract-handwritten-notes/index.ts`
- Accepts `imageBase64`, `mimeType`, `orgId`, `sessionId`
- Calls Anthropic Messages API with `claude-sonnet-4-20250514` and the winemaking extraction system prompt from the PDF
- Parses response JSON (strips markdown fences), returns structured array with per-field confidence scores
- Does NOT write to the database — extraction only

## Step 3 — Review Screen (`/import/handwritten`)

- New page component `src/pages/import/HandwrittenImport.tsx`
- **Desktop**: split panel — image viewer left, review table right
- **Mobile**: image collapsible at top, card-based rows below
- Image viewer with zoom (mouse wheel / pinch), re-upload button, page tabs for multi-page sessions
- Review table columns: Date, Block, Variety, Vintage, Brix, pH, TA, Temp, Vessel, Notes, Action
- **Confidence color coding**: ≥0.85 white, ≥0.70 yellow (#FFF9C4) with warning icon, <0.70 red (#FFEBEE) with alert icon
- All cells editable inline on click
- Row actions: Accept (checkmark), Edit (pencil), Reject (X — strikethrough)
- Bulk actions: "Accept All" (skips rows with red cells), "Reject All"
- Row count summary bar
- Destination selectors: Vintage dropdown and Block dropdown (fuzzy-matched from extraction)
- Submit button: inserts accepted rows into `lab_samples` / `fermentation_logs` with `import_source = 'handwritten_photo'` and `source_image_id`
- Updates the `handwritten_import_sessions` row with final counts

## Step 4 — Sidebar & Routing

- Add "Handwritten Notes" nav item under the "Data" group in `AppSidebar.tsx` with a Camera icon
- Add route `/import/handwritten` in `App.tsx`

## Step 5 — Mobile Quick-Capture on Lab Samples

- On `VintageDetail.tsx` lab samples section, add a camera icon button next to "+ New Sample"
- Tapping opens a bottom sheet (mobile) / modal (desktop) with:
  - "Take Photo" (camera capture input)
  - "Upload Image" (file picker: JPG, PNG, HEIC, PDF)
  - "Scan Multiple Pages" toggle (Pro+ gated)
- After capture: upload to `handwritten-imports` bucket, call edge function, navigate to `/import/handwritten` with session loaded

## Step 6 — Import History & Provenance

- Add "Import History" section in the Data Import page showing `handwritten_import_sessions` records
- Each entry: date, pages, accepted/rejected counts, user, "View Images" lightbox, "Re-process" button (Growth+ gated)
- In lab samples list views, show a camera icon badge on records where `import_source = 'handwritten_photo'`

## Step 7 — Tier Enforcement

| Feature | Tier |
|---|---|
| Single-page import | All (Hobbyist+) |
| Multi-page batch | Pro+ (`small_boutique`) |
| Re-process existing | Growth+ (`mid_size`) |

Use existing `useTierGate` hook and `TierGate` component pattern. Show upgrade prompts with pricing for gated features.

---

## Technical Details

- **Files created**: `src/pages/import/HandwrittenImport.tsx`, `src/components/import/HandwrittenReviewTable.tsx`, `src/components/import/QuickCaptureDialog.tsx`, `supabase/functions/extract-handwritten-notes/index.ts`
- **Files modified**: `src/App.tsx` (route), `src/components/AppSidebar.tsx` (nav item), `src/pages/vintages/VintageDetail.tsx` (camera button), `src/pages/DataImport.tsx` (import history section)
- **DB migration**: new table, two ALTER TABLE statements, storage bucket + policies
- **Secrets needed**: `ANTHROPIC_API_KEY` — already configured
- **No changes** to `supabase/config.toml`, `client.ts`, or `types.ts`

