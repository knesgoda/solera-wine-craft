

# Fix: Waitlist Email Notifications

## Problem

Two emails should fire when someone submits the waitlist form:
1. **Admin notification** to kevin@solera.vin with the signup details
2. **Confirmation email** to the submitter ("You're on the list")

Neither works today. The admin notification calls Resend directly but fails with a 403 because the `solera.vin` domain is not verified in Resend. The confirmation email to the submitter doesn't exist at all.

## Solution

Switch to Lovable's built-in email system, which handles delivery without needing a separate Resend domain verification.

### Step 1: Set up email domain
You'll configure a sender domain (e.g., `notify.solera.vin`) through the email setup dialog. This involves adding DNS records at your domain registrar.

### Step 2: Set up email infrastructure
Database tables, queues, and the email processing system get created automatically.

### Step 3: Scaffold transactional email system
Creates the `send-transactional-email` Edge Function and template framework.

### Step 4: Create two email templates
- **`waitlist-confirmation`** — branded confirmation to the submitter: "You're on the list. We'll reach out before we open the doors."
- **`waitlist-admin-notify`** — admin notification with signup details (name, email, operation type, timestamp)

Both use Solera brand styling (Crimson #6B1B2A, Gold #C8902A, Cream #F5F0E8, Playfair Display headings).

### Step 5: Update the waitlist form (`src/pages/ComingSoon.tsx`)
After a successful insert, invoke `send-transactional-email` twice:
1. Confirmation to the submitter
2. Admin notification to kevin@solera.vin

### Step 6: Update `notify-waitlist-signup` Edge Function
Replace the Resend-based `sendAdminNotification` call with the transactional email system, or remove the function entirely since the emails will be sent directly from the form.

## What you'll need to do
- Add DNS records for your email subdomain at your domain registrar (the setup dialog will show you exactly what to add)
- Emails will start sending once DNS verification completes (can take up to 72 hours)

## Files changed
- `supabase/functions/_shared/transactional-email-templates/waitlist-confirmation.tsx` (new)
- `supabase/functions/_shared/transactional-email-templates/waitlist-admin-notify.tsx` (new)
- `supabase/functions/_shared/transactional-email-templates/registry.ts` (updated)
- `src/pages/ComingSoon.tsx` (updated — add email invocations after insert)
- `supabase/functions/notify-waitlist-signup/index.ts` (updated or removed)

