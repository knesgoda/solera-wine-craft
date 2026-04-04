

# Security Deep Dive — Remaining Findings

After running a fresh security scan and reviewing all 87 tables, 18 storage policies, and every RLS rule, here's what's left to fix. The previous rounds caught the big ones — storage org-scoping, client_invite_tokens, and realtime are all resolved. These are the remaining gaps.

---

## 1. CRITICAL — user_roles cross-org privilege escalation

The `user_roles` INSERT/UPDATE/DELETE policies only check `has_role(auth.uid(), 'owner')` with **no org scoping**. A winery owner can assign roles to users in other organizations — including making themselves an owner of another org.

The `user_roles` table has no `org_id` column, so the fix requires joining through `profiles` to verify both the caller and the target user belong to the same org.

**Fix:** Replace the three write policies with org-scoped versions:
```sql
-- INSERT: owner can only assign roles to users in same org
WITH CHECK (
  has_role(auth.uid(), 'owner')
  AND (SELECT org_id FROM profiles WHERE id = user_id)
    = get_user_org_id(auth.uid())
)
```
Same pattern for UPDATE (USING + WITH CHECK) and DELETE (USING).

---

## 2. MEDIUM — Unlimited anonymous vote stuffing on roadmap_votes

The INSERT policy is `WITH CHECK (true)` for `{anon, authenticated}`. Anyone can insert unlimited vote rows — no IP uniqueness, no rate limit at the database level. The `increment_roadmap_votes` trigger fires on every insert, inflating counts.

**Fix:** Add a unique constraint `(item_id, voter_ip)` to prevent duplicate votes per IP. The INSERT policy can stay anonymous since it's a public-facing feature, but the constraint prevents stuffing.

---

## 3. MEDIUM — voter_ip (PII) exposed via public SELECT

The `roadmap_votes` SELECT policy is `USING (true)` for `{anon, authenticated}`, exposing all voter IP addresses. This is a GDPR/CCPA concern.

**Fix:** Drop the public SELECT policy on `roadmap_votes` entirely. The vote *count* is already stored on `roadmap_items.votes` (incremented by trigger), so clients never need to read the `roadmap_votes` table directly.

---

## 4. LOW — Missing DELETE policies on ttb-reports and store-assets buckets

Both buckets have INSERT, UPDATE, and SELECT policies with proper org-scoping, but no DELETE policy. Users can upload and update files but can never delete them through the API.

**Fix:** Add org-scoped DELETE policies matching the existing INSERT patterns.

---

## 5. LOW — Leaked password protection (HIBP) still disabled

This was noted in the previous audit but requires manual enablement.

**Fix:** Enable via Lovable Cloud auth settings.

---

## 6. Runtime Error Fix — MarketingFooter

The `MarketingFooter` was wrapped in `React.forwardRef` in the last commit, but it's not receiving a ref from `MarketingLayout`. The `forwardRef` wrapping may be causing the "Component is not a function" error if the export shape changed. The fix is to verify the default export is correct, or revert to a plain function component since no ref is actually needed.

---

## Execution Plan

1. **Migration 1:** Replace three `user_roles` write policies with org-scoped versions (cross-join through `profiles`)
2. **Migration 2:** Add unique constraint `(item_id, voter_ip)` on `roadmap_votes`; drop the public SELECT policy
3. **Migration 3:** Add DELETE policies for `ttb-reports` and `store-assets` buckets
4. **Code fix:** Fix `MarketingFooter` export to resolve the runtime error
5. **Auth config:** Enable HIBP leaked password check

