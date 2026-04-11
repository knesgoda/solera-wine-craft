

# Alert Integration Test Suite — Plan

## Overview

Deploy a temporary edge function (`alerts-integration-test`) that seeds a test organization with blocks, vintages, vessels, and alert rules, then triggers each of the 4 alert types by calling the actual alert-processing edge functions. After each trigger, verify notifications appeared in the database and emails were attempted via Resend. Results output to `scripts/audit/alerts-report.txt`.

## Architecture

The test uses service-role access to seed data and query results. It calls the real deployed edge functions (`check-harvest-alerts`, `evaluate-alerts`, `detect-anomalies`) to trigger alerts — no mocking.

## Seed Data

| Entity | Details |
|---|---|
| Org | "Stonewall Alert Test Winery", tier: `small_boutique` |
| User | `alert-test-{ts}@test.solera.dev` (auto-confirmed) |
| Vineyard | "Cascade Hills" |
| Blocks | "Hilltop" (Pinot Noir, 667, 101-14), "Creekside" (Pinot Noir, 777, 101-14), "Ridgeline" (Pinot Noir, Pommard, 3309C) |
| Vintages | 2025 in_progress for each block |
| Vessel | "Tank 9" — stainless, 1500L, linked to Hilltop vintage |
| Alert rules | brix ≥ 24 (channel: both), temp_f ≥ 85 (channel: both), ripening_divergence ≥ 4.0 (channel: both) |

## Test Cases

### Test 1: Harvest Window Alert
- **Setup**: Insert 3 lab samples on Hilltop vintage with ascending Brix (22.0, 23.0, 24.5) over 3 days — current Brix ≥ 24 triggers `predictedDays = 0`
- **Trigger**: Call `check-harvest-alerts`
- **Verify**: Notification in `notifications` with `type = 'harvest_window'`, message contains "Hilltop" and "Cascade Hills", deep link contains `/operations/blocks/{block_id}`

### Test 2: Brix Threshold Alert
- **Setup**: Already have brix ≥ 24 rule from seed
- **Trigger**: Call `evaluate-alerts` with `{ type: "lab_sample", record: { vintage_id, brix: 24.5, ph: 3.4, ta: 7.0 } }`
- **Verify**: Notification in `notifications` with `type = 'alert'`, message contains "Brix" and "24.5" and "≥ 24"

### Test 3: Fermentation Temperature Spike
- **Setup**: Already have temp_f ≥ 85 rule
- **Trigger**: Call `evaluate-alerts` with `{ type: "fermentation_log", record: { vessel_id, temp_f: 92 } }`
- **Verify**: Notification with message containing "Temperature" and "92"

### Test 4: Ripening Divergence
- **Setup**: Insert lab samples: Hilltop Brix=24.5, Creekside Brix=20.0, Ridgeline Brix=22.0 — spread of 4.5 > threshold 4.0
- **Trigger**: Call `evaluate-alerts` with `{ type: "lab_sample", record: { vintage_id: ridgeline_vintage_id, brix: 22.0 } }`
- **Verify**: Notification with message containing "divergence", "Pinot Noir", spread value

## Verification Per Alert

1. **In-app notification**: Query `notifications` table for the test user, filtered by `created_at` after test start. Verify message content contains expected keywords.
2. **Email delivery**: Query Resend API (`GET https://api.resend.com/emails?limit=10`) using `RESEND_API_KEY` to check recent emails sent to the test email. If Resend list API not available (it requires specific plan), verify the edge function returned `success: true` / `alertsFired > 0` as proxy for email attempt.
3. **Deep link**: For harvest alerts, verify the notification message or email HTML contains the block path. For divergence, verify link to `/ripening-comparison`. For threshold alerts, verify link to `/dashboard`.

## Report Format

```
═══════════════════════════════════════════════════════════
  SOLERA ALERT INTEGRATION TEST REPORT
  {timestamp}
═══════════════════════════════════════════════════════════

Test 1: Harvest Window Alert
  Notification: ✅ PASS | Contains "Hilltop", "Cascade Hills"
  Email attempt: ✅ PASS | Function returned alertsSent=1
  Deep link: ✅ PASS | Contains /operations/blocks/{id}

Test 2: Brix Threshold Alert
  ...
```

## Known Issue: `link_url` Column

The `evaluate-alerts` function inserts `link_url` into the `notifications` table, but this column does not appear in the generated types. The test will check if the column exists and flag it if missing — deep link verification for threshold/divergence alerts will use the function response and email HTML as fallback.

## Files

| File | Action |
|---|---|
| `supabase/functions/alerts-integration-test/index.ts` | Create (temporary) |
| `scripts/audit/alerts-report.txt` | Generated output |

## Cleanup

- Delete test user via `auth.admin.deleteUser`
- Delete test org (cascades to blocks, vintages, vessels, rules, notifications)
- Remove temp edge function after execution

## Exit Criteria

- All 4 alert types produce in-app notifications: required
- All 4 edge function calls return success (proxy for email attempt): required
- Any FAIL → exit non-zero

