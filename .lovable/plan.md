

## TTB Report Generator Diagnostic

**File:** `supabase/functions/generate-ttb-report/index.ts`
**Storage bucket:** `ttb-reports` (private, per `<storage-buckets>`)
**Config:** `[functions.generate-ttb-report] verify_jwt = false` in `supabase/config.toml` — auth validated manually inside the function.

---

### 1. Output format

🔴 **HTML, not PDF.** The function generates a single self-contained HTML document with print-media CSS (`@page { size: letter; margin: 0.6in 0.5in; }`), Times New Roman serif body, and a fixed "Print / Save PDF" banner that calls `window.print()`. The file is uploaded with `contentType: "text/html"` and the resulting URL ends in `.html` (`ow1_<from>_<to>.html` and `additions_log_<from>_<to>.html`).

The user is expected to open the link, hit ⌘P / Ctrl+P, and "Save as PDF" themselves. PRD requires **PDF**. The pdf_url field name is misleading — it returns an HTML URL.

This matches `mem://features/enterprise-compliance` ("high-fidelity HTML reproduction with print-media CSS") — the gap is intentional from a memory standpoint but still a PRD non-compliance.

### 2. Org scoping of TTB additions

✅ **Correctly scoped.** Auth is established as follows:
1. `supabaseUser.auth.getUser()` validates the caller's JWT (despite `verify_jwt = false` at config level).
2. `userId` is read from the validated session, then `profiles.org_id` is looked up via the service-role client.
3. **Every** TTB query uses `.eq("org_id", orgId)`:
   - Additions log path: `ttb_additions ... .eq("org_id", orgId).gte("added_at", from).lte("added_at", to)`
   - OW-1 path: `ttb_reports ... .eq("id", report_id).eq("org_id", orgId)` and `ttb_bond_info ... .eq("org_id", orgId)` and `ttb_wine_premise_operations ... .eq("report_id", report_id)` (joined to the already-org-scoped report).

No client_org_id support — this is a winery-only function. A custom-crush client user calling it would fail at the `profiles.org_id` lookup ("No organization"). No cross-org leakage path identified.

### 3. OW-1 specificity

✅ **Yes — purpose-built for OW-1 (TTB Form 5120.17).** The function has two branches:
- `body.type === "additions_log"` → simple chemical-additions table for any date range (supplemental compliance log, not a form replica).
- Default branch → renders the **OW-1 form facsimile** with: serial number, BWN, proprietor name, registry/permit number, premises address, bond number, report period; Part I "Wine Operations (Wine Gallons)" table with the five wine-type rows (Still Table Wine, Sparkling Wine, Dessert Wine, Vermouth, Other) and nine standard columns (Beginning Inventory, Produced, Received, Bottled/Packed, Shipped/Removed, Dumped/Lost, Ending Inventory) plus a TOTALS row; perjury certification block with signature lines.

Pulls from dedicated tables: `ttb_bond_info` (BWN, proprietor, premises, bond number) and `ttb_wine_premise_operations` (per-wine-type gallon figures, joined via `report_id`). It is **not** a generic export.

### 4. Empty / missing data behavior

🟡 **Partial empty-state handling — no graceful UX, but no crash either.**

- **No `report_id` found / wrong org:** `report` is null → `throw new Error("Report not found")` → returns 400 JSON `{error}`. The client UI sees a generic error toast.
- **No `ttb_bond_info` row** (org never configured): `.maybeSingle()` returns null and the form renders with **blank values** in fields 2, 3, 4, 5, 7 (`${bondInfo?.bonded_winery_number || ""}`). The OW-1 PDF is technically generated but legally useless — TTB requires BWN and proprietor name. No warning, no validation, no banner.
- **No `ttb_wine_premise_operations` rows** for the report: the operations table renders with **only the header row and no body rows**; the TOTALS-row generator skips when `ops.length < 2`, so even the totals are absent. The HTML uploads successfully and the user gets a "successful" `pdf_url` pointing at an empty form.
- **Additions log with zero matches:** the table renders with a header row and no body rows. Upload succeeds, returns success. No "No additions found" message.

In all empty cases the function returns HTTP 200 + a URL, masking the fact that the report is incomplete or empty. There is no pre-flight check that warns the user "no bond info on file" or "no operations recorded for this period."

### 5. Storage vs streaming

✅ **Stored in Supabase Storage**, not streamed.

- Uploaded to bucket `ttb-reports` at path `<org_id>/<filename>` via `supabase.storage.from("ttb-reports").upload(...)`.
- URL returned via `getPublicUrl(...)` — but the bucket is **private** (`Is Public: No`).

🔴 **Same broken-link bug as `generate-coa`:** `getPublicUrl` against a private bucket produces a URL that returns 400/403. The link in the response works only if either (a) the storage RLS policy on `ttb-reports` happens to allow reads via the public CDN path (it does not — per `mem://storage/security-policy`, this bucket has `(storage.foldername(name))[1] = get_user_org_id(auth.uid())::text` SELECT policy, which the public URL endpoint cannot evaluate), or (b) someone clicks while the bucket is temporarily flipped public.

For OW-1 the function does additionally write `pdf_url` into the `ttb_reports` row alongside `status: "ready"` — so the broken URL is also persisted to the database, meaning the "Download" button on the report row in the UI also leads nowhere. Should use `createSignedUrl(path, 60 * 60)` instead.

---

### Summary table

| # | Question | Result |
|---|---|---|
| 1 | Output format | 🔴 HTML with print CSS — user must manually save as PDF. PRD says PDF. |
| 2 | Org scoping | ✅ Every query filtered by `orgId` from authenticated `profiles` row. |
| 3 | OW-1 specificity | ✅ Renders TTB Form 5120.17 facsimile with bond info + 5-wine-type operations table + certification block. |
| 4 | Empty-data behavior | 🟡 No crash, but generates a blank/incomplete form and returns success — no preflight validation, no in-form "no data" message. |
| 5 | Storage | ✅ Stored in `ttb-reports` bucket. 🔴 But returned as `getPublicUrl` on a private bucket → broken download link. |

### Flagged gaps (not fixed — diagnostic only)

1. 🔴 **PRD non-compliance:** Output is HTML, not PDF. Options: (a) integrate a Deno-compatible PDF renderer (e.g., `puppeteer`, `@react-pdf/renderer`, or call a headless Chrome service), or (b) update the PRD to accept "print-ready HTML" if the manual print step is acceptable for TTB submission (it is not — TTB e-filing requires PDF or paper).
2. 🔴 **Broken download link:** Replace `getPublicUrl` with `createSignedUrl(path, 3600)` in **both** branches and in the persisted `ttb_reports.pdf_url` write. Also rename the column / response key from `pdf_url` to `report_url` until #1 is resolved.
3. 🟡 **Silent empty reports:** Add preflight validation that errors out (or surfaces a warning) when (a) `ttb_bond_info` row is missing, (b) zero `ttb_wine_premise_operations` rows exist for the report, or (c) zero additions in the requested date range. Better: a banner inside the rendered HTML when sections are empty.
4. 🟡 **`additions_log` branch does not persist a `ttb_reports` row** — only the OW-1 path does. Means the additions log is fire-and-forget; there is no audit trail of who ran which compliance export when.

