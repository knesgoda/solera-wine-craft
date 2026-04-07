

# Fix: Stuck on "Solera" Loading Screen After Login

## Root Cause

The `AuthContext` has **two competing `fetchProfile` calls** — one from `onAuthStateChange` (fire-and-forget) and one from `getSession()` (with `.finally(() => setLoading(false))`). This creates a race condition:

1. `onAuthStateChange` fires → calls `fetchProfile` → sets `profile` (with `org_id`) mid-way through, triggering a re-render
2. `ProtectedRoute` sees `profile.org_id` is set but `organization` is still `null` → shows the "Solera" pulsing screen (line 58)
3. The org query may complete eventually, but the concurrent duplicate calls and unbatched state updates cause unpredictable timing

Additionally, React 18 does **not** batch state updates across `await` boundaries, so `setProfile(...)` and `setOrganization(...)` trigger separate renders — creating a window where profile exists but organization doesn't.

## Fix (single file: `src/contexts/AuthContext.tsx`)

**Use `onAuthStateChange` as the single source of truth** — remove the duplicate `fetchProfile` from `getSession()`. Per Supabase docs, `onAuthStateChange` fires with `INITIAL_SESSION` on mount, so `getSession()` only needs to be called to trigger that event.

1. **Set up `onAuthStateChange` first** — call `fetchProfile` with `.finally(() => setLoading(false))` inside it
2. **Call `getSession()` after** — only to trigger the initial event, don't set state from it
3. **Remove the duplicate `fetchProfile` call** from the `getSession().then()` block

```text
useEffect flow (before — broken):
  getSession → fetchProfile + setLoading(false)   ← call #1
  onAuthStateChange → fetchProfile (fire-forget)   ← call #2 (race!)

useEffect flow (after — fixed):
  onAuthStateChange → fetchProfile → setLoading(false)  ← single call
  getSession() called only to trigger INITIAL_SESSION event
```

## Steps
1. Rewrite the `useEffect` in `AuthProvider`: subscribe to `onAuthStateChange` first, handle `setLoading(false)` inside it, and call `getSession()` only to trigger the initial event
2. Verify login flow renders dashboard correctly

