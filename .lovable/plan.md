

# Fix: Waitlist Form RLS Error

## Root Cause

In `src/pages/ComingSoon.tsx` (line 40-48), the insert chains `.select().single()`:

```typescript
const { data, error: insertError } = await supabase
  .from("waitlist_signups")
  .insert({ ... })
  .select()    // ← requires SELECT permission
  .single();   // ← requires SELECT permission
```

The SELECT RLS policy on `waitlist_signups` only allows authenticated users with the `owner` role. Anonymous visitors (all waitlist submitters) can INSERT but cannot SELECT, so the chained `.select().single()` triggers an RLS violation that surfaces as the generic error.

## Fix

Remove `.select().single()` from the insert call. The only reason it exists is to pass `data.created_at` to the notification function — we can use `new Date().toISOString()` instead.

### File: `src/pages/ComingSoon.tsx`

**Change lines 40-48 from:**
```typescript
const { data, error: insertError } = await supabase
  .from("waitlist_signups")
  .insert({
    first_name: firstName,
    email: email.trim().toLowerCase(),
    operation_type: operationType,
  })
  .select()
  .single();
```

**To:**
```typescript
const { error: insertError } = await supabase
  .from("waitlist_signups")
  .insert({
    first_name: firstName,
    email: email.trim().toLowerCase(),
    operation_type: operationType,
  });
```

**Change line 67 (`created_at` in notification body) from:**
```typescript
created_at: data.created_at,
```

**To:**
```typescript
created_at: new Date().toISOString(),
```

No database or RLS changes needed. One file, two small edits.

