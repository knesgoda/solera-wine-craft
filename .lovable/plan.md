

## Resend Email Integration — Diagnostic

**Files reviewed:** `_shared/admin-notify.ts`, `_shared/transactional-email-templates/registry.ts`, `send-transactional-email/index.ts`, `process-email-queue/index.ts`, `evaluate-alerts`, `check-harvest-alerts`, `detect-anomalies`, `weekly-summary`, `process-backup`, `run-scheduled-backups`, `invite-client`, `send-client-message`, `paddle-webhook`, `ForgotPassword.tsx`, `Signup.tsx`. Plus DB checks against `email_send_state`.

---

### 1. From-address used for transactional emails

🔴 **Five different from-addresses across the codebase, on three different domains.** No single source of truth.

| Function | From: header | Sender domain |
|---|---|---|
| `send-transactional-email` (Lovable queue path) | `solera-wine-craft <noreply@solera.vin>` | `notify.solera.vin` (envelope) |
| `_shared/admin-notify.ts` | `Solera Notifications <notifications@solera.vin>` | `solera.vin` |
| `evaluate-alerts` (lab/threshold alerts) | `Solera Alerts <notifications@solera.vin>` | `solera.vin` |
| `check-harvest-alerts` | `Solera Alerts <alerts@solera.vin>` | `solera.vin` |
| `detect-anomalies` | `Solera Alerts <alerts@solera.vin>` | `solera.vin` |
| `weekly-summary` | `Solera <notifications@solera.vin>` | `solera.vin` |
| `process-backup` (cancellation/backup ready) | `Solera Notifications <notifications@solera.vin>` (with `reply_to: support@solera.vin`) | `solera.vin` |
| `run-scheduled-backups` | `Solera Notifications <notifications@solera.vin>` | `solera.vin` |
| `invite-client` | `${facilityName} <noreply@${RESEND_DOMAIN || 'solera.vin'}>` | env-driven, falls back to `solera.vin` |
| `send-client-message` | `Solera <noreply@${RESEND_DOMAIN || 'solera.vin'}>` | env-driven, falls back to `solera.vin` |
| **Welcome / Password reset** | **N/A — handled by Supabase auth defaults, NOT Resend** (see #4) | n/a |

🔴 **The branded from-name is "solera-wine-craft" in `send-transactional-email`** (literally the Lovable project slug). Every email queued through the official Lovable infrastructure shows that as the sender display name. Should be "Solera".

🟡 The Lovable queue path sends from `notify.solera.vin` (managed by Lovable's nameservers), while every direct `api.resend.com` call sends from root `solera.vin`. Two parallel sender domains in one product.

---

### 2. Domain DNS / verification status (SPF, DKIM, DMARC)

❓ **Cannot verify from inside the project — Resend's domain config lives in the Resend dashboard, not in this codebase or DB.** What I can verify:

- ✅ **`notify.solera.vin`** is the Lovable-managed subdomain referenced in `send-transactional-email/index.ts` (`SENDER_DOMAIN = "notify.solera.vin"`). Per Lovable Email infrastructure, NS for this subdomain is delegated to `ns3/ns4.lovable.cloud` and SPF/DKIM/MX are auto-provisioned on the Lovable Cloudflare zone. Active per the `process-email-queue` cron and `email_send_state` row existing.
- ❓ **Root `solera.vin`** is used by **9 edge functions** that bypass Lovable Email and call `https://api.resend.com/emails` directly with `RESEND_API_KEY`. For these to actually deliver, **the user (or operator)** must have separately verified `solera.vin` as a domain inside Resend's dashboard with SPF (`v=spf1 include:_spf.resend.com ~all`), DKIM (CNAME records `resend._domainkey...`), and DMARC. There is no code or migration that proves verification status one way or the other.
- 🔴 **DMARC is not visible anywhere in the project.** Policy must exist as a TXT at `_dmarc.solera.vin` to prevent spoofing. Cannot confirm.
- 🔴 **No fallback to Lovable templates if `RESEND_API_KEY` is missing.** Every direct-Resend call wraps in `if (resendKey) { ... } else { console.warn(...) }` — emails are silently dropped if the key isn't set, with only a console warning.

🔴 **Mixed-domain risk:** sending alerts from `notifications@solera.vin` and `alerts@solera.vin` (root) while transactional emails go through `noreply@solera.vin` envelope-from `notify.solera.vin` means SPF alignment for DMARC must be passing on **both** the root and the subdomain independently. If only `notify.solera.vin` is verified in Lovable and `solera.vin` was never verified in Resend, every alert email is silently failing SPF and either bouncing or going to spam.

---

### 3. Email templates

**Two systems coexist:**

**A) Lovable queue templates** (React Email .tsx in `_shared/transactional-email-templates/`, registered in `registry.ts`):

| Template name | Trigger |
|---|---|
| `waitlist-confirmation` | `ComingSoon.tsx` — public visitor joins waitlist |
| `waitlist-admin-notify` | `ComingSoon.tsx` — admin notification of new waitlist signup |
| `referral-conversion` | `paddle-webhook` — when a referred user converts to paid |

That's it — **3 templates** in the official system.

**B) Inline HTML strings inside edge functions** (no template file, hardcoded):

| Sender function | Trigger | Content |
|---|---|---|
| `evaluate-alerts` | Lab thresholds breached (Brix, VA, SO₂, etc.) | Inline `<div>` with crimson `<h2>`, message, CTA button |
| `check-harvest-alerts` | Linear-slope predicts harvest <7 days out | Inline HTML with grape emoji, block name, predicted date |
| `detect-anomalies` | Daily 7am scan finds anomaly (VA spike, stalled Brix, etc.) | Inline HTML digest, multiple anomalies bulleted |
| `weekly-summary` | Sunday cron, AI-written winery digest | Inline HTML wrapping AI markdown |
| `process-backup` | Org cancellation → final backup ready | Inline HTML download link, all org users |
| `run-scheduled-backups` | Weekly/monthly scheduled backup job done | Inline HTML download link |
| `invite-client` | Operator invites custom-crush client | Inline HTML invite link, 48h expiry warning |
| `send-client-message` | Client sends message in portal → notify owner | Inline HTML notification |
| `_shared/admin-notify.ts` (utility) | Signups, first lab samples, payment failures, etc. | **Plain text** to ADMIN_EMAIL |

🔴 **9 edge functions render their own HTML inline.** No shared template, no consistent unsubscribe footer, no suppression list check, no rate-limit handling, no bounce/complaint integration, no audit row in `email_send_log`. If branding changes, every file must be edited individually.

---

### 4. Alert emails: Resend or Supabase auth?

✅ **Alerts: Resend (direct).** All four alert pathways (`evaluate-alerts`, `check-harvest-alerts`, `detect-anomalies`, `weekly-summary`) call `https://api.resend.com/emails` directly with `RESEND_API_KEY`. Correct for deliverability.

🔴 **Welcome and password reset: Supabase Auth defaults — NOT Resend.**
- `src/pages/Signup.tsx` line 60: `supabase.auth.signUp({ email, password, ... })` → triggers Supabase's built-in confirmation email.
- `src/pages/ForgotPassword.tsx` line 19: `supabase.auth.resetPasswordForEmail(email, { redirectTo })` → triggers Supabase's built-in reset email.
- There is **no `auth-email-hook`** scaffolded in `supabase/functions/`. Per Lovable Email infrastructure, without `auth-email-hook` the auth emails fall back to default Supabase templates, which are sent via Supabase's relay, **not Resend or the Lovable Email gateway**.
- Result: signup confirmation and password reset arrive from a generic Supabase sender (`noreply@mail.app.supabase.io` or similar), with no Solera branding, no SPF alignment to `solera.vin`, and lower deliverability than transactional Resend traffic.

🟡 There is no "welcome email" template at all in the registry. New paying users do not receive a Solera-branded welcome — only the bare Supabase confirmation email. Onboarding is in-app only.

---

### 5. Rate limiting / queue

**Mixed — only some emails go through the queue.**

✅ **Lovable queue path (`send-transactional-email` + `process-email-queue`):**
- pgmq queues `auth_emails` (priority) and `transactional_emails`.
- DB config `email_send_state` confirmed: `batch_size = 10`, `send_delay_ms = 200`, `transactional_email_ttl_minutes = 60`, `auth_email_ttl_minutes = 15` → **~120 emails/min throughput, smoothed**.
- `process-email-queue` cron runs every 5s, 5 retries, 30s visibility timeout, DLQ on persistent failures.
- 429 detection: `isRateLimited()` reads `Retry-After` from EmailAPIError and pauses the dispatcher. Emails stay queued.
- Suppression list check on every send (`suppressed_emails` table).
- Used by: 3 templates only (waitlist x2, referral conversion).

🔴 **Direct Resend path: NO queue, NO rate limiting, NO retry, NO backoff.**
- All 9 functions calling `api.resend.com` directly do so inside a `for` loop over `orgUsers`:
  ```js
  for (const p of orgUsers) {
    try { await fetch("https://api.resend.com/emails", {...}); }
    catch (e) { console.error(...); }
  }
  ```
- If Resend returns 429, the `await fetch` resolves with status 429 — **the loop continues sending** because `fetch` doesn't throw on HTTP errors. Every subsequent email also 429s. No backoff, no Retry-After honoring.
- If a transient 5xx occurs, the email is **lost** — no retry queue, no audit row.
- No suppression check. An unsubscribed user keeps receiving alerts forever.
- No idempotency. If `evaluate-alerts` runs twice (cron retry, manual trigger), every user gets the alert twice.

🔴 **Burst risk:** A single `evaluate-alerts` run on an Enterprise org with 15 users + 5 alert rules firing simultaneously = 75 emails sent in a tight loop without delay. Resend's free/starter tier is 10/sec; this will hit 429 immediately, lose ~half the alerts, and there is no surfaced error anywhere (only `console.error`). Same risk for `detect-anomalies` (sends to all profiles for every org with anomalies).

🔴 **No per-recipient suppression on alerts.** `mem://tech/email-infrastructure` notes the Lovable queue checks `suppressed_emails`, but the direct-Resend functions do not. A bounced or complained address keeps receiving alerts, harming `solera.vin` sender reputation.

---

### Summary

| # | Question | Result |
|---|---|---|
| 1 | From address | 🔴 5 different from-addresses across 3 patterns (`noreply@solera.vin`, `notifications@solera.vin`, `alerts@solera.vin`); display name in Lovable queue is the literal slug `"solera-wine-craft"` |
| 2 | SPF / DKIM / DMARC for `solera.vin` | ❓ Cannot verify from code. `notify.solera.vin` is Lovable-managed (verified). Root `solera.vin` (used by all 9 alert/utility functions) requires manual Resend verification — no proof in repo. DMARC absent from any config visible. |
| 3 | Templates | ✅ 3 React Email templates in registry (waitlist x2, referral). 🔴 9 functions render inline HTML/text with no shared template, no unsubscribe, no audit log |
| 4 | Alerts via Resend? | ✅ Alerts → Resend direct. 🔴 Welcome + password reset use **Supabase Auth defaults**, not Resend, not Lovable. No branded welcome template exists. |
| 5 | Rate limiting / queue | 🟡 Lovable queue exists for 3 templates only (120/min, retries, suppression). 🔴 9 alert/utility functions bypass queue: tight `for` loops, no 429 handling, no retry, no suppression check, lost emails on burst |

---

### Flagged gaps (diagnostic only)

1. 🔴 **(P0) Welcome + password reset go out as default Supabase emails.** Scaffold `auth-email-hook` and create branded `welcome`, `password-reset`, `email-verification`, `magic-link` templates. Today these emails come from `noreply@mail.app.supabase.io` with no Solera branding, hurting trust and deliverability.
2. 🔴 **(P0) 9 alert/utility functions bypass the queue and have no 429 handling.** Refactor `evaluate-alerts`, `check-harvest-alerts`, `detect-anomalies`, `weekly-summary`, `process-backup`, `run-scheduled-backups`, `invite-client`, `send-client-message`, `admin-notify` to enqueue via `send-transactional-email` instead of looping directly into `api.resend.com`. Create matching React Email templates: `lab-alert`, `harvest-alert`, `anomaly-digest`, `weekly-summary`, `backup-ready`, `client-invite`, `client-message-notify`, `admin-notify`. Gain: retry on 429, suppression respect, audit log, unsubscribe footer, consistent branding.
3. 🔴 **(P0) From-name `"solera-wine-craft"` in `send-transactional-email`.** Change `SITE_NAME = "Solera"`. Currently every queued email shows the project slug as the sender display name.
4. 🔴 **(P1) Domain verification status unconfirmed for root `solera.vin` in Resend.** Operator must verify in Resend dashboard: SPF (`v=spf1 include:_spf.resend.com ~all`), DKIM (Resend-issued CNAMEs), DMARC (`v=DMARC1; p=quarantine; rua=mailto:dmarc@solera.vin`). If only `notify.solera.vin` is verified through Lovable, every alert email currently fails SPF alignment.
5. 🟡 **(P1) From-address inconsistency.** Three sender mailboxes (`noreply@`, `notifications@`, `alerts@`) on root `solera.vin` plus `noreply@solera.vin` envelope-from `notify.solera.vin`. Pick one address-naming convention. Recommendation: unify on `notify.solera.vin` envelope (Lovable queue) for everything, root `solera.vin` mailboxes only for human reply paths.
6. 🟡 **(P2) No suppression check in direct-Resend functions.** Even before refactoring to the queue, add a `suppressed_emails` lookup before each `fetch` to honor unsubscribes/bounces.
7. 🟡 **(P2) No idempotency on alert sends.** If `evaluate-alerts` cron runs twice (retry, manual trigger), users get duplicates. The `last_triggered_at` update happens *after* email loop, so a crash mid-loop re-sends to early recipients on retry.

