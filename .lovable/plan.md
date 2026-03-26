

# Backend Readiness Audit — Findings & Fix Plan

## Summary

The backend is **mostly solid** — auth flow, RLS, Paddle billing, Resend emails, and the core data pipeline are all wired correctly. However, there are **6 issues** that need fixing before customers start using the product.

---

## Issues Found

### 1. Invalid Anthropic model IDs (will cause 404 errors)

Three edge functions use `claude-sonnet-4-6-20250514` — a model ID that does not exist on Anthropic's API. The working `ask-solera` function uses `claude-sonnet-4-20250514`, which is correct.

**Affected files:**
- `supabase/functions/analog-insight/index.ts` — line 29
- `supabase/functions/suggest-mapping/index.ts` — line 55
- `supabase/functions/weekly-summary/index.ts` — line 118 (uses `claude-sonnet-4-6`, also invalid)

**Fix:** Change all three to `claude-sonnet-4-20250514`.

---

### 2. Waitlist notification uses Resend sandbox sender

`supabase/functions/notify-waitlist-signup/index.ts` sends from `onboarding@resend.dev` (Resend's test domain) instead of a `@solera.vin` address. Resend's sandbox domain will be rejected or land in spam for real recipients.

**Fix:** Change `from` to `Solera Notifications <notifications@solera.vin>`.

---

### 3. CORS headers inconsistent across 15+ edge functions

Many client-facing edge functions (e.g. `check-compliance`, `fetch-weather`, `generate-ttb-report`, `club-subscribe`, `sync-commerce7`, `complete-client-signup`, `invite-client`, `send-client-message`, etc.) use the **short** CORS header list:

```
authorization, x-client-info, apikey, content-type
```

The Supabase JS client now sends additional platform headers (`x-supabase-client-platform`, etc.). While these short headers *usually* work (browsers only enforce CORS for non-simple headers), some edge cases can cause preflight failures.

**Fix:** Standardize all 15 client-called functions to the full CORS header set:

```
authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version
```

**Affected functions:** `check-compliance`, `check-harvest-alerts`, `club-subscribe`, `complete-client-signup`, `evaluate-alerts`, `fetch-weather`, `generate-billing-report`, `generate-coa`, `generate-ttb-report`, `invite-client`, `og-image`, `process-club-shipment`, `send-client-message`, `sync-commerce7`, `sync-google-sheet`, `sync-quickbooks`, `sync-shopify`, `sync-winedirect`, `webhook-dispatch`, `api-v1`

---

### 4. `evaluate-alerts` CORS headers also missing platform headers

Same issue as #3 but this one is particularly important — it's called reactively when lab data is saved.

(Covered in fix #3 above.)

---

### 5. No issues found (confirmed good)

These areas were audited and are **working correctly**:
- **Auth flow**: Signup → `handle_new_user` trigger → org creation → profile → owner role assignment. Solid.
- **Onboarding**: Proper retry logic for race condition with DB trigger.
- **RLS**: All edge functions use `service_role_key` server-side; client queries are RLS-scoped via `org_id`.
- **Paddle webhook**: Signature verification with timing-safe compare. Tier mapping correct.
- **Resend email branding**: All other functions use `@solera.vin` domain correctly.
- **URL references**: No remaining `lovable.app` or `solera.app` references.
- **Ask Solera**: Streaming, winery context, conversation history — all properly wired.
- **Anomaly detection**: Reactive + scheduled modes, deduplication, email digest.
- **Weekly summary**: Context gathering, AI generation, notification + email delivery.
- **Client portal**: Invite flow, token validation, signup completion, messaging.
- **Contact form**: Input validation, HTML escaping, Resend delivery.
- **Coming soon redirects**: All marketing signup links point to `/coming-soon` as intended.

---

## Implementation Plan

### Step 1: Fix Anthropic model IDs
Update `analog-insight`, `suggest-mapping`, and `weekly-summary` to use `claude-sonnet-4-20250514`.

### Step 2: Fix waitlist notification sender
Update `notify-waitlist-signup` from address from `onboarding@resend.dev` to `notifications@solera.vin`.

### Step 3: Standardize CORS headers
Update all 20 edge functions with short CORS headers to include the full platform header set. This is a mechanical find-and-replace across each file's `corsHeaders` constant.

---

## Technical Details

All changes are in `supabase/functions/*/index.ts` files only — no database migrations, no frontend changes, no RLS policy changes needed. Edge functions auto-deploy on save.

