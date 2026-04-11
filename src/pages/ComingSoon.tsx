import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SEOHead } from "@/components/SEOHead";
import soleraLogo from "@/assets/solera-logo-barrels.png";

const OPERATION_TYPES = [
  "Home Winemaker",
  "Small Boutique Winery",
  "Mid-Size Winery",
  "Custom Crush Facility",
  "Just Curious",
];

export default function ComingSoon() {
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [operationType, setOperationType] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (honeypot) return; // bot trap
    setSubmitting(true);

    try {
      const { data, error: insertError } = await supabase
        .from("waitlist_signups")
        .insert({
          first_name: firstName,
          email: email.trim().toLowerCase(),
          operation_type: operationType,
        })
        .select()
        .single();

      if (insertError) {
        if (insertError.code === "23505") {
          setError("Looks like you're already on the list — we'll be in touch!");
          return;
        }
        throw insertError;
      }

      setSuccess(true);

      // Fire-and-forget notification
      supabase.functions
        .invoke("notify-waitlist-signup", {
          body: {
            first_name: firstName,
            email: email.trim().toLowerCase(),
            operation_type: operationType,
            created_at: data.created_at,
          },
        })
        .catch(() => {});
    } catch (err: any) {
      setError("Something went wrong. Please try again.");
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <SEOHead
        title="Solera — Winery Management Software | Vineyard Ops, COGS Tracking, AI Analytics, DTC Sales"
        description="Solera — winery management from vine to bottle to doorstep. Vineyard ops, lab tracking, cellar management, DTC sales, AI-powered insights, clone & rootstock ripening intelligence, multi-language support, free data export on every tier. Start free."
      />
      <div
        className="min-h-screen flex items-center justify-center px-4 py-12"
        style={{ backgroundColor: "#F5F0E8" }}
      >
        <div className="w-full max-w-lg text-center">
          {/* Logo */}
          <img
            src={soleraLogo}
            alt="Solera logo"
            className="w-24 h-24 mx-auto mb-6 object-contain"
          />

          {/* Badge */}
          <span
            className="inline-block text-xs font-semibold tracking-wider uppercase px-4 py-1.5 rounded-full mb-6"
            style={{
              backgroundColor: "rgba(200,144,42,0.15)",
              color: "#C8902A",
              fontFamily: "'Source Sans 3', sans-serif",
            }}
          >
            Now in Final Testing
          </span>

          {/* Headline */}
          <h1
            className="text-4xl md:text-5xl font-bold mb-4"
            style={{
              fontFamily: "'Playfair Display', serif",
              color: "#1A1A1A",
            }}
          >
            Solera is almost here.
          </h1>

          {/* Subheadline */}
          <p
            className="text-lg md:text-xl mb-4"
            style={{
              fontFamily: "'Source Sans 3', sans-serif",
              color: "#6B1B2A",
              fontWeight: 600,
            }}
          >
            The complete winery management platform — from vine to bottle to
            doorstep.
          </p>

          {/* Body */}
          <p
            className="text-base leading-relaxed mb-10 max-w-md mx-auto"
            style={{
              fontFamily: "'Source Sans 3', sans-serif",
              color: "#444",
            }}
          >
            We're putting the finishing touches on something built for
            winemakers who are serious about their craft. Full lifecycle ops,
            AI-powered insights, and honest pricing that undercuts every tool
            you're using today. Leave your info and you'll be the first to know
            when we go live — plus an exclusive early-access offer.
          </p>

          {/* Feature highlights for SEO */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-10 max-w-lg mx-auto text-left">
            {[
              "Vineyard & block management",
              "Ripening intelligence",
              "Cellar & fermentation",
              "Production cost tracking",
              "Multi-language & timezone",
              "Free data export & backup",
              "AI-powered analytics",
              "DTC sales & wine clubs",
            ].map(f => (
              <div key={f} className="flex items-start gap-1.5 text-xs" style={{ fontFamily: "'Source Sans 3', sans-serif", color: "#444" }}>
                <span style={{ color: "#C8902A" }}>✓</span>
                <span>{f}</span>
              </div>
            ))}
          </div>

          {/* Form card */}
          <div
            className="rounded-2xl shadow-lg p-6 md:p-8 mx-auto"
            style={{
              backgroundColor: "#FFFFFF",
              maxWidth: 480,
            }}
          >
            {success ? (
              <p
                className="text-lg font-semibold py-8"
                style={{
                  fontFamily: "'Source Sans 3', sans-serif",
                  color: "#6B1B2A",
                }}
              >
                You're on the list. We'll be in touch soon — thank you.
              </p>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 text-left">
                <div>
                  <Label
                    htmlFor="firstName"
                    style={{ fontFamily: "'Source Sans 3', sans-serif" }}
                  >
                    First Name
                  </Label>
                  <Input
                    id="firstName"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Your first name"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label
                    htmlFor="email"
                    style={{ fontFamily: "'Source Sans 3', sans-serif" }}
                  >
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@winery.com"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label
                    style={{ fontFamily: "'Source Sans 3', sans-serif" }}
                  >
                    Operation Type
                  </Label>
                  <Select
                    required
                    value={operationType}
                    onValueChange={setOperationType}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select your operation" />
                    </SelectTrigger>
                    <SelectContent>
                      {OPERATION_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {error && (
                  <p
                    className="text-sm font-medium"
                    style={{ color: "#6B1B2A" }}
                  >
                    {error}
                  </p>
                )}

                <Button
                  type="submit"
                  disabled={submitting || !operationType}
                  className="w-full text-base font-semibold h-12"
                  style={{
                    backgroundColor: "#6B1B2A",
                    color: "#F5F0E8",
                    fontFamily: "'Source Sans 3', sans-serif",
                  }}
                >
                  {submitting ? "Submitting…" : "Notify Me When We Launch"}
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
