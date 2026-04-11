import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App.tsx";
import "./index.css";
import "./lib/i18n"; // Initialize i18n before app renders

// Initialize Sentry error tracking
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
if (!SENTRY_DSN) {
  console.warn('[Solera] VITE_SENTRY_DSN is not set — Sentry error reporting is disabled');
}
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
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
