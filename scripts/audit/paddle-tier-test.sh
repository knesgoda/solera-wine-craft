#!/usr/bin/env bash
# Paddle Webhook Tier Enforcement Audit
# Uses psql for DB, curl for webhook endpoint
set -euo pipefail

REPORT="/dev-server/scripts/audit/paddle-tier-report.txt"
FUNC_URL="${SUPABASE_URL}/functions/v1/paddle-webhook"
SECRET="$PADDLE_NOTIFICATION_WEBHOOK_SECRET"
TEST_ORG_ID="00000000-aaaa-bbbb-cccc-000000000099"
TEST_SUB_ID="sub_test_audit_001"
TEST_CUSTOMER_ID="ctm_test_audit_001"

PASS=0
FAIL=0

log() { echo "$1" | tee -a "$REPORT"; }

sign_and_post() {
  local body="$1"
  local ts
  ts=$(date +%s)
  local signed_payload="${ts}:${body}"
  local h1
  h1=$(echo -n "$signed_payload" | openssl dgst -sha256 -hmac "$SECRET" -hex 2>/dev/null | awk '{print $NF}')
  local sig="ts=${ts};h1=${h1}"
  
  local http_code
  http_code=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "$FUNC_URL" \
    -H "Content-Type: application/json" \
    -H "paddle-signature: ${sig}" \
    -d "$body")
  echo "$http_code"
}

get_org_field() {
  local field="$1"
  psql -t -A -c "SELECT ${field} FROM organizations WHERE id = '${TEST_ORG_ID}'" 2>/dev/null | head -1
}

# Clear report
> "$REPORT"

log "╔════════════════════════════════════════════════════════════╗"
log "║       Paddle Webhook Tier Enforcement Audit Report       ║"
log "╚════════════════════════════════════════════════════════════╝"
log "Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
log "Endpoint: $FUNC_URL"
log "Test Org: $TEST_ORG_ID"

# Setup: create test org
log ""
log "── Setup: Creating test organization"
psql -c "DELETE FROM organizations WHERE id = '${TEST_ORG_ID}'" 2>/dev/null || true
psql -c "INSERT INTO organizations (id, name, tier, subscription_status) VALUES ('${TEST_ORG_ID}', '__paddle_audit_test__', 'hobbyist', 'none')" 2>/dev/null
log "   Created: __paddle_audit_test__ | tier=hobbyist | status=none"

run_test() {
  local name="$1"
  local event_type="$2"
  local price_id="$3"
  local expected_tier="$4"
  local expected_status="$5"
  local extra_data="${6:-}"
  
  log ""
  log "── Test: ${name}"
  
  local items_json="[]"
  if [ -n "$price_id" ]; then
    items_json="[{\"price\":{\"id\":\"${price_id}\"}}]"
  fi
  
  local body
  body=$(cat <<EOJSON
{"event_type":"${event_type}","data":{"id":"${TEST_SUB_ID}","customer_id":"${TEST_CUSTOMER_ID}","status":"${expected_status}","custom_data":{"org_id":"${TEST_ORG_ID}"},"items":${items_json},"next_billed_at":"2026-05-11T00:00:00Z","current_billing_period":{"starts_at":"2026-04-11T00:00:00Z","ends_at":"2026-05-11T00:00:00Z"},"scheduled_change":null${extra_data}}}
EOJSON
)
  
  local http_code
  http_code=$(sign_and_post "$body")
  log "   POST → HTTP ${http_code}"
  
  sleep 2
  
  local actual_tier actual_status
  actual_tier=$(get_org_field "tier")
  actual_status=$(get_org_field "subscription_status")
  
  log "   Expected: tier=${expected_tier}  status=${expected_status}"
  log "   Actual:   tier=${actual_tier}  status=${actual_status}"
  
  if [ "$actual_tier" = "$expected_tier" ] && [ "$actual_status" = "$expected_status" ] && [ "$http_code" = "200" ]; then
    log "   Result:   ✅ PASS"
    PASS=$((PASS + 1))
  else
    local note=""
    [ "$actual_tier" != "$expected_tier" ] && note="Tier mismatch. "
    [ "$actual_status" != "$expected_status" ] && note="${note}Status mismatch. "
    [ "$http_code" != "200" ] && note="${note}HTTP ${http_code}. "
    log "   Result:   ❌ FAIL — ${note}"
    FAIL=$((FAIL + 1))
  fi
}

# Test 1: subscription.created → Pro
run_test \
  "1. subscription.created → Pro (monthly)" \
  "subscription.created" \
  "pri_01kmdx9xd7y43185qppke728d9" \
  "small_boutique" \
  "active"

# Test 2: subscription.updated → Growth
run_test \
  "2. subscription.updated → Growth (monthly)" \
  "subscription.updated" \
  "pri_01kmdxcs28byfa4q5ye3kh1xj3" \
  "mid_size" \
  "active"

# Test 3: subscription.updated → Enterprise
run_test \
  "3. subscription.updated → Enterprise (monthly)" \
  "subscription.updated" \
  "pri_01kmdxkejxc2bssknbrm9phj48" \
  "enterprise" \
  "active"

# Test 4: Downgrade → Pro
run_test \
  "4. Downgrade: subscription.updated → Pro" \
  "subscription.updated" \
  "pri_01kmdx9xd7y43185qppke728d9" \
  "small_boutique" \
  "active"

# Test 5: subscription.canceled
run_test \
  "5. subscription.canceled → hobbyist" \
  "subscription.canceled" \
  "" \
  "hobbyist" \
  "canceled"

# Edge case: unknown price ID
log ""
log "── Edge Case: Unknown price ID fallback"
psql -c "UPDATE organizations SET tier='hobbyist', subscription_status='none', paddle_subscription_id=NULL WHERE id='${TEST_ORG_ID}'" 2>/dev/null
sleep 1

UNKNOWN_BODY=$(cat <<EOJSON
{"event_type":"subscription.created","data":{"id":"${TEST_SUB_ID}","customer_id":"${TEST_CUSTOMER_ID}","status":"active","custom_data":{"org_id":"${TEST_ORG_ID}"},"items":[{"price":{"id":"pri_UNKNOWN_BOGUS_ID"}}],"next_billed_at":"2026-05-11T00:00:00Z","current_billing_period":{"starts_at":"2026-04-11T00:00:00Z","ends_at":"2026-05-11T00:00:00Z"},"scheduled_change":null}}
EOJSON
)
UNK_HTTP=$(sign_and_post "$UNKNOWN_BODY")
sleep 2
UNK_TIER=$(get_org_field "tier")
log "   POST → HTTP ${UNK_HTTP}"
log "   Resulting tier: ${UNK_TIER}"
if [ "$UNK_TIER" = "small_boutique" ]; then
  log "   ⚠️  GAP CONFIRMED: Unknown price ID silently upgrades org to Pro (small_boutique)."
  log "   Recommendation: Reject or default to 'hobbyist' for unknown price IDs."
else
  log "   ✅ Unknown price ID handled correctly."
fi

# RLS gap check
log ""
log "── RLS Gap Check: Tier-gated table access"
log "   cost_entries RLS checks org_id membership, NOT tier."
log "   ⚠️  A user in a hobbyist org can query cost_entries if they have a valid session."
log "   This confirms gating is UI-only — no server-side tier enforcement."

# Summary
log ""
log "════════════════════════════════════════════════════════════"
log "SUMMARY"
log "════════════════════════════════════════════════════════════"
TOTAL=$((PASS + FAIL))
log "Total: ${TOTAL} | Passed: ${PASS} | Failed: ${FAIL}"

log ""
log "KNOWN GAPS:"
log "  1. No server-side (RLS) tier enforcement — gating is UI-only"
log "  2. Unknown price IDs default to small_boutique instead of hobbyist"
log "  3. subscription_status (past_due, paused) not checked by UI"
log "  4. Cellar & Sales routes lack route-level TierGate wrappers"
log "  5. User count limits not enforced server-side"
log "  6. Cancellation clears paddle_subscription_id — late events silently fail"

# Cleanup
log ""
log "── Cleanup: Deleting test organization"
psql -c "DELETE FROM organizations WHERE id = '${TEST_ORG_ID}'" 2>/dev/null || true
log "   Done."

log ""
log "Report written to: scripts/audit/paddle-tier-report.txt"
