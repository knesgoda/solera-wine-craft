## Gap Closure Plan

### Part 1 — BlockDetail spacing fields (no migration)

Verified: `vine_spacing_ft`, `row_spacing_ft`, `year_planted` already exist on `public.blocks`. **Skip migration.**

**File:** `src/pages/operations/BlockDetail.tsx`

1. Extend `emptyEditForm` with `vine_spacing_ft: ""`, `row_spacing_ft: ""`, `year_planted: ""`.
2. In `startEdit`, prefill from block (cast via `as any` since types.ts may be stale until next regen).
3. In `updateBlock` mutation payload: parse spacing as `parseFloat`, year as `parseInt`, send `null` when empty.
4. Add three inputs after Row Orientation in the edit dialog, each with `HelpTooltip`:
   - Vine Spacing (ft) — `step=0.5 min=1`
   - Row Spacing (ft) — `step=0.5 min=1`
   - Year Planted — `min=1900 max={current year}`
5. Add three `InfoRow` displays in the Viticulture card (after Acres) with the same tooltips, formatted `"{val} ft"` and bare year. Only render when non-null (InfoRow already guards on falsy).

### Part 2 — Wire GDD + Estimated Harvest Date InfoRows

**File:** `src/pages/operations/BlockDetail.tsx`

`useHarvestPrediction(blockId, vineyardId)` already returns `currentGdd` and `predictedDate`. `HarvestWindowCard` calls it; React Query dedupes the same query key, so calling it again in BlockDetail adds zero network cost.

1. Import `useHarvestPrediction` from `@/hooks/useHarvestPrediction`.
2. Call `const { data: prediction } = useHarvestPrediction(blockId, vineyardId);` at top level.
3. Add two `InfoRow`s in the Viticulture card (after Year Planted), each guarded on non-null:
   - "GDD Accumulation" → `${currentGdd} GDD` — tooltip about April 1 baseline.
   - "Estimated Harvest Date" → `format(predictedDate, "MMMM d, yyyy")` — tooltip about Brix trajectory + GDD basis.

### Part 3 — Task list priority + type badges

**File:** `src/pages/tasks/TaskList.tsx` (single task list — Dashboard reuses Task counts only, not cards)

1. Extend `TaskRow` type with `priority: string | null` and `task_type: string | null`.
2. Add `PRIORITY_BORDER` map: `low → border-l-gray-300`, `medium → border-l-blue-400`, `high → border-l-orange-400`, `critical → border-l-red-500`. Default `medium`.
3. In `renderTask`, apply `border-l-4 ${PRIORITY_BORDER[priority ?? "medium"]}` to the Card.
4. Inline below the title row: render `<Badge variant="secondary" className="text-xs">{capitalize(task_type.replace(/_/g, " "))}</Badge>` only when `task_type` is non-null.
5. No changes to click handler, status logic, or filters.

Static Tailwind classes (per Core memory) — no template-literal color interpolation.

### Final Verification

After implementation:
1. `rg -c "HelpTooltip content=" src/` summed total.
2. `rg -o 'content="[^"]{301,}"' src/` — confirm zero hits.
3. Confirm no TypeScript errors.
4. Confirm spacing columns present in DB (already verified ✓).
