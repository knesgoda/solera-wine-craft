import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App.tsx";
import "./index.css";
import "./lib/i18n"; // Initialize i18n before app renders
import { getCookieConsent } from "./components/CookieConsentBanner";

// Initialize Sentry error tracking (production only)
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
if (import.meta.env.PROD && !SENTRY_DSN) {
  console.warn('[Solera] VITE_SENTRY_DSN is not set — Sentry error reporting is disabled');
}
// Only initialise Sentry if the user has explicitly accepted cookies.
// Session replays mask all text + media to avoid capturing winery PII.
if (SENTRY_DSN && import.meta.env.PROD && getCookieConsent() === "accepted") {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
    ],
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
  });
}

// Register service worker via vite-plugin-pwa
import { registerSW } from "virtual:pwa-register";
registerSW({ immediate: true });

createRoot(document.getElementById("root")!).render(<App />);
