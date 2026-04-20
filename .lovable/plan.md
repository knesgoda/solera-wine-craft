

## Custom Crush Client Portal Isolation Diagnostic

**Files reviewed:** `src/App.tsx`, `src/components/ClientLayout.tsx`, `src/pages/client/ClientLogin.tsx`, `supabase/migrations/20260318200245_*.sql` (client portal schema), `supabase/migrations/20260404083401_*.sql` (storage hardening), `supabase/functions/generate-coa/index.ts`, `supabase/functions/ask-solera/index.ts`, `supabase/functions/send-client-message/index.ts`, `supabase/config.toml`.

---

### 1. How client users are distinguished from winery users

**Separate table, shared `auth.users`, no role field on profiles.**

- Winery staff: row in `public.profiles` with `org_id` → `organizations`, plus role row in `user_roles` (owner / admin / manager / cellar / field).
- Client users: row in `public.client_users` with `auth_user_id` → `auth.users.id` and `client_org_id` → `client_orgs(id)`. `client_orgs.parent_org_id` points at the hosting winery's `organizations.id`.
- A given Supabase auth user is one or the other, never both. `ClientLogin.tsx` enforces this on sign-in: after `signInWithPassword`, it queries `client_users` by `auth_user_id` and signs the user out if no row exists.
- A separate sign-up flow (`/client/signup` → `complete-client-signup` edge function) inserts the `client_users` row using a one-time invite token (`client_invite_tokens`).

---

### 2. RLS preventing one client from seeing another client's lots

The discriminator is the SECURITY DEFINER function `get_client_org_id_for_user(auth.uid())` (returns the caller's `client_org_id` from `client_users`, or NULL for winery staff).

Five client-scoped SELECT policies use it (migration `20260318200245`):

| Table | Policy USING clause |
|---|---|
| `vintages` | `client_org_id IS NOT NULL AND client_org_id = get_client_org_id_for_user(auth.uid())` |
| `lab_samples` | `EXISTS (SELECT 1 FROM vintages v WHERE v.id = vintage_id AND v.client_org_id = get_client_org_id_for_user(auth.uid()))` |
| `ttb_additions` | same vintage-join pattern |
| `blending_trials` | `finalized = true AND` same vintage-join pattern |
| `barrels` | same vintage-join pattern |
| `client_messages` | `client_org_id = get_client_org_id_for_user(auth.uid())` |

Two clients in the same winery org therefore see **disjoint sets of vintages** because their `client_org_id` values differ. The `client_org_id IS NOT NULL` guard also prevents a client from accidentally pulling the winery's own non-custom-crush vintages (which have `client_org_id = NULL`).

---

### 3. URL-manipulated access to winery-internal routes (`/cellar`, `/operations`, etc.)

**Partial gap — UI is reachable, but data is not.**

- `App.tsx` puts all winery-internal pages inside `<ProtectedRoute><AppLayout/></ProtectedRoute>`. `ProtectedRoute` only checks `user` exists and `organization.onboarding_completed`. **It does not check whether the caller is a `client_user` vs a `profiles`-row user.**
- A client user who manually enters `/cellar`, `/operations`, `/vintages`, or `/dashboard` will:
  1. Pass the auth check (they have a session).
  2. Hit `useAuth().organization` — they have no `profiles.org_id`, so `organization` resolves to `null` and `ProtectedRoute` redirects them to `/onboarding` after the 6-second timeout, OR shows the "Unable to load your account" retry screen. They are **not** redirected to `/client/dashboard`.
  3. Even if the page renders briefly, every Supabase query is filtered by `org_id = get_user_org_id(auth.uid())` which returns NULL for client users, so RLS returns zero rows everywhere.

**Net effect:** Data is safe (RLS denies everything), but the UX is broken — a client lands on a stuck loading screen / `/onboarding` instead of being bounced to `/client/dashboard`. Mirror gap exists in the other direction: a winery user visiting `/client/dashboard` won't have a `client_users` row, so `ClientLayout` queries fail silently.

🟡 **Recommend:** Add a portal-type check in `ProtectedRoute` (or a sibling `ClientGuard` on `/client/*`) that explicitly redirects client users to `/client/dashboard` and winery users away from `/client/*`.

---

### 4. Can a client call Ask Solera, and is context scoped?

**Yes they can call it. Context is NOT scoped to their lots — it would leak the entire winery.**

- `supabase/config.toml` line 3: `[functions.ask-solera] verify_jwt = false`. Inside the function, auth is checked manually via `anonClient.auth.getUser()`, which accepts any valid Supabase session — including a client portal session.
- The function then runs `select org_id from profiles where id = user.id`. For a client user, `profiles` has no row, so `profile.org_id` is undefined → the function throws `"User has no organization"` and returns 400.
- **Effective behavior today:** client users get an error, no data leaks. **But the protection is accidental** — it depends on `client_users` not having a `profiles` row. If a client user ever ended up with both rows (e.g., a winery owner who is also a client of another facility, or a future product change), `buildWineryContext()` would dump the **parent winery's** entire dataset (every vintage, every lab sample, every barrel) into the prompt, because all 12 queries scope by `orgId` not by `client_org_id`.

🟡 **Recommend:** Explicitly check at the top of `ask-solera`: if `client_users` row exists for `auth.uid()`, return 403 (or build a separate, client-scoped context that filters every query by `client_org_id`). This converts an accidental safeguard into an explicit one.

UI side: `/ask-solera` is wrapped in `<GrowthTierGate>` and lives under `<AppLayout>` only — no client portal entry point exposes it.

---

### 5. Cross-client COA download

🔴 **GAP — a client can read any other client's COA in the same winery via the public URL.**

`supabase/functions/generate-coa/index.ts` lines 80–93 do the following after the auth check:

```ts
const clientOrgId = vintage.client_org_id || "facility";
await supabase.storage.from("client-documents").upload(
  `${clientOrgId}/${fileName}`, fileBytes, { contentType: "text/html", upsert: true }
);
const { data: urlData } = supabase.storage.from("client-documents").getPublicUrl(`${clientOrgId}/${fileName}`);
return new Response(JSON.stringify({ success: true, pdf_url: urlData.publicUrl }), …);
```

Two compounding problems:

1. **Storage path uses `client_org_id` as the folder prefix**, but the storage RLS policy from migration `20260404083401` (lines 24–38) gates by `(storage.foldername(name))[1] = get_user_org_id(auth.uid())::text` — i.e. the *parent winery's* `org_id`. The path written by `generate-coa` is `<client_org_id>/coa_*.html`, which **never matches** any winery user's `org_id` and never matches `get_user_org_id` for a client user (returns NULL). So authenticated reads of the bucket via RLS will fail for everyone.
2. The function returns `getPublicUrl(...)` for a bucket that is **not public** (`client-documents` bucket `public = false`). A `getPublicUrl` against a private bucket produces a URL that returns 400 Bad Request — so the COA link in the UI is currently **broken in production** for all users, not just cross-client ones.

If the bucket were ever flipped to public (or someone "fixes" the broken link by making it public), then **any URL guesser knowing `<client_org_id>/coa_<year>_<vintage_id_first8>.html` could fetch any client's COA** — no auth check, no per-client folder scoping that matches the storage policy, no signed URL.

🔴 **Recommend (priority):**
- Replace `getPublicUrl` with `createSignedUrl(path, 60 * 60)` so the link works and expires.
- Either (a) change the storage path to `<parent_org_id>/<client_org_id>/<file>` and update storage RLS to allow client users to read `(storage.foldername(name))[2] = get_client_org_id_for_user(auth.uid())::text`, OR (b) keep the current path and add a storage SELECT policy keyed on `client_org_id` for client users.
- Audit existing `client-documents` bucket contents and migrate paths.

---

### Summary table

| # | Question | Result |
|---|---|---|
| 1 | Distinguishing clients vs winery users | ✅ Separate `client_users` table with FK to `client_orgs.parent_org_id` |
| 2 | Cross-client RLS within same winery | ✅ Six policies keyed on `get_client_org_id_for_user()` |
| 3 | Client accessing `/cellar`, `/vineyard`, etc. | 🟡 Data safe (RLS), UX broken (stuck loading / onboarding) |
| 4 | Client calling Ask Solera | 🟡 Returns 400 today by accident; if a client ever gets a `profiles` row it would leak the entire parent winery |
| 5 | Cross-client COA download | 🔴 Storage policy mismatch + `getPublicUrl` on private bucket: link is broken now, but architecture is one config flip away from full cross-client read |

### Recommended fixes (not applied — diagnostic only)

1. **(P0)** Fix `generate-coa` to issue `createSignedUrl` and align storage path/policy so client users can read only their own folder.
2. **(P1)** Add an explicit "is client user → 403" guard at the top of `ask-solera` (and `ClientLayout`-side, prevent client users from ever reaching `/ask-solera`).
3. **(P1)** Add portal-routing guard in `ProtectedRoute` (or wrap `/client/*` with `ClientProtectedRoute`) to redirect client users → `/client/dashboard` and winery users away from `/client/*`.
4. **(P2)** Add an automated test to `scripts/audit/client-isolation-report.txt` that exercises (a) cross-client COA fetch by URL, (b) client user calling `ask-solera`, (c) client user navigating to `/cellar`.

