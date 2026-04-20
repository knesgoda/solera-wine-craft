/**
 * Shared helper to enqueue transactional emails via the queue-backed
 * `send-transactional-email` function. Use this everywhere instead of
 * calling the Resend API directly — gains: retry on 429, suppression
 * checks, audit log in email_send_log, unsubscribe footer, consistent
 * branding.
 *
 * Fire-and-forget: never throws, only logs. Idempotency keys prevent
 * duplicate sends on cron retries.
 */
export async function sendTransactionalEmail(
  recipientEmail: string,
  templateName: string,
  templateData: Record<string, any>,
  idempotencyKey: string
): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceKey) {
      console.error('[send-email] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
      return
    }

    const res = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
      },
      body: JSON.stringify({
        templateName,
        recipientEmail,
        templateData,
        idempotencyKey,
      }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error(
        `[send-email] enqueue failed [${res.status}] template=${templateName} to=${recipientEmail}: ${body}`
      )
    }
  } catch (err) {
    console.error('[send-email] threw:', err)
  }
}
