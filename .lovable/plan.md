# Fix Remaining Audit Issues

The previous round patched HIGH/MEDIUM security findings. Two leftover items remain from the audit reports.

## 1. Invalid Anthropic Model ID (HIGH — runtime failure)

Same bug we fixed in `ask-solera`, still present in 4 other edge functions. The string `claude-sonnet-4-6` is not a valid Anthropic model identifier and will return a 404/400 from the Anthropic API at runtime. This means these features are silently broken in production.

**Files to patch** — replace `"claude-sonnet-4-6"` with `"claude-sonnet-4-20250514"` (the canonical ID per `mem://tech/ai-integration`):

- `supabase/functions/weekly-summary/index.ts:126` — weekly AI summary email/notification
- `supabase/functions/analog-insight/index.ts:101` — Vintage Analog Explorer insights
- `supabase/functions/suggest-mapping/index.ts:555` — CSV/Excel column mapper
- `supabase/functions/extract-handwritten-notes/index.ts:106` — handwritten notes OCR

No other logic changes. One-line edit per file. Functions will be auto-deployed.

## 2. Stale Secrets Audit Report (LOW — housekeeping)

`scripts/audit/secrets-report.txt` flags a CRITICAL for `src/_test_secret_canary.ts`, but that file no longer exists in the repo (verified via `ls`). The remaining warnings (`paddle-client.ts`) are false positives — `VITE_PADDLE_CLIENT_TOKEN` is intentionally a publishable client-side token, safe to expose.

**Action:** Re-run `scripts/secrets-audit.sh` to regenerate a clean report. No code changes.

## Out of Scope

- The original audit's "deprecate `generate-coa`" recommendation was kept for backward compatibility per the prior decision — leaving as-is.
- No new schema changes, no UI changes, no package additions.

## Verification

- [ ] `rg "claude-sonnet-4-6" supabase/` returns zero results
- [ ] Weekly summary, analog insight, mapping, and handwritten-notes flows complete without 4xx from Anthropic
- [ ] Secrets audit report no longer references the deleted canary file
