

# Comprehensive Audit — Findings & Remediation Plan

## Summary

After reviewing every page, edge function, context, hook, utility, RLS policy, and storage bucket, I found **4 critical security issues**, **3 medium issues**, and **5 quality improvements**. The app architecture is solid — Auth, RBAC, tier gating, offline sync, i18n, and timezone handling are all well-implemented. Below is what needs fixing, prioritized by severity.

---

## CRITICAL (Security — Must Fix Before Production)

### 1. Client invite tokens publicly readable by anonymous users
The `client_invite_tokens` table has an RLS policy `Anon can view invite tokens` with `USING (true)`, exposing all plaintext tokens and invitee emails to unauthenticated users. An attacker can enumerate pending invitations and use any token to impersonate an invited client.

**Fix:** Drop the permissive anonymous SELECT policy. Token validation is already handled server-side in `complete-client-signup` and `activate-invite` functions — no client-side anonymous read is needed.

### 2. TTB compliance reports readable by unauthenticated users
The `ttb-reports` storage bucket SELECT policy applies to `{public}` with no auth check, exposing government compliance filings (bonded winery numbers, production volumes, proprietor addresses) to anyone.

**Fix:** Change the SELECT policy role from `{public}` to `{authenticated}` and add an org-scoping path prefix check: `(storage.foldername(name))[1] = get_user_org_id(auth.uid())::text`.

### 3. Client documents accessible to any authenticated user
The `client-documents` bucket only checks `auth.role() = 'authenticated'`, allowing any logged-in user across all organizations to read/write/delete any client document.

**Fix:** Add org-scoping to all CRUD policies using the file path prefix pattern.

### 4. Realtime notifications subscribable across orgs
The `notifications` table is published to Supabase Realtime, but without channel-level RLS, any authenticated user can subscribe to another org's notification events.

**Fix:** Either remove `notifications` from `supabase_realtime` publication (the app polls via React Query already) or add channel-level RLS scoping.

---

## MEDIUM (Security — Should Fix)

### 5. Storage buckets (task-photos, label-images, store-assets) lack org-scoping on writes
INSERT/UPDATE/DELETE policies only check `bucket_id` — any authenticated user can overwrite another org's files.

**Fix:** Add `(storage.foldername(name))[1] = get_user_org_id(auth.uid())::text` to write policies.

### 6. Internal cost_per_bottle exposed via anonymous DTC SKU policy
The anon SELECT policy on `inventory_skus` exposes `cost_per_bottle`, internal `notes`, and `facility_id` to unauthenticated users browsing the public store.

**Fix:** Create a view `public_inventory_skus` that excludes sensitive columns, and point the anon policy at the view. Or restrict the SELECT policy to specific columns.

### 7. Roadmap voter IPs publicly readable
The `roadmap_votes` table's `Anyone can read votes` policy exposes `voter_ip` (PII) to all users.

**Fix:** Either drop the `voter_ip` column or create a view excluding it.

---

## QUALITY & RELIABILITY

### 8. Enable leaked password protection (HIBP check)
Currently disabled. Should be enabled to prevent users from signing up with known-compromised passwords.

**Fix:** Use `cloud--configure_auth` to enable the HIBP password check.

### 9. MarketingFooter ref warning in console
React warns: "Function components cannot be given refs." The `MarketingLayout` passes a ref to `MarketingFooter` (likely via React Router's `Outlet` mechanism). 

**Fix:** Wrap `MarketingFooter` with `React.forwardRef`.

### 10. Two `as any` RPC calls reference a non-existent function
`CogsDashboard.tsx` and `LotCostDetail.tsx` call `supabase.rpc("recalculate_lot_cost_summary_for_vintage")` but this function doesn't exist in the database (the actual trigger is `recalculate_lot_cost_summary` which fires automatically on cost_entries changes). The calls fail silently.

**Fix:** Remove the dead RPC calls — the trigger already handles recalculation automatically.

### 11. `FacilityContext` swallows fetch errors
The `.then()` chain for loading facilities doesn't handle errors — if the query fails, `loading` is set to `false` but no error is surfaced.

**Fix:** Add `.catch()` or check `error` in the response.

### 12. ContractDetail auto-expire runs client-side
The `useEffect` in `ContractDetail` auto-expires contracts by calling `supabase.from("grower_contracts").update({ status: "expired" })` directly. This should be a scheduled server-side job or database trigger, not client-side logic that races with multiple users.

**Fix:** Move contract expiry to a cron edge function or database trigger. Remove the client-side `useEffect`.

---

## Execution Plan

**Phase 1 — Critical Security (Commits 1-4):**
4 database migrations to fix RLS policies on `client_invite_tokens`, `ttb-reports` bucket, `client-documents` bucket, and `notifications` realtime.

**Phase 2 — Medium Security (Commits 5-7):**
3 migrations for storage bucket write policies, DTC SKU column exposure, and roadmap voter IP.

**Phase 3 — Quality (Commits 8-12):**
Enable HIBP check, fix MarketingFooter ref warning, remove dead RPC calls, add FacilityContext error handling, move contract expiry server-side.

