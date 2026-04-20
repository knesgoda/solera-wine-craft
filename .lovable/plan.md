

## Ask Solera AI Handler Diagnostic

**File:** `supabase/functions/ask-solera/index.ts`

### 1. Org-specific data injected into the system prompt

The `buildWineryContext()` function (lines 10–252) injects:

- Organization name, type, tier
- Active vintages (planned, in_progress, harvested, in_cellar) with latest lab data per vintage — Brix, pH, TA, VA, Free/Total SO₂, Alcohol, RS
- Vineyards and active blocks (variety, clone, rootstock, lifecycle stage, acres) plus latest cumulative GDD per vineyard
- Fermentation vessels (material, capacity, current contents) with latest fermentation log (Brix, temp)
- Filled barrels grouped by cooperage/toast/type
- Tasks: open/overdue and recently completed (last 30 days)
- Weather summary (last 30 days): avg high/low, precip, GDD accumulated
- TTB additions (last 30 days)
- Recent lab samples (last 10)
- Active alert rule thresholds
- Unresolved anomaly flags (last 10)

All injected into the **system** field of the Anthropic request (line 316), not the user message.

### 2. Cross-org data leakage risk — SAFE

The handler establishes the org boundary correctly:
- Auth header verified via `anonClient.auth.getUser()` (line 269) — rejects unauthenticated requests
- `profile.org_id` looked up from the authenticated user (lines 276–281)
- Throws if no org is found (line 281)
- Every query in `buildWineryContext` filters by either `.eq("org_id", orgId)` directly OR `.in("vintage_id", vintageIds)` / `.in("vineyard_id", vineyards.map(...))` where the parent IDs were themselves scoped to `orgId` first

The function uses the **service role client** to bypass RLS, so isolation depends entirely on the explicit org filters in code. I checked all 12 queries — every one is scoped. No leakage path found.

Minor note: `req.json()` accepts a `conversationId` (line 283) but never validates it belongs to `profile.org_id`. It is currently only logged, not queried, so no leakage today, but if conversation history is ever loaded by ID it would need an org check.

### 3. Model string

`"claude-sonnet-4-20250514"` (line 314) — Claude Sonnet 4

### 4. max_tokens

`4096` (line 315)

### 5. Anthropic API key storage

Env var: `Deno.env.get("ANTHROPIC_API_KEY")` (line 286). Confirmed present in the project secrets list. **Not** in Supabase Vault — stored as a standard Edge Function secret, which is the standard pattern for this project (matches `RESEND_API_KEY`, `PADDLE_API_KEY`, etc.).

### Summary

| Check | Result |
|---|---|
| Org-data injection | ✅ Comprehensive (12 data domains) |
| Cross-org leakage | ✅ Safe — every query scoped to authenticated org |
| Model | `claude-sonnet-4-20250514` |
| max_tokens | `4096` |
| API key storage | Edge Function env var (`ANTHROPIC_API_KEY`) |

No fixes required.

