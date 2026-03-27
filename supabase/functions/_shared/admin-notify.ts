/**
 * Shared admin notification utility.
 * Sends plain-text emails to the configured ADMIN_EMAIL via Resend.
 * Fire-and-forget — never throws, only logs errors.
 */

const ADMIN_EMAIL_SELF = "kevin@solera.vin"; // used to suppress self-notifications

export async function sendAdminNotification(
  subject: string,
  body: string,
  actorEmail?: string
): Promise<void> {
  try {
    // Skip notifications triggered by the admin themselves
    if (actorEmail && actorEmail.toLowerCase() === ADMIN_EMAIL_SELF.toLowerCase()) {
      return;
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      console.error("[admin-notify] RESEND_API_KEY not configured");
      return;
    }

    const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL");
    if (!ADMIN_EMAIL) {
      console.error("[admin-notify] ADMIN_EMAIL not configured");
      return;
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Solera Notifications <notifications@solera.vin>",
        to: [ADMIN_EMAIL],
        subject: `[Solera] ${subject}`,
        text: body,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error(`[admin-notify] Resend error [${res.status}]: ${errBody}`);
    }
  } catch (err) {
    console.error("[admin-notify] Failed to send:", err);
  }
}
