

# Critical Path E2E Test — Plan

## Overview
A single Playwright test file that exercises the core Solera workflow end-to-end: signup, onboarding, vineyard+block creation, lab samples, vintage creation, ripening comparison verification, TTB addition logging, and OW-1 report export. Results are written to `/scripts/audit/critical-path-report.txt`.

## Pre-requisite: Auto-confirm email
The test signs up a fresh user. For this to work without email verification, auto-confirm must be enabled. I will use `cloud--configure_auth` to enable it before running the test (or verify it's already on).

## Test File
**`tests/critical-path.spec.ts`**

### Setup (beforeAll)
- Generate a unique test email: `e2e-critical-{timestamp}@test.solera.dev`
- Password: `TestPass123!`

### Step 1: Sign Up
- Navigate to `/signup`
- Fill: First Name, Last Name, Winery Name, Email, Password
- Click "Create Account"
- Wait for redirect to `/onboarding`
- Screenshot on failure

### Step 2: Complete Onboarding
- Select "Small Boutique" operation type
- Click "Continue"
- On step 2 (modules), ensure "Vineyard Ops", "Vintage Management", and "TTB Compliance" are enabled
- Click "Continue"
- On step 3, click "Launch Solera"
- Wait for redirect to `/dashboard`

### Step 3: Create Vineyard with 3 Blocks
- Navigate to `/operations`
- Click "Add Vineyard"
- Fill name: "Willamette Estate", region: "Willamette Valley", acres: 42
- Submit
- Click into the vineyard
- Add 3 blocks via the "Add Block" dialog:
  1. "Block A" — Pinot Noir, Clone 667, Rootstock 101-14, 8 acres, Bearing stage
  2. "Block B" — Pinot Noir, Clone 667, Rootstock 101-14, 6 acres, Bearing stage
  3. "Block C" — Pinot Noir, Clone 667, Rootstock 101-14, 10 acres, Bearing stage

### Step 4: Create 2025 Vintage for each Block
- Navigate to `/vintages`
- For each block, click "New Vintage" → year 2025, select block, harvest date 2025-09-15, tons harvested 4.2
- Verify 3 vintages appear in the list

### Step 5: Log Lab Samples
- For each vintage, navigate to its detail page
- Click "Add Sample"
- Fill Brix values: Block A → 22.1, Block B → 21.4, Block C → 23.0
- Also fill pH: 3.45, TA: 7.2 for all

### Step 6: Verify Ripening Comparison
- Navigate to `/ripening-comparison`
- Select all 3 blocks in the block selector panel
- Click "Compare"
- Verify all 3 blocks render with their Brix values visible (22.1, 21.4, 23.0)

### Step 7: Log TTB Addition
- Navigate back to first vintage detail
- Click the "TTB" tab
- Click "Add" to open the NewAdditionDialog
- Type: SO₂, Amount: 50, Unit: mL, TTB Code: optional
- Save and verify it appears in the table

### Step 8: TTB OW-1 Export
- Navigate to `/compliance/reports`
- Click "New Report"
- Set period start: 2025-01-01, end: 2025-12-31
- Click "Auto-Calculate"
- Click save/create
- Click "Generate PDF" on the created report
- Verify the function invocation succeeds (toast or report status updates to "ready")

### Failure Handling
- Each step wrapped in a try/catch that takes a screenshot on failure
- Results written to `/scripts/audit/critical-path-report.txt` with PASS/FAIL per step
- Test exits non-zero if any step fails

### Cleanup
- afterAll: use Supabase service role client to delete the test user and associated org (via `auth.admin.deleteUser`)

## Files to Create/Modify

| File | Action |
|---|---|
| `tests/critical-path.spec.ts` | Create — the full E2E test |
| `scripts/audit/critical-path-report.txt` | Generated output |

## Technical Notes
- The `NewVintageDialog` only allows selecting one block per vintage, so we create 3 separate vintages
- The RipeningComparison page requires `comparing && blockIds.length >= 2` to fetch data, so we must select 2+ blocks and click compare
- The ripening page finds vintages by `block_id`, so our vintages with `block_id` set will be found automatically
- The OW-1 auto-calculate uses `tons_harvested` × 170 gal/ton, so our 3 vintages with 4.2 tons each = ~2142 gallons produced — this will work
- Screenshot paths will use the step name for easy debugging

