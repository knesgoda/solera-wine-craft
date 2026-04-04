

# 9 Commits to Production Readiness

## Commit 1 — Security: Org-scoped blend trial query
**File:** `src/lib/blendCostPropagation.ts`
- Add `.eq("org_id", orgId)` to the `blending_trials` query at line 64 in `propagateBlendCosts`
- Same fix in `previewBlendCosts` (line ~163) and `reverseBlendCosts` if applicable
- Also add org_id scoping to the idempotency check query (line 43-47)

## Commit 2 — Auth failure modes
**Files:** `src/contexts/AuthContext.tsx`, `src/components/ProtectedRoute.tsx`
- AuthContext: Add `authError: string | null` state. Set it on profile/org fetch failures instead of just console.error. Expose via context.
- ProtectedRoute: Add a `useEffect` with a 6-second timeout. If `!organization && profile?.org_id` persists beyond 6s, show an error card with a Retry button that calls `refreshProfile()` instead of infinite spinner.

## Commit 3 — Replace 5 confirm() dialogs with AlertDialog
**Files:** `WeighTagForm.tsx`, `ContractForm.tsx`, `AlertSettings.tsx`, `GoogleSheetsSettings.tsx`, `BlogAdmin.tsx`
- Each file: add `useState` for confirmation dialog visibility, replace `confirm(...)` with `setShowConfirm(true)`, render an `AlertDialog` with Cancel/Confirm actions. All 5 files already import or can import from `@/components/ui/alert-dialog`.

## Commit 4 — CustomerList pagination
**File:** `src/pages/customers/CustomerList.tsx`
- Add `page` state (default 0), `pageSize = 50`
- Add `.range(page * pageSize, (page + 1) * pageSize - 1)` and `{ count: "exact" }` to the query (matching GrowerList pattern)
- Add Prev/Next buttons below the table, disabled at boundaries

## Commit 5 — VesselDetail date crash guard
**File:** `src/pages/cellar/VesselDetail.tsx`
- Wrap the 3 `parseISO(log.logged_at)` calls (lines ~156, ~168, ~280) in try-catch or use a safe helper: `const safeParse = (d: string) => { try { return parseISO(d); } catch { return new Date(); } };`
- Apply to chart data mapping, log editing, and log display

## Commit 6 — AppSidebar accessibility
**File:** `src/components/AppSidebar.tsx`
- On the locked nav group div (line ~196): add `role="group"`, `aria-disabled="true"`, `aria-label={groupLabel + " - locked, upgrade required"}`
- On the Lock icon (line ~197): add `aria-hidden="true"`

## Commit 7 — Server-side user limit enforcement
**File:** `supabase/functions/invite-client/index.ts`
- After loading `clientOrg`, load the parent org's tier and check against tier limits (e.g., `{ hobbyist: 2, small_boutique: 5, mid_size: 20, enterprise: Infinity }`)
- Count existing `client_invite_tokens` where `used_at IS NULL AND expires_at > now()` for duplicate/limit checks
- Return 403 with clear message if limit exceeded or duplicate pending invite exists

## Commit 8 — Test coverage for pure-logic modules
**New files:** `src/lib/__tests__/tier-access.test.ts`, `src/lib/__tests__/units.test.ts`, `src/lib/__tests__/timezone.test.ts`, `src/lib/__tests__/blendCostPropagation.test.ts`
- tier-access: test all tier combinations, invalid tiers return false
- units: test conversion functions for metric/imperial
- timezone: test formatInOrgTz with various zones
- blendCostPropagation: mock supabase client, test idempotency, depth limit, ratio math, reversal
- Use existing Vitest setup, no new dependencies

## Commit 9 — Progressive `as any` reduction
**Files:** `ContractDetail.tsx`, `ContractForm.tsx`, `CostOverview.tsx`, `VesselDetail.tsx`, `AlertSettings.tsx`, `blendCostPropagation.ts`
- Import `Database` from `@/integrations/supabase/types`
- Define type aliases like `type CostEntry = Database["public"]["Tables"]["cost_entries"]["Row"]`
- Replace `data as any[]` and `(comp as any)` with proper typed selects
- The 5,119-line types.ts already has full types for all tables

---

**Execution order:** Commits 1 (security) and 2 (auth) first as they're highest priority. Then 3-7 in parallel batches. 8 and 9 last since they're quality improvements.

