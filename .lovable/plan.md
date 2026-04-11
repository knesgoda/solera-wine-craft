

# Cascade Deletion Integration Test — Plan

## Overview

Deploy a temporary edge function (`cascade-delete-test`) that creates a full winery record tree, deletes the org, and verifies all children are correctly cascade-deleted or that NO ACTION constraints properly block deletion (requiring explicit cleanup first).

## Discovered FK Delete Rules

From the schema analysis:

**CASCADE from organizations:**
vineyards, profiles, vintages, tasks, ttb_additions, import_jobs, barrels, fermentation_vessels, blending_trials, weather_readings, ai_conversations, anomaly_flags, cost_entries (via vintages), commerce7_config, winedirect_config, shopify_config, integration_sync_logs, client_orgs

**NO ACTION from organizations (will block delete):**
alert_rules, notifications, harvest_alerts_sent (via org_id), google_sheet_connections, saved_reports, analog_vintages, customers, orders, wine_clubs, club_members, club_shipments, ttb_bond_info, ttb_reports, sso_configs, facilities, webhook_subscriptions, public_ratings_config, storefront_config, inventory_adjustments

**CASCADE chain:** org → vineyards → blocks → (vintages SET NULL block_id, tasks SET NULL, harvest_alerts_sent CASCADE)
**CASCADE chain:** org → vintages → lab_samples, ttb_additions, cost_entries, lot_cost_summaries, anomaly_flags, harvest_alerts_sent

## Test Logic

1. **Seed** a full tree using service-role:
   - Organization "Cascade Test Winery"
   - Vineyard → 3 blocks
   - 3 vintages (one per block)
   - 2 lab_samples per vintage (6 total)
   - 3 alert_rules
   - 2 notifications
   - 1 fermentation_vessel + 1 fermentation_log

2. **Pre-delete cleanup** of NO ACTION children (alert_rules, notifications) — this mirrors what app code must do

3. **Delete the org**

4. **Verify** each table:
   - CASCADE tables: count = 0 for seeded IDs
   - Confirm no dangling FKs by querying each child table for the deleted org_id

5. **Report** results to `scripts/audit/cascade-delete-report.txt`

## Files

| File | Action |
|---|---|
| `supabase/functions/cascade-delete-test/index.ts` | Create (temporary) |
| `scripts/audit/cascade-delete-report.txt` | Generated output |

## Cleanup
- The test org is deleted as part of the test itself
- The test user is deleted via `auth.admin.deleteUser`
- The edge function is removed after execution

## Report Format
```
═══════════════════════════════════════════════════════════
  CASCADE DELETION TEST REPORT
  {timestamp}
═══════════════════════════════════════════════════════════

Seeded Records:
  Organization: {id}
  Vineyards: 1 | Blocks: 3 | Vintages: 3
  Lab Samples: 6 | Alert Rules: 3 | Notifications: 2

Pre-delete cleanup (NO ACTION tables):
  alert_rules:    3 deleted ✅
  notifications:  2 deleted ✅

Post-delete verification:
  organizations:         0 remaining ✅ CASCADE
  vineyards:             0 remaining ✅ CASCADE
  blocks:                0 remaining ✅ CASCADE (via vineyards)
  vintages:              0 remaining ✅ CASCADE
  lab_samples:           0 remaining ✅ CASCADE (via vintages)
  fermentation_vessels:  0 remaining ✅ CASCADE
  fermentation_logs:     0 remaining ✅ CASCADE (via vessels)
  profiles:              0 remaining ✅ CASCADE

Dangling FK check:
  No orphaned records found ✅

Overall: ALL PASSED
```

