

# Fix: Upgrade Test Organization Tier to Enterprise

## Problem
The organization for `kevin.nesgoda@gmail.com` (org ID `79c55bf1-dd62-44c8-8e03-d91d3648b628`) has `tier = 'hobbyist'` in the `organizations` table. The `useTierGate` hook compares the org tier against required tiers, and since hobbyist is the lowest, all gated features are blocked.

## Fix
Run a single database migration to update the organization tier to `enterprise`, which unlocks everything:

```sql
UPDATE public.organizations
SET tier = 'enterprise'
WHERE id = '79c55bf1-dd62-44c8-8e03-d91d3648b628';
```

## Also Fix: Console Errors
Two `forwardRef` warnings are firing:
1. **Login component** — being passed a ref from `App` but doesn't accept one
2. **LanguageSelector** — same issue inside Login

Both need to either be wrapped in `React.forwardRef` or have the ref removed from where they're rendered.

## Steps
1. **Migration**: Update org tier to `enterprise`
2. **Code fix**: Remove stray refs on `Login` and `LanguageSelector` routes in `App.tsx`, or wrap them in `forwardRef`

