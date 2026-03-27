

# Full System Review — Findings & Fix Plan

## Summary

The application is well-built overall. Auth, routing, data pipeline, edge functions, and the core UI are all functional. However, there are **8 issues** to fix before daily production use — 2 are **critical security issues**, 3 are **functional bugs**, and 3 are **resilience improvements**.

---

## Critical Issues

### 1. CRITICAL: user_roles RLS allows privilege escalation

The `user_roles` table has an INSERT policy `(user_id = auth.uid())` — any logged-in user can insert `{user_id: their_id, role: 'owner'}` and grant themselves full access.

Additionally, there's no DELETE or UPDATE policy, so the `updateRole` mutation in UserManagement (which upserts for other users) will silently fail via RLS.

**Fix:** Replace current RLS policies with:
- SELECT: users can read their own roles
- INSERT/UPDATE/DELETE: restricted to owners/admins via `has_role()` function
- Remove the self-insert policy entirely (roles are assigned by `handle_new_user` trigger using SECURITY DEFINER)

### 2. CRITICAL: UserManagement role update is broken

`updateRole` does `supabase.from("user_roles").upsert()` but:
- The upsert won't delete old roles — users accumulate multiple roles
- It also updates a `role` column on `profiles` (legacy), which creates inconsistency

**Fix:** Change the mutation to: delete all existing roles for the user, then insert the new role. Remove the `profiles.role` update (or keep it as a display-only cache, but never use it for access control).

---

## Functional Issues

### 3. CORS headers missing on 4 client-called edge functions

`activate-invite`, `update-order`, `process-backup`, and `sitemap` still use the short CORS header list. `activate-invite` and `update-order` are called from the browser and could fail with preflight errors.

**Fix:** Update all 4 to include the full `x-supabase-client-platform` header set.

### 4. No React Error Boundary

There's no error boundary in the app. An unhandled error in any component (e.g., bad API response, undefined data) will crash the entire app with a white screen.

**Fix:** Add a top-level `ErrorBoundary` component wrapping the app routes that shows a friendly error screen with a "Reload" button.

### 5. QueryClient has no default options

The `QueryClient` is initialized with no `staleTime`, `retry`, or `refetchOnWindowFocus` settings. For a production app used "multiple times a day":
- Every tab switch triggers refetches on all queries
- Failed requests aren't retried by default (react-query v5 defaults to 3, but explicit is better)

**Fix:** Configure `QueryClient` with sensible defaults:
- `staleTime: 2 * 60 * 1000` (2 min)
- `retry: 2`
- `refetchOnWindowFocus: true` (keep, but with staleTime it won't hammer the API)

---

## Resilience Improvements

### 6. `ProtectedRoute` doesn't handle onboarding edge case for missing org

If `organization` is null (profile exists but org_id doesn't resolve), the user gets through to the dashboard with no data. The `handle_new_user` trigger creates the org, but there's a race condition window.

**Fix:** Add a check: if `!organization && profile?.org_id` → show loading spinner (org is loading). If `!organization && !profile?.org_id` → redirect to onboarding.

### 7. Login "Create Account" link goes to `/coming-soon`

The login page's "Create Account" link sends users to `/coming-soon` (the waitlist page) instead of `/signup`. If you're ready for daily users, this should go to `/signup`.

**Fix:** Change the link from `/coming-soon` to `/signup`.

### 8. `profiles.role` column is a security smell

The `profiles` table has a `role` column that's writable by users (via the "Users can update their own profile" UPDATE policy). While `useRoleAccess` correctly reads from `user_roles`, the presence of this column invites future bugs where someone checks `profile.role` instead of `user_roles`.

**Fix:** Either drop the column via migration, or add a database-level trigger that prevents user-initiated changes to it. Lower priority than #1-2 but should be addressed.

---

## Implementation Order

1. Fix user_roles RLS policies (migration) — **security critical**
2. Fix UserManagement role update logic — **broken feature**
3. Add Error Boundary — **crash prevention**
4. Update 4 edge functions with full CORS headers
5. Configure QueryClient defaults
6. Fix ProtectedRoute org-loading edge case
7. Change "Create Account" link to `/signup`
8. Address `profiles.role` column (optional, lower priority)

---

## Technical Details

- **Step 1** requires a database migration to drop existing `user_roles` policies and create new ones using `has_role()` 
- **Step 2** is a code change in `src/pages/settings/UserManagement.tsx`
- **Step 3** is a new `src/components/ErrorBoundary.tsx` + wrapping in `App.tsx`
- **Step 4** is a mechanical CORS header update in 4 edge function files
- **Steps 5-7** are small code changes in existing files

No new tables or major architectural changes needed. All fixes are backward-compatible.

