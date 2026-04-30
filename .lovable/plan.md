# Final Pre-Launch Audit — Findings & Fix Plan

Honest summary: the app is in solid shape. No 5xx errors in recent edge logs, Paddle is on live keys, all 99 tables have RLS, scaling indexes are in place, and no client-side order inserts or invalid AI model IDs remain. There are **3 real issues to fix in code** plus **3 manual external steps** before onboarding paying customers.

---

## Code Fixes (this round)

### 1. `client-documents` storage policies are misaligned (HIGH — blocks feature, not data leak)

**What we found:** Edge functions (`generate-coa`, `generate-billing-report`) upload files under the path `{client_org_id}/filename`. But the facility-side RLS policies on `storage.objects` for `client-documents` require the path's first segment to equal `get_user_org_id(auth.uid())` — i.e., the **facility's** org id. These never match `client_org_id`.

**Impact:**
- Facility staff cannot list, read, update, or delete client documents through the Storage API. The COA download in the app silently shows nothing for them.
- It's not a data leak today, but the asymmetry is fragile — if anyone ever changes the path layout, it could become one.

**Fix:** Rewrite the four facility-side policies on `storage.objects` for the `client-documents` bucket to verify that the first path segment is a `client_org_id` whose `parent_org_id` equals the caller's facility org. Pattern:

```sql
USING (
  bucket_id = 'client-documents'
  AND EXISTS (
    SELECT 1 FROM public.client_orgs co
    WHERE co.id::text = (storage.foldername(name))[1]
      AND co.parent_org_id = get_user_org_id(auth.uid())
  )
)
```

Apply to SELECT, INSERT (`WITH CHECK`), UPDATE, and DELETE. The existing client-side policy ("Client users can read own documents") already uses `get_client_org_id_for_user(auth.uid())` and stays as-is.

### 2. `orders` table missing authenticated INSERT policy (LOW — defensive)

**What we found:** SELECT/UPDATE/DELETE exist for authenticated users, but no INSERT. Only `service_role` can insert. Today this is fine — the only inserts are from `sync-commerce7` and `sync-winedirect` edge functions which use service-role. But any future client-side order creation flow would fail silently.

**Fix:** Add an explicit INSERT policy mirroring the SELECT one (`org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'small_boutique')`). Keeps tier gating consistent and prevents future silent failures.

### 3. RLS policies bound to `public` role instead of `authenticated` (MEDIUM — defense in depth)

**What we found:** ~50 tables (vineyards, vintages, blocks, lab_samples, tasks, notifications, ai_messages, alert_rules, integration configs, sso_configs, etc.) have their UPDATE/DELETE/SELECT policies attached to the `public` role. They're safe today only because `get_user_org_id(NULL) = NULL` and `org_id = NULL` evaluates to NULL (not TRUE). If anyone ever changes `get_user_org_id` to return a default for unauthenticated callers, every one of these tables would open up.

**Fix:** Migration to alter all those policies from `TO public` to `TO authenticated`. INSERT policies are already correctly scoped to `authenticated` — this just brings the rest in line. No behavior change for legitimate users.

### Out of scope (intentional, will be marked ignored in security memory)

- The 15 `SECURITY DEFINER` function warnings — these are the org-scoping helpers (`get_user_org_id`, `has_role`, `get_*_org_id`, `org_has_tier`, etc.) that RLS policies depend on. They MUST be callable by `authenticated` to make policies work and they all have `SET search_path = public`. Revoking EXECUTE would break the app.
- The 2 "RLS Policy Always True" findings — these are the `service_role` full-access overrides on `orders` and similar, which are standard.

---

## Manual Steps Before First Paying Customer

These cannot be done from code — the user has to do them.

1. **Enable HIBP password check** in Lovable Cloud → Users → Auth Settings → toggle **Password HIBP Check** on. Stops customers from signing up with breached passwords.
2. **Verify Resend domain (`notify.solera.vin`)** is showing **active** in Cloud → Emails. If still `awaiting_dns`, transactional emails (signup, referral, alerts) will queue but not send.
3. **Test one end-to-end Paddle flow in production**: sign up a throwaway account → upgrade to Pro on the live Paddle checkout → confirm `subscription.created` webhook fires and `organizations.tier` flips. The webhook security and price-ID validation are already in place; this just confirms the Paddle live environment is wired correctly.

---

## What we are NOT doing (and why)

- **No new tests, no new monitoring dashboards** — the existing audit scripts in `scripts/audit/` and Sentry are sufficient for first-customer scale.
- **No rate limiting on edge functions** — meaningful only at higher volume; revisit after 50+ paying orgs.
- **No `console.log` cleanup** — cosmetic, doesn't affect customers.

---

## Verification after migration

- [ ] `supabase--linter` shows the 2 `RLS Policy Always True` warnings reduced to 0 (or only the intentional service_role ones)
- [ ] Sign in as a facility user, generate a COA — file appears in client documents list
- [ ] Sign in as a client portal user — still only sees their own org's documents
- [ ] `security--run_security_scan` no longer flags `client-documents` bucket or `orders` INSERT
- [ ] Update `@security-memory` to record that `SECURITY DEFINER` org-helpers are intentional and the `public`→`authenticated` role tightening is complete

After this round, the app is ready for the first cohort of paying customers.
