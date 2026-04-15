

# Referral Program — Revised Plan

## Two Changes Addressed

### 1. Trial extension via Paddle API (not just customData)

The previous plan assumed passing trial info in `customData` would magically apply a 30-day trial. It won't — Paddle requires explicitly setting a trial period on the subscription. The fix: when creating a subscription checkout for a referred user, use Paddle's `trial_period` field on the subscription creation API call (or apply a pre-configured discount). Specifically:

- In the **Signup flow**, when a valid referral code is detected, store the referral code in the user's profile metadata.
- In the **PricingPage checkout**, when opening `paddle.Checkout.open()`, pass `settings.trialPeriod: { frequency: 30, interval: 'day' }` — this is Paddle's client-side Checkout API for setting a trial directly on the subscription. This ensures the 30-day trial is applied at the Paddle level, not just stored.
- Fallback: If Paddle's inline checkout doesn't support `trialPeriod` directly, create the subscription server-side via the `paddle-subscription` edge function using Paddle's API with `trial_period` set, then redirect the user to the checkout URL.

### 2. Handle upgrades (subscription.updated), not just subscription.created

A referred user may sign up as Hobbyist (free) and upgrade later. That fires `subscription.updated`, not `subscription.created`. The referral conversion logic must run on **both** events:

- `subscription.created` — direct paid signup
- `subscription.updated` — upgrade from Hobbyist to Pro/Growth

In both cases: check if the user has a `referrals` row with `status = 'signed_up'`, the new tier is Pro or Growth (not Enterprise), and if so, mark as converted and credit the referrer.

---

## Full Revised Plan

### Database Migration

1. Create `referral_status` enum: `pending`, `signed_up`, `converted`
2. Create `referrals` table with columns as specified (id, referrer_user_id, referred_user_id, referral_code, status, credit_days_earned, created_at, converted_at)
3. RLS: users can SELECT their own rows (referrer or referred)
4. Add `referral_code text unique` to `profiles`
5. Update `handle_new_user()` trigger to generate an 8-char code: `substr(md5(gen_random_uuid()::text), 1, 8)` and store in `profiles.referral_code`

### Edge Function: paddle-webhook (update existing)

Add a shared helper function `processReferralConversion(supabase, userId, newTier)` called from **both** `subscription.created` and `subscription.updated`:

- Look up `referrals` row where `referred_user_id = userId` and `status = 'signed_up'`
- If found and `newTier` is `small_boutique` or `mid_size`:
  - Update row: `status = 'converted'`, `converted_at = now()`, `credit_days_earned = 30`
  - Query referrer's total credits (`SUM(credit_days_earned)` across all rows); cap at 180
  - If cap not exceeded, send referral conversion email to referrer via `send-transactional-email`
  - If cap reached, still mark converted but set `credit_days_earned = 0` and note in logs

To find the `referred_user_id` from the webhook: look up the org's owner via `profiles` where `org_id` matches.

### Email Template: referral-conversion

- New file: `supabase/functions/_shared/transactional-email-templates/referral-conversion.tsx`
- Subject: "Your referral just went paid — you earned 30 free days"
- Body: congratulations, current credit balance
- Register in `registry.ts`

### Frontend: Signup Page

- Read `ref` query param
- Look up the referral code in `profiles` table, verify the referrer's org is Pro or Growth tier
- After successful signup, insert a `referrals` row with `status: 'signed_up'`
- Store `ref` code in user metadata so the webhook can trace it

### Frontend: PricingPage Checkout

- When a referred user (has a `referrals` row as `referred_user_id`) initiates checkout, pass `settings: { trialPeriod: { frequency: 30, interval: 'day' } }` to `paddle.Checkout.open()` — this applies the trial at the Paddle API level
- If the Paddle JS SDK version doesn't support `trialPeriod` in checkout settings, fall back to creating the subscription server-side via the Paddle API with `trial_period` set

### Frontend: BillingSettings

- Add "Referral Program" section, visible only for Pro (`small_boutique`) and Growth (`mid_size`) tiers
- Show: referral link (`solera.vin/join?ref=CODE`), copy button, stats (sent, converted, days earned, remaining)
- Query `referrals` table filtered by `referrer_user_id`

### Routing

- Add `/join` route that redirects to `/signup?ref=XXXXX`

### Fix: process-email-queue TypeScript errors

- Add explicit `any` type annotations to `.map()` and `.filter()` callbacks

