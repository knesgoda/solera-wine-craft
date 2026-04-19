

## Pre-Launch Audit Findings & Fix Plan

The uploaded doc is a 7-prompt pre-launch checklist. I audited each item against the current codebase. Most things are already built. Here is the gap-by-gap status and the work needed.

### Status Per Prompt

| # | Item | Status |
|---|---|---|
| 1 | Offline queue + flush on reconnect | ✅ Already wired (`syncQueue.ts`, `syncFlush.ts`, `useOfflineSync` mounted in `AppLayout.tsx`, used in `NewLabSampleDialog` and `TaskDetail`) |
| 2 | Sentry init in `main.tsx` | ✅ Present, gated on `VITE_SENTRY_DSN` (currently runs in all envs, not just PROD — minor) |
| 3 | Handwritten Notes E2E | ⚠️ Two gaps: (a) `import_source` written as `"handwritten_photo"` but checklist expects `"handwritten_notes"`, (b) **no camera icon on lab samples list** for imported rows |
| 4 | Ripening Divergence alert | ⚠️ Edge function exists and works, but the deep link is `/ripening-comparison` with no block IDs — checklist requires "blocks pre-selected" |
| 5a | OG meta tags | ✅ `index.html` already points to `https://solera.vin/og-default.png` |
| 5b | Sitemap | ✅ Real XML with 12 routes, `robots.txt` references it |
| 5c | Billing `next_billed_at` surface | ✅ Already rendered in `BillingSettings.tsx` lines 185-209, hidden when null |
| 6 | Smoke test | Manual E2E test, no code changes |

### Code Changes Required (small, focused)

**1. Camera provenance icon on lab samples list** (Prompt 3, item 7)
- File: `src/components/vintages/LabChart.tsx` and/or `src/pages/vintages/VintageDetail.tsx` — wherever lab samples are rendered as a list/table
- Add a `Camera` icon (lucide-react) badge next to rows where `import_source === 'handwritten_photo'`
- Tooltip: "Imported from handwritten notes"

**2. Standardize `import_source` value**
- The doc expects `"handwritten_notes"`; current code writes `"handwritten_photo"` in `HandwrittenImport.tsx` line 143
- Decision needed: keep `"handwritten_photo"` (already in DB, would require doc update) or change to `"handwritten_notes"` (requires backfill if any test rows exist). Recommend keeping `"handwritten_photo"` as it's more descriptive and the doc is the spec to update.

**3. Divergence alert deep link with block IDs** (Prompt 4, item 8)
- File: `supabase/functions/evaluate-alerts/index.ts` line 150
- Change `linkUrl: "https://solera.vin/ripening-comparison"` to include the two affected block IDs as query params: `?blocks=<fastestId>,<slowestId>`
- Also update `src/pages/operations/RipeningComparison.tsx` to read `?blocks=` from the URL on mount and pre-select those blocks (verify whether already supported)

**4. Sentry PROD-only gate** (Prompt 2, item 5 in checklist)
- File: `src/main.tsx` line 12
- Wrap init: `if (SENTRY_DSN && import.meta.env.PROD)` so dev errors don't pollute Sentry

### Files Touched
- `src/main.tsx` — PROD-only Sentry
- `supabase/functions/evaluate-alerts/index.ts` — deep link with block IDs
- `src/pages/operations/RipeningComparison.tsx` — read `?blocks=` query param (verify first)
- `src/components/vintages/LabChart.tsx` (or wherever lab samples render as rows) — Camera icon for `handwritten_photo` source

### Out of Scope (Manual Testing)
Prompts 1, 2, 3 verification, 4 verification, 5 verification, and 6 (full smoke test) are manual E2E tests you run before May 1. The code is ready for those tests after the four small fixes above.

### Open Question
Want me to also keep `"handwritten_photo"` and update the master checklist doc accordingly, or rename the value to `"handwritten_notes"` to match the doc literally?

