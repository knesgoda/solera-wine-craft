

## Custom Crush Client Portal Isolation — Diagnostic

**Files reviewed:** `src/App.tsx`, `src/components/ClientLayout.tsx`, `src/pages/client/ClientLogin.tsx`, `src/pages/client/ClientDocuments.tsx`, `src/components/ProtectedRoute.tsx`, `supabase/migrations/20260318200245_*.sql` (client portal schema + RLS), `supabase/migrations/20260404083401_*.sql` (storage hardening), `supabase/functions/generate-coa/index.ts`, `supabase/functions/ask-solera/index.ts`, `supabase/functions/send-client-message/index.ts`, `scripts/audit/client-isolation-report.txt`, `supabase/config.toml`.

---

### 1. How are client users distinguished from winery users?

Architecturally separate. There is **no shared role enum** between portals.

- **Winery users** → row in `profiles` with `org_id` → `auth.users` → role in `user_roles` (owner/manager/cellar/field).
- **Client users** → row in `client_users` keyed by `auth_user_id`, pointing at `client_org_id` → `client_orgs.parent_org_id` (the winery that owns the relationship). A client user **does not** have a `profiles.org_id`.
- **Auth flow** is split: `/login` (`Login.tsx`) for winery, `/client/login` (`ClientLogin.tsx`) for clients. After Supabase auth, `ClientLogin` queries `client_users` and signs the user out if no row exists ("This account is not a client portal account").
- Helper: `get_client_org_id_for_user(_user_id)` SECURITY DEFINER function returns the caller's `client_org_id`, used in every client-scoped RLS policy.

✅ **Hard separation** at the table and JWT level.

---

### 2. RLS preventing cross-client data access within the same winery

Every client-scoped RLS policy (`vintages`, `lab_samples`, `ttb_additions`, `blending_trials`, `barrels`) enforces:

```sql
client_org_id IS NOT NULL
AND client_org_id = get_client_org_id_for_user(auth.uid())
```

(For child tables it's done via `EXISTS (SELECT 1 FROM vintages v WHERE v.id = vintage_id AND v.client_org_id = get_client_org_id_for_user(auth.uid()))`.)

`client_messages` adds `sender_type = 'client'` to INSERT to prevent spoofing as `facility`.

`client_users` SELECT is restricted to `auth_user_id = auth.uid()` so a client cannot enumerate other clients in the same winery.

✅ **Two clients in the same winery org cannot see each other's lots** — confirmed by `scripts/audit/client-isolation-report.txt` PASS lines 4–6 (vintages, lab samples, messages all return 0 rows when querying another client's data).

---

### 3. Can a client manipulate the URL to reach `/cellar`, `/operations`, `/lab`, etc.?

🟡 **Yes — they can render the routes, but RLS returns empty data.**

`ProtectedRoute` only checks `user`, `profile`, and `organization`. There is **no portal-segregation guard**:

- A client user navigating to `/dashboard` or `/cellar` has no `profiles.org_id` row, so `organization` is undefined. `ProtectedRoute` will time out after 6 s and show the "Unable to load your account" error screen.
- Worse: **if a client also happens to have a `profiles` row** (legacy, dual-role, or future bug), `ProtectedRoute` lets them in and they will see their winery's full data. There's no "this user belongs to the client portal — redirect to /client/dashboard" check.
- Conversely, a winery user navigating to `/client/dashboard` is sent through `ClientLayout`, which queries `client_users` for them. With no row, the layout renders forever (the `useQuery` is `enabled: !!userId` and never returns), so they see a half-broken portal but no other client's data.

🔴 **Gap:** No explicit cross-portal redirect. The defense relies on RLS returning empty results rather than denying the route. Acceptable as a backstop, brittle as a primary control.

---

### 4. Can a client user call `ask-solera`? Is context scoped to their lots?

🔴 **They can call it, and the context-scoping is accidental, not enforced.**

`supabase/functions/ask-solera/index.ts`:
- `verify_jwt` is on (no override in `config.toml`), so any authenticated session reaches the function.
- The handler does `getUser()` → looks up `profiles.org_id`. If a pure client user calls it, `profile.org_id` is null and the function throws `"User has no organization"` → 500. So today, in practice, the function fails closed for client-only accounts.
- **`buildWineryContext` is hard-coded to `org_id`** with no `client_org_id` filtering at all. It pulls **all** vintages, vessels, barrels, tasks, weather, anomalies for the winery — not scoped to a single client's lots.

🔴 **Two failure modes:**
1. **Dual-role account** (a person with both `profiles.org_id` and `client_users` row, e.g. a winery owner who also runs a custom-crush lot, or a buggy onboarding): they hit the function as a winery user and see *every* client's data through Ask Solera, including cross-tenant.
2. **Client-only:** correctly blocked, but by accident — the function should explicitly reject `client_users.auth_user_id` callers (or scope context to their `client_org_id`), not rely on the absence of a profile.

Additionally there is no portal-side guard preventing a client user from typing `/ask-solera` into the URL. It will fail at the edge function with a generic 500.

---

### 5. Can a client download another client's COA?

✅ **Largely no, with one caveat.**

Two paths to a COA file:

- **a) Direct edge invoke** (`generate-coa`): per `scripts/audit/client-isolation-report.txt`, fixes were applied — the function now calls `getUser()`, looks up both `profiles.org_id` (facility) and `client_users.client_org_id` (client), and returns 403 unless the caller is either a facility user for the vintage's `org_id` **or** a client user whose `client_org_id` matches the vintage's `client_org_id`. Tests pass with 403 for cross-client calls.

- **b) Storage list** (`ClientDocuments.tsx`): the page lists `storage.objects` under the bucket prefix `<clientUser.client_org_id>/`. The bucket is **private**, and the storage RLS policy `"Org users can read client docs"` checks `(storage.foldername(name))[1] = get_user_org_id(auth.uid())::text` — i.e., it scopes by **`profiles.org_id`** (winery org id), not `client_org_id`. Because client users have no `profiles.org_id`, this policy returns false for them and they get **zero objects** listed.

🔴 **Significant gap (P1):**
- The storage RLS policy was written for **facility users only**. Client users in `ClientDocuments.tsx` will see "No documents available yet." even when COAs exist in their folder, because no policy grants them SELECT.
- There is no policy of the form: `(storage.foldername(name))[1] = get_client_org_id_for_user(auth.uid())::text`. So either (a) client document listing is currently broken in production, or (b) it works only via signed URLs returned by `generate-coa` directly.
- Additionally `ClientDocuments.tsx` calls `getPublicUrl()` on a **private** bucket — the resulting URL returns 400/403 when clicked, same broken-link bug as the original `generate-coa` and `generate-ttb-report` issues. Should use `createSignedUrl(path, 3600)` instead.

✅ **Cross-client read is not possible** — even if a client tries to list `<other_client_org_id>/` directly, RLS returns zero. The boundary holds; it just also blocks the legitimate case.

---

### Summary

| # | Question | Result |
|---|---|---|
| 1 | Client vs winery distinction | ✅ Separate `client_users` table, separate `/client/login`, post-auth check signs out non-client accounts |
| 2 | Cross-client RLS within same org | ✅ All client-scoped tables filter by `get_client_org_id_for_user(auth.uid())`; audit report confirms |
| 3 | Winery routes accessible by URL | 🟡 Routes render, RLS returns empty — but no explicit portal guard; dual-role accounts bypass |
| 4 | Ask Solera callable by client | 🔴 Reachable; fails closed by accident only; dual-role accounts leak full winery context across all clients |
| 5 | Cross-client COA download | ✅ Cross-client blocked. 🔴 Storage policy missing for legitimate client SELECT; `getPublicUrl` returns broken URLs on private bucket |

---

### Flagged gaps (diagnostic only — no fixes applied)

1. 🔴 **(P0) `ask-solera` cross-tenant exposure for dual-role accounts.** Add an explicit `client_users` lookup at the top of the function — if the caller has a `client_users` row, either (a) reject with 403 ("client portal cannot use Ask Solera"), or (b) build a *client-scoped* context using only their `client_org_id`'s vintages/lab data. Never fall through to `buildWineryContext(profile.org_id)` for a user who is also a client.

2. 🔴 **(P0) Add portal routing guard.** Either (a) inside `ProtectedRoute`, detect a `client_users` row and redirect to `/client/dashboard`; (b) wrap `/client/*` with a `ClientProtectedRoute` that redirects winery users away. Today the defense is "RLS returns empty" — adequate for data, terrible UX, and zero defense if a future RLS regression slips in.

3. 🔴 **(P1) Add storage RLS policy for client document listing.** Add SELECT policy on `storage.objects` for bucket `client-documents` with `(storage.foldername(name))[1] = get_client_org_id_for_user(auth.uid())::text`. Today client users likely see an empty Documents page.

4. 🔴 **(P1) Replace `getPublicUrl` with `createSignedUrl(path, 3600)`** in `ClientDocuments.tsx` and any persisted URL writes — the bucket is private, public URLs do not resolve.

5. 🟡 **(P2) Lock down `client_users.role` field.** The schema has a `role` column on `client_users` but no policy preventing self-update. Verify it's not editable by the client themselves (the existing UPDATE policy is facility-scoped, but worth audit-confirming via `scripts/audit/client-isolation-report.txt`).

6. 🟡 **(P2) Extend the audit script.** `scripts/audit/client-isolation-report.txt` should add tests for: (a) client user calling `ask-solera` → expect 403/empty-context, (b) client user fetching `/cellar` and asserting empty data, (c) client user listing `client-documents` storage and seeing their own files (to catch the missing-policy regression in #3).

