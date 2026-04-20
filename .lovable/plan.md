

## Tier Enforcement Diagnostic Report

### 1. The four recognized tier values

Defined in `src/hooks/useTierGate.ts` line 13 and `src/lib/tier-access.ts` line 1:

```ts
TIER_ORDER = ["hobbyist", "small_boutique", "mid_size", "enterprise"]
```

Display names (line 5–10): Hobbyist → **Pro** (small_boutique) → **Growth** (mid_size) → Enterprise.

The DB function `org_has_tier(_org_id, _min_tier)` (in `db-functions`) recognizes the same four values.

### 2. Client-side vs server-side enforcement

**Both, but unevenly.**

- **Client-side** — `useTierGate` hook + `<TierGate>` / `<GrowthTierGate>` wrappers in `src/App.tsx` routes and component-level checks. Reads `organization.tier` + `subscription_status` from `AuthContext`. Falls back to `"hobbyist"` if subscription is not `active` / `trialing` (`useTierGate.ts` lines 25–29).
- **Server-side (RLS)** — implemented for Growth-tier (`mid_size`) tables only, in migration `20260411071545_*.sql`. Covers exactly these tables, all gated to `mid_size`:
  - `cost_entries`, `cost_categories`, `lot_cost_summaries`
  - `blending_trials`, `blending_trial_lots`
  - (19 policies total, all using `org_has_tier(org_id, 'mid_size')`)
- **No server-side tier check** exists on Pro-tier tables (`skus`, `orders`, `customers`, `wine_clubs`, `club_shipments`, `inventory_items`, `fermentation_vessels`, `barrels`) or on Enterprise tables (`growers`, `grower_contracts`, `weigh_tags`, `audit_logs`, `facilities`, `sso_*`).
- **Edge functions** — `paddle-webhook` is the source of truth for setting `organizations.tier`, but per-request edge functions (e.g. `extract-handwritten-notes`, `generate-ttb-report`, `ask-solera`) do **not** re-validate tier before doing work.

### 3. Three Pro-or-higher (`small_boutique`+) gates — exact locations

| Feature | File | Line | Gate |
|---|---|---|---|
| Cellar Management (route) | `src/App.tsx` | **189** | `<TierGate requiredTier="small_boutique" featureName="Cellar Management"><CellarDashboard /></TierGate>` |
| Inventory Management (route) | `src/App.tsx` | **206** | `<TierGate requiredTier="small_boutique" featureName="Inventory Management"><InventoryList /></TierGate>` |
| Wine Club (route) | `src/App.tsx` | **212** | `<TierGate requiredTier="small_boutique" featureName="Wine Club"><ClubList /></TierGate>` |

Bonus Pro gate inside a component: `src/components/import/QuickCaptureDialog.tsx` line 26 (`useTierGate("small_boutique")`) — gates the multi-page scan toggle for handwritten imports.

### 4. URL manipulation risk — Hobbyist accessing Pro features

**Yes, a partial gap exists for Pro-tier (`small_boutique`) features only.** Growth (`mid_size`) tables are safe.

#### Safe (defense in depth):
- All `mid_size+` features (Cost tracking, Blending trials, Reports Builder, Analog Explorer, Ask Solera). Even if a Hobbyist bypasses `<GrowthTierGate>`, the RLS policy `org_has_tier(org_id, 'mid_size')` rejects every SELECT/INSERT/UPDATE/DELETE. The page would render an empty shell, no data leakage or writes.

#### Vulnerable (client-side gate only):
A determined Hobbyist who bypasses the `<TierGate requiredTier="small_boutique">` React wrapper (e.g. by editing the bundle, monkey-patching `useTierGate`, or directly calling Supabase from devtools) **could** read/write the following tables, because their RLS only checks `org_id`, not tier:

- `/cellar`, `/cellar/vessels/*`, `/cellar/barrels`, `/cellar/blending` → `fermentation_vessels`, `barrels` tables
- `/inventory`, `/inventory/:skuId` → `skus`, `sku_inventory` tables
- `/orders`, `/customers` → `orders`, `customers` tables
- `/club`, `/club/:clubId`, `/club/shipments` → `wine_clubs`, `club_memberships`, `club_shipments` tables

Note: this requires bypassing the React UI; the routes themselves render the gate component on normal navigation. But there is no server-side trapdoor.

#### Enterprise-tier gaps:
Same pattern — `/growers/*`, `/settings/sso`, `/settings/api`, `/settings/audit`, `/settings/facilities`, `/settings/alerts/sms` all use `<TierGate requiredTier="enterprise">` but the underlying tables (`growers`, `grower_contracts`, `weigh_tags`, `audit_logs`, `facilities`, `sso_configurations`, `sms_settings`) have RLS scoped only to `org_id`, not tier.

### Summary table

| Tier | Client gate | Server RLS tier check | URL-bypass safe? |
|---|---|---|---|
| Pro (`small_boutique`) | ✅ `<TierGate>` on 11 routes | ❌ None | ⚠️ No |
| Growth (`mid_size`) | ✅ `<GrowthTierGate>` on 7 routes | ✅ 19 policies | ✅ Yes |
| Enterprise | ✅ `<TierGate>` on 14 routes | ❌ None | ⚠️ No |

### Recommended fix (not applied — diagnostic only)

Add migrations modelled on `20260411071545_*.sql` that wrap RLS policies on Pro-tier and Enterprise-tier tables with `org_has_tier(org_id, 'small_boutique')` and `org_has_tier(org_id, 'enterprise')` respectively. This closes the URL/devtools bypass without changing any client code.

One-line example for `skus`:
```sql
CREATE POLICY "Users can view skus" ON public.skus
  FOR SELECT TO authenticated
  USING (org_id = get_user_org_id(auth.uid()) AND org_has_tier(org_id, 'small_boutique'));
```

