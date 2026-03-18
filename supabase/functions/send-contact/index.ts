const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { name, email, subject, message } = await req.json();

    // Validate inputs
    if (!name || !email || !subject || !message) {
      return new Response(
        JSON.stringify({ error: "All fields are required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }
    if (name.length > 100 || email.length > 255 || message.length > 5000) {
      return new Response(
        JSON.stringify({ error: "Input exceeds maximum length" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email address" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const allowedSubjects = ["Sales", "Support", "Migration Help", "Press", "Other"];
    if (!allowedSubjects.includes(subject)) {
      return new Response(
        JSON.stringify({ error: "Invalid subject" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Send email via Resend
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      // Fallback: log the contact submission if Resend isn't configured
      console.log("Contact form submission (Resend not configured):", { name, email, subject, message });
      return new Response(
        JSON.stringify({ success: true, note: "Message logged (email delivery not configured)" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Solera Contact <contact@solera.vin>",
        to: ["kevin@solera.vin"],
        reply_to: email,
        subject: `[Solera Contact] ${subject} — from ${name}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px;">
            <h2 style="color: #6B1B2A;">New Contact Form Submission</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px 0; font-weight: bold; color: #666;">Name</td><td style="padding: 8px 0;">${escapeHtml(name)}</td></tr>
              <tr><td style="padding: 8px 0; font-weight: bold; color: #666;">Email</td><td style="padding: 8px 0;"><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td></tr>
              <tr><td style="padding: 8px 0; font-weight: bold; color: #666;">Subject</td><td style="padding: 8px 0;">${escapeHtml(subject)}</td></tr>
            </table>
            <hr style="margin: 16px 0; border: none; border-top: 1px solid #eee;" />
            <div style="white-space: pre-wrap; color: #333;">${escapeHtml(message)}</div>
          </div>
        `,
      }),
    });

    if (!resendResponse.ok) {
      const errText = await resendResponse.text();
      console.error("Resend error:", errText);
      throw new Error("Email delivery failed");
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("send-contact error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to send message" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
