

## TTB Report Generator Diagnostic

**File:** `supabase/functions/generate-ttb-report/index.ts`
**Storage bucket:** `ttb-reports` (private)
**Config:** `[functions.generate-ttb-report] verify_jwt = false` — auth validated manually inside the function via `getUser()` + `profiles.org_id` lookup.

---

### 1. Output format

🔴 **HTML, not PDF.** Both code paths (`additions_log` and OW-1) generate HTML strings and upload them to the `ttb-reports` bucket with `contentType: "text/html"`. No PDF library (pdfkit, puppeteer, jsPDF) is invoked server-side. The OW-1 path adds a print-optimized stylesheet with `@page { size: letter }` and a "Print / Save PDF" banner with `window.print()` button (`index.ts` lines 261–264), so the user is expected to convert it to PDF in-browser.

The persisted column `ttb_reports.pdf_url` is named `pdf_url` but stores a link to an `.html` file. Misleading.

**Flag against PRD:** ❌ Server-generated PDF is not produced. PRD requirement violated.

---

### 2. Org-scoping of additions log

✅ **Correct.** Line 34: `.eq("org_id", orgId)` filters `ttb_additions` to the caller's org only. `orgId` is derived server-side from `auth.getUser()` → `profiles.org_id` (lines 18–24), not from the request body, so a client cannot spoof a different org. Date range (`from`/`to`) come from the request body but are constrained by the org filter.

🟡 **Caveat:** Multi-facility Enterprise orgs share a single `org_id`, so a child facility user will see additions from sibling facilities. No `facility_id` filter exists. Acceptable per current schema, worth noting.

---

### 3. OW-1 specific or generic export?

✅ **OW-1 specific** for the `report_id` branch. Renders TTB Form 5120.17 with all 8 header fields (Serial Number, BWN, Proprietor, Registry, Premises, Period, Bond Number, Date Prepared) and Part I Wine Operations table with the canonical 7 columns (Beginning Inventory, Produced, Received, Bottled, Shipped, Dumped, Ending Inventory) across 5 wine types (still table, sparkling, dessert, vermouth, other), plus auto-totaling row and certification block.

The `additions_log` branch is a **separate generic export** (simple table of additions for a date range), not OW-1 format.

---

### 4. Empty-data behavior

🔴 **Silent empty rendering, no graceful empty state.**

- **Additions log:** `additions || []` (line 44) → if zero rows, generates an HTML page with a header, period text, table headers, and **no body rows**. No "No additions in this period" message, no warning. Returns `success: true` with a signed URL to the empty file.
- **OW-1:**
  - `report` not found → throws `"Report not found"` → 400 (acceptable).
  - `bondInfo` missing → renders the form with **blank values** in fields 2–5 and 7 (BWN, Proprietor, Registry, Premises, Bond Number). Uses `?? ""` and `?.field || ""`, so the form silently submits with empty regulatory identifiers — a user could file an invalid OW-1 with the IRS without warning.
  - `operations` empty → table body is empty; the totals row only appears when `ops.length >= 2`. Single-op edge case skips totals.

**No preflight validation** errors out or warns when required compliance data is missing. The function happily produces a "looks complete but is hollow" form.

---

### 5. Storage vs streamed

✅ **Stored in Supabase Storage.** Both branches:
1. `supabaseAdmin.storage.from("ttb-reports").upload(...)` to `<orgId>/<fileName>.html` with `upsert: true`.
2. `createSignedUrl(path, 3600)` → 1-hour signed URL.
3. Return signed URL in the JSON response; OW-1 path also persists it to `ttb_reports.pdf_url`.

✅ Storage is org-scoped via the `<orgId>/` path prefix per `mem://storage/security-policy`.
🟡 The signed URL persisted to `ttb_reports.pdf_url` **expires in 1 hour** — the database record will go stale and clicking the saved link later returns 400. Re-generating the report is required to refresh.
🟡 The `additions_log` branch does **not** create or update a `ttb_reports` row, so there is no audit trail of who exported the additions log when. The OW-1 branch does (line 384).

---

### Summary

| # | Question | Result |
|---|---|---|
| 1 | Output format | 🔴 HTML, not PDF. Print-to-PDF banner relies on user. PRD violated. Column misnamed `pdf_url`. |
| 2 | Org-scoped additions | ✅ `org_id` derived server-side and applied as filter |
| 3 | OW-1 specific | ✅ Yes for `report_id` path; `additions_log` is a separate generic export |
| 4 | Empty data handling | 🔴 Silently renders blank/empty forms; no preflight validation; missing `bondInfo` produces an OW-1 with blank regulatory identifiers |
| 5 | Storage vs stream | ✅ Stored in private `ttb-reports` bucket with org-prefixed path; 1-hour signed URLs returned and persisted (will go stale) |

---

### Flagged gaps (diagnostic only)

1. 🔴 **(P0) Output is HTML, not PDF.** Add a server-side PDF renderer (e.g. `puppeteer`/`@sparticuz/chromium`, or `pdf-lib`) so the artifact is a true `.pdf`. Today the user must remember `⌘P` and the saved file in storage is `.html`. Auditors may reject. Rename `ttb_reports.pdf_url` once corrected.
2. 🔴 **(P0) Empty-state validation.** Before rendering OW-1, error out (or surface a banner) when (a) `ttb_bond_info` row is missing, (b) zero `ttb_wine_premise_operations` rows exist, or (c) for additions log, zero rows in window. Filing an OW-1 with blank BWN/Bond Number is a TTB compliance risk.
3. 🟡 **(P1) Stale signed URL persisted.** `ttb_reports.pdf_url` expires in 1 hour but is stored as if permanent. Either (a) regenerate the URL on demand from `pdf_path`, (b) extend expiry to 7 days, or (c) gate the download UI behind a "regenerate" button.
4. 🟡 **(P2) `additions_log` branch has no audit row.** Insert a `ttb_reports` row (or new `ttb_export_log` row) so there's a record of who exported the additions log and when.
5. 🟡 **(P2) Multi-facility scoping.** For Enterprise orgs, additions log returns rows from all sibling facilities. Add an optional `facility_id` filter and pass the active facility from the UI.

