import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Cookie } from "lucide-react";
import { Link } from "react-router-dom";

const STORAGE_KEY = "solera_cookie_consent_v1";

type Consent = "accepted" | "rejected";

export function getCookieConsent(): Consent | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(STORAGE_KEY);
  return v === "accepted" || v === "rejected" ? v : null;
}

function setCookieConsent(v: Consent) {
  localStorage.setItem(STORAGE_KEY, v);
  window.dispatchEvent(new CustomEvent("solera:cookie-consent", { detail: v }));
}

/**
 * Loads Google Fonts, GA4, and (if production) Sentry — only after explicit consent.
 * Idempotent: safe to call multiple times.
 */
function activateConsentedScripts() {
  if (typeof document === "undefined") return;

  // Google Fonts
  if (!document.querySelector('link[data-consent="google-fonts"]')) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Source+Sans+3:wght@300;400;500;600;700&display=swap";
    link.dataset.consent = "google-fonts";
    document.head.appendChild(link);
  }

  // GA4
  if (!document.querySelector('script[data-consent="ga4"]')) {
    const s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=G-1SJWDML2TL";
    s.dataset.consent = "ga4";
    document.head.appendChild(s);

    const inline = document.createElement("script");
    inline.dataset.consent = "ga4-inline";
    inline.text =
      "window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', 'G-1SJWDML2TL');";
    document.head.appendChild(inline);
  }
}

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const v = getCookieConsent();
    if (v === "accepted") {
      activateConsentedScripts();
    }
    if (v === null) setVisible(true);
  }, []);

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-0 inset-x-0 z-[60] border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-lg"
    >
      <div className="max-w-5xl mx-auto px-4 py-4 flex flex-col md:flex-row md:items-center gap-3 md:gap-6">
        <div className="flex items-start gap-3 flex-1">
          <Cookie className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <p className="text-sm text-foreground/80 leading-snug">
            We use essential cookies to run Solera. With your permission, we also load
            Google Fonts, Google Analytics, and on-error session replay (Sentry) to
            improve the platform.{" "}
            <Link to="/privacy" className="underline text-primary hover:text-primary/80">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setCookieConsent("rejected");
              setVisible(false);
            }}
          >
            Reject non-essential
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setCookieConsent("accepted");
              activateConsentedScripts();
              setVisible(false);
            }}
          >
            Accept all
          </Button>
        </div>
      </div>
    </div>
  );
}