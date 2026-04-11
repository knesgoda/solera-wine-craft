

# Paddle Webhook Tier Enforcement Test Script

## Goal
Create a Node.js script that simulates Paddle webhook events, posts them to the deployed edge function with valid HMAC signatures, verifies DB state after each event, and outputs results to `/scripts/audit/paddle-tier-report.txt`.

## Approach

Create **`scripts/audit/paddle-tier-test.ts`** — a standalone Deno/Node script run via `code--exec` that:

1. **Reads secrets** from env (`PADDLE_NOTIFICATION_WEBHOOK_SECRET` via `fetch_secrets`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`)
2. **Creates a test org** in the DB (or reuses an existing test org) to receive tier updates
3. **For each test scenario**, constructs a Paddle webhook payload, signs it with HMAC-SHA256 in `ts=...;h1=...` format, and POSTs to the deployed `paddle-webhook` edge function
4. **After each POST**, queries the `organizations` table to verify `tier` and `subscription_status` updated correctly
5. **Tests tier-gated access** by calling Supabase RPC/queries as the test org to check if Growth-only tables are accessible (this will confirm the gap that gating is UI-only)
6. **Outputs** a structured report to `/scripts/audit/paddle-tier-report.txt`

## Test Scenarios

| # | Event | Price ID | Expected Tier | Expected Status |
|---|---|---|---|---|
| 1 | `subscription.created` (Pro) | `pri_01kmdx9xd7y43185qppke728d9` | `small_boutique` | `active` |
| 2 | `subscription.updated` (→ Growth) | `pri_01kmdxcs28byfa4q5ye3kh1xj3` | `mid_size` | `active` |
| 3 | `subscription.updated` (→ Enterprise) | `pri_01kmdxkejxc2bssknbrm9phj48` | `enterprise` | `active` |
| 4 | `subscription.updated` (Growth→Pro downgrade) | `pri_01kmdx9xd7y43185qppke728d9` | `small_boutique` | `active` |
| 5 | `subscription.canceled` | — | `hobbyist` | `canceled` |

## Implementation Details

- **Signing**: Use Node.js `crypto.createHmac('sha256', secret)` to produce the `h1` hex digest, with `ts` set to current unix timestamp
- **Endpoint**: POST to `https://vibdxsntxwrepnkrlbdw.supabase.co/functions/v1/paddle-webhook`
- **DB verification**: Use `@supabase/supabase-js` with service role key to query `organizations` table after each event
- **Test org setup**: Insert a temporary org with a known UUID, then clean it up at the end
- **Tier gate check**: After downgrade to Pro, attempt to query `cost_entries` (Growth-gated) as the test org — document whether RLS blocks it or not

## Files

| File | Action |
|---|---|
| `scripts/audit/paddle-tier-test.ts` | Create — the test script |
| `scripts/audit/paddle-tier-report.txt` | Generated output |

No codebase or database changes — this is a read-only audit script.

