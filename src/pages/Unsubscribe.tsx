import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

type Status = "loading" | "valid" | "already" | "invalid" | "success" | "error";

export default function Unsubscribe() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }

    const validate = async () => {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const res = await fetch(
          `${supabaseUrl}/functions/v1/handle-email-unsubscribe?token=${token}`,
          { headers: { apikey: supabaseKey } }
        );
        const data = await res.json();
        if (data.valid === false && data.reason === "already_unsubscribed") {
          setStatus("already");
        } else if (data.valid) {
          setStatus("valid");
        } else {
          setStatus("invalid");
        }
      } catch {
        setStatus("invalid");
      }
    };
    validate();
  }, [token]);

  const handleUnsubscribe = async () => {
    try {
      const { data } = await supabase.functions.invoke("handle-email-unsubscribe", {
        body: { token },
      });
      if (data?.success) {
        setStatus("success");
      } else if (data?.reason === "already_unsubscribed") {
        setStatus("already");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "#F5F0E8" }}>
      <div className="w-full max-w-md text-center rounded-2xl shadow-lg p-8" style={{ backgroundColor: "#FFFFFF" }}>
        <h1
          className="text-2xl font-bold mb-4"
          style={{ fontFamily: "'Playfair Display', serif", color: "#6B1B2A" }}
        >
          Email Preferences
        </h1>

        {status === "loading" && (
          <p style={{ color: "#444", fontFamily: "'Source Sans 3', sans-serif" }}>Verifying…</p>
        )}

        {status === "valid" && (
          <>
            <p className="mb-6" style={{ color: "#444", fontFamily: "'Source Sans 3', sans-serif" }}>
              Would you like to unsubscribe from Solera emails?
            </p>
            <button
              onClick={handleUnsubscribe}
              className="px-6 py-3 rounded-lg text-sm font-semibold"
              style={{ backgroundColor: "#6B1B2A", color: "#F5F0E8", fontFamily: "'Source Sans 3', sans-serif" }}
            >
              Confirm Unsubscribe
            </button>
          </>
        )}

        {status === "success" && (
          <p style={{ color: "#444", fontFamily: "'Source Sans 3', sans-serif" }}>
            You've been unsubscribed. You won't receive further emails from us.
          </p>
        )}

        {status === "already" && (
          <p style={{ color: "#444", fontFamily: "'Source Sans 3', sans-serif" }}>
            You're already unsubscribed — no further action needed.
          </p>
        )}

        {status === "invalid" && (
          <p style={{ color: "#6B1B2A", fontFamily: "'Source Sans 3', sans-serif" }}>
            This unsubscribe link is invalid or expired.
          </p>
        )}

        {status === "error" && (
          <p style={{ color: "#6B1B2A", fontFamily: "'Source Sans 3', sans-serif" }}>
            Something went wrong. Please try again or email support@solera.vin.
          </p>
        )}
      </div>
    </div>
  );
}
