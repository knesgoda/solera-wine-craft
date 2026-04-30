# Security Fix Plan — HIGH & MEDIUM Findings

Targeted patches to 6 edge functions. No schema changes, no UI changes, no changes to business logic.

---

## HIGH Priority

### 1. `complete-client-signup` — Auth spoofing
**Problem:** Trusts `auth_user_id` from request body. An attacker could pass another user's UUID and link a client account to them.

**Fix:**
- Require `Authorization` header
- Use `supabase.auth.getClaims(token)` to derive `auth_user_id` from the verified JWT (ignore body value)
- Add length validation for `first_name` / `last_name` (1–100 chars)
- Verify `invite.email` matches the JWT's email claim before linking

### 2. `generate-coa` — HTML masquerading as PDF
**Problem:** Function returns HTML with `.html` extension under field name `pdf_url`. Deno cannot run jsPDF reliably for production rendering.

**Fix:**
- Mark Edge Function as deprecated (comment header), keep returning current output for backward compatibility
- Create new client-side helper `src/lib/coaPdfExport.ts` using jsPDF (mirrors `ttbPdfExport.ts` pattern)
- Update the COA download caller in `src/pages/client/ClientVintageDetail.tsx` (and any winery-side caller) to fetch the same data via supabase queries and render PDF in browser
- Filename: `COA_[Vintage]_[BlockName].pdf`

### 3. `check-compliance` — XML injection
**Problem:** `config.username`, `config.password_hash`, `destinationState`, `sku.label`, `quantity_bottles` are interpolated raw into a SOAP envelope. Any `<` `>` `&` `"` `'` in stored config or SKU labels breaks the request or allows XML injection.

**Fix:**
- Add `escapeXml()` helper that replaces `& < > " '` with entity references
- Wrap every interpolated value with `escapeXml(String(value))`
- Add JWT auth guard at top (function currently has `verify_jwt = false` and no in-code check)

### 4. `ask-solera` — Invalid model ID
**Problem:** Uses `claude-sonnet-4-6` which is not a valid Anthropic model identifier. Will silently fail or 404 at runtime.

**Fix:**
- Replace with `claude-sonnet-4-20250514` (per project memory `mem://tech/ai-integration`)
- Add a context-length cap: truncate injected org context to ~8000 chars before sending

---

## MEDIUM Priority

### 5. `sync-shopify` — Missing auth guard
Add JWT verification using `getClaims()`, then verify the caller's `org_id` (from `profiles`) matches the `org_id` in the request body. Reject otherwise.

### 6. `notify-admin` — Missing auth guard
Add a shared-secret check (`x-admin-notify-secret` header validated against `Deno.env.get("ADMIN_NOTIFY_SECRET")`) since this is invoked server-to-server. If the secret env var is not yet configured, fall back to requiring service-role JWT.

### 7. `check-compliance` — Auth (covered above in #3)

---

## Files Touched

**Edge functions:**
- `supabase/functions/complete-client-signup/index.ts`
- `supabase/functions/generate-coa/index.ts` (deprecation comment only)
- `supabase/functions/check-compliance/index.ts`
- `supabase/functions/ask-solera/index.ts`
- `supabase/functions/sync-shopify/index.ts`
- `supabase/functions/notify-admin/index.ts`

**Client code:**
- `src/lib/coaPdfExport.ts` (new — jsPDF generator mirroring `ttbPdfExport.ts`)
- `src/pages/client/ClientVintageDetail.tsx` (swap COA download to client-side PDF)
- Any other COA caller found via `rg "generate-coa"`

**No DB migrations. No config.toml changes. No package additions** (jsPDF already installed for TTB).

---

## Out of Scope (Deferred)

- Restructuring `generate-coa` to be removed entirely (kept for backward compat per audit recommendation)
- Adding rate limiting to public-ish endpoints
- The `_test_secret_canary.ts` finding from `secrets-report.txt` — verify whether this is an intentional audit fixture before deleting

---

## Verification Checklist

- [ ] `complete-client-signup` rejects calls without `Authorization` header (401)
- [ ] `complete-client-signup` ignores body `auth_user_id` and uses JWT `sub`
- [ ] `check-compliance` escapes `&`, `<`, `>`, `"`, `'` in SOAP body
- [ ] `ask-solera` returns successful Anthropic response (model ID valid)
- [ ] `sync-shopify` rejects cross-org requests
- [ ] `notify-admin` rejects unsigned requests
- [ ] COA download produces a real `.pdf` file in browser
- [ ] No TypeScript errors; build succeeds
