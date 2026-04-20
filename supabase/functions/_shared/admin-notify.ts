/**
 * Shared admin notification utility.
 * Sends branded emails to ADMIN_EMAIL via the queue-backed transactional
 * email pipeline (retry on 429, suppression respected, audit-logged).
 * Fire-and-forget — never throws.
 */
import { sendTransactionalEmail } from "./send-email.ts";

const ADMIN_EMAIL_SELF = "kevin@solera.vin";

export async function sendAdminNotification(
  subject: string,
  body: string,
  actorEmail?: string
): Promise<void> {
  try {
    if (actorEmail && actorEmail.toLowerCase() === ADMIN_EMAIL_SELF.toLowerCase()) {
      return;
    }

    const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL");
    if (!ADMIN_EMAIL) {
      console.error("[admin-notify] ADMIN_EMAIL not configured");
      return;
    }

    // Idempotency key: subject + actor + minute bucket prevents same-event dupes
    const minuteBucket = Math.floor(Date.now() / 60000);
    const idempotencyKey = `admin-${minuteBucket}-${(actorEmail || "system")}-${subject}`.slice(0, 255);

    await sendTransactionalEmail(
      ADMIN_EMAIL,
      "admin-notify",
      { subject, body },
      idempotencyKey
    );
  } catch (err) {
    console.error("[admin-notify] Failed:", err);
  }
}
