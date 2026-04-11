

# Sentry Integration + Error Reporting Test — Plan

## Current State

- **No Sentry SDK** installed (client or server)
- **No Sentry secrets** configured (`SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_DSN` are all missing)
- `ErrorBoundary` only logs to `console.error` — no external error reporting
- Edge functions have no error tracking beyond console logs

## What's Needed Before the Test Can Work

### Phase 1: Sentry Integration (prerequisite)

1. **Install `@sentry/react`** in the frontend
2. **Initialize Sentry** in `src/main.tsx` with the DSN from environment
3. **Update `ErrorBoundary`** to call `Sentry.captureException()` in `componentDidCatch`
4. **Add user/org context** — after auth, call `Sentry.setUser({ id, email })` and `Sentry.setTag('org_id', orgId)`
5. **Add Sentry to edge functions** — use `@sentry/deno` or manual `fetch` to the Sentry envelope endpoint for server-side errors
6. **Configure secrets** — user must provide:
   - `SENTRY_DSN` (for error reporting)
   - `SENTRY_AUTH_TOKEN` (for the test to query the Sentry API)
   - `SENTRY_ORG` and `SENTRY_PROJECT` (for API queries)

### Phase 2: Error Reporting Test

Once Sentry is integrated, deploy a temporary edge function (`sentry-error-test`) that:

1. **Client-side null ref**: Seed a vintage, call `ask-solera` with a crafted payload that triggers a caught exception, verify it appears in Sentry via API polling
2. **Non-existent table query**: Execute `supabase.from('nonexistent_table_xyz').select('*')` in the edge function, catch and report to Sentry
3. **Invalid Anthropic key**: Call `ask-solera` with a deliberately bad auth header, verify the 401 error is captured

For each error, poll `GET https://sentry.io/api/0/projects/{org}/{project}/events/` with the `SENTRY_AUTH_TOKEN` for up to 30 seconds looking for matching error messages.

## Decision Required

Since Sentry isn't set up yet, we have two options:

**Option A**: I integrate Sentry into Solera first (Phase 1), then write the test (Phase 2). This is the full solution but requires you to provide Sentry credentials.

**Option B**: I write the test as a specification/script that will work once Sentry is added, but skip the integration itself. The test would fail immediately with a clear "Sentry not configured" message until you add the integration.

I recommend **Option A** — do you have a Sentry project set up, or should I guide you through creating one? I'll need the DSN, auth token, org slug, and project slug to proceed.

