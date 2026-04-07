

# Fix: Login Hangs Forever

## Root Cause

The `AuthContext` has a known race condition: it only uses `onAuthStateChange` without first calling `supabase.auth.getSession()`, AND it `await`s `fetchProfile()` inside the `onAuthStateChange` callback. Per Supabase docs, awaiting async work inside `onAuthStateChange` can cause deadlocks — the auth state change queue blocks until the callback completes, which prevents subsequent auth events from processing.

The `loading` flag starts as `true` and only clears at the end of the callback, so if the callback stalls, the user sees an infinite spinner.

## Fix (single file: `src/contexts/AuthContext.tsx`)

1. **Bootstrap with `getSession()`** — call it first to restore the session from storage, set user/session/loading state immediately
2. **Remove `await` from `onAuthStateChange`** — use a fire-and-forget pattern for `fetchProfile` inside the listener to avoid blocking the auth event queue
3. **Set `loading = false`** after `getSession()` resolves, not inside the listener

```text
useEffect flow (before):
  onAuthStateChange → await fetchProfile → setLoading(false)
  (deadlock-prone, no getSession)

useEffect flow (after):
  getSession → fetchProfile → setLoading(false)
  onAuthStateChange → fetchProfile (fire-and-forget, no await)
```

## Also Fix: forwardRef Console Warnings

The `forwardRef` warnings on `Login` come from React Router internally passing a ref. Wrapping the route `element` prop won't help — these are harmless React Router v6 warnings. No code change needed.

## Steps
1. Rewrite the `useEffect` in `AuthProvider` to call `getSession()` first, then subscribe to `onAuthStateChange`
2. Remove `await` before `fetchProfile` inside the `onAuthStateChange` callback
3. Test login flow end-to-end

