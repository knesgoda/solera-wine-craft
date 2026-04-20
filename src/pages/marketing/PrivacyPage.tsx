import { SEOHead } from "@/components/SEOHead";

export default function PrivacyPage() {
  return (
    <>
      <SEOHead
        title="Privacy Policy — Solera"
        description="Solera's privacy policy. How we collect, use, and protect your winery data. CCPA, GDPR, and Australian Privacy Principles compliant. We never sell your data."
        canonicalUrl="https://solera.vin/privacy"
        breadcrumbs={[
          { name: "Home", url: "https://solera.vin" },
          { name: "Privacy Policy", url: "https://solera.vin/privacy" },
        ]}
      />

      <section className="bg-primary py-16 md:py-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="font-display text-3xl md:text-4xl font-bold text-primary-foreground">Privacy Policy</h1>
          <p className="text-primary-foreground/70 mt-3">Last Updated: March 2026</p>
        </div>
      </section>

      <section className="py-16 bg-background">
        <div className="max-w-3xl mx-auto px-4 prose prose-lg prose-headings:font-display prose-headings:text-foreground prose-p:text-foreground/80 prose-a:text-primary prose-li:text-foreground/80 prose-strong:text-foreground">

          <h2>1. Introduction</h2>
          <p>
            This Privacy Policy describes how Solera ("we," "us," "our") collects, uses, and protects your information when
            you use our winery management platform at solera.vin. We are committed to protecting your privacy and handling
            your data transparently.
          </p>

          <h2>2. Information We Collect</h2>
          <p>
            <strong>Account Information:</strong> When you create an account, we collect your name, email address, and
            organization details (winery name, location, timezone, language preference). If you subscribe to a paid plan,
            payment processing is handled entirely by Paddle.com — we do not store your credit card number, bank account
            details, or other payment credentials.
          </p>
          <p>
            <strong>Winery Data:</strong> You may store vineyard records, lab samples, fermentation logs, vessel and barrel
            data, compliance records, inventory, customer lists, orders, and other operational data. This data belongs to you.
          </p>
          <p>
            <strong>Usage Data:</strong> We collect anonymized usage analytics including pages visited, features used, and
            general usage patterns to improve the Platform. We do not sell this data.
          </p>
          <p>
            <strong>Device and Browser Information:</strong> We collect browser type, operating system, IP address, and
            device identifiers for security, troubleshooting, and to provide timezone auto-detection.
          </p>
          <p>
            <strong>Cookies:</strong> We use essential cookies for authentication and session management. We use analytics
            cookies (Google Analytics 4) to understand how the Platform is used. These analytics cookies, along with
            self-hosted fonts (Google Fonts) and on-error session replay (Sentry), are only loaded after you grant
            consent through our cookie banner. We do not use advertising cookies or trackers.
          </p>

          <h2>3. How We Use Your Information</h2>
          <p>We use your information to:</p>
          <ul>
            <li>Provide and maintain the Platform.</li>
            <li>Process your subscription through Paddle.</li>
            <li>Send transactional emails (welcome, password reset, alert notifications, backup confirmations).</li>
            <li>Provide AI-powered features using your winery data within your organization's context.</li>
            <li>Improve the Platform based on aggregated, anonymized usage patterns.</li>
            <li>Comply with legal obligations.</li>
            <li>Protect against fraud and unauthorized access.</li>
          </ul>

          <h2>4. AI Data Usage</h2>
          <p>
            The Ask Solera AI feature processes your winery data to provide contextual insights and recommendations. Your
            data is sent to our AI provider (Anthropic) for processing in real time and is not retained by the AI provider
            for training purposes. Your data is never shared with other organizations or used to improve AI models. AI
            responses are generated based solely on your organization's data and general winemaking knowledge.
          </p>

          <h2>5. Data Sharing</h2>
          <p>We share your data only with:</p>
          <ul>
            <li>
              <strong>Paddle.com</strong> — primary payment processor and Merchant of Record (subscriptions, billing).
            </li>
            <li>
              <strong>Stripe</strong> — wine club checkout sessions only (legacy path; receives customer email,
              shipping address, and selected club tier).
            </li>
            <li>
              <strong>Anthropic</strong> — AI query processing (your data is not retained for training).
            </li>
            <li>
              <strong>Resend</strong> — transactional email delivery.
            </li>
            <li>
              <strong>Supabase</strong> — infrastructure and database hosting.
            </li>
            <li>
              <strong>Open-Meteo</strong> — weather data requests (we send vineyard coordinates only, no personal information).
            </li>
            <li>
              <strong>Tomorrow.io</strong> — Enterprise-tier weather and forecast data (vineyard coordinates only).
            </li>
            <li>
              <strong>Commerce7, WineDirect, Shopify</strong> — only when you connect these e-commerce platforms in
              Integrations. We send and receive customer, order, and product data using credentials you provide.
            </li>
            <li>
              <strong>QuickBooks (Intuit)</strong> — only when you connect QuickBooks. We send COGS journal entries
              and account names using OAuth tokens you authorise.
            </li>
            <li>
              <strong>ShipCompliant</strong> — only when you connect it for DTC compliance reporting. We send shipment
              and customer data required for state alcohol-shipping compliance.
            </li>
            <li>
              <strong>Google Analytics 4 (Google LLC)</strong> — anonymised page views, referrer, IP-derived
              geography, and session metrics. Loaded only after cookie consent.
            </li>
            <li>
              <strong>Google Fonts (Google LLC)</strong> — display typography. Loaded only after cookie consent.
            </li>
            <li>
              <strong>Sentry</strong> — production error tracking and on-error session replay (with all text and
              media masked). Loaded only after cookie consent.
            </li>
          </ul>
          <p>
            We do not sell your personal information or winery data to third parties. We may disclose information if required
            by law or to protect our legal rights.
          </p>

          <h2>6. Data Storage and Security</h2>
          <p>
            Your data is stored on servers provided by Supabase (cloud infrastructure). All data is encrypted in transit
            (TLS 1.2+) and at rest. We enforce row-level security (RLS) to ensure strict data isolation between
            organizations — no organization can access another's data. API keys are stored as bcrypt hashes. OAuth tokens
            are stored encrypted in Supabase Vault. We conduct regular security reviews of our codebase.
          </p>

          <h2>7. Data Retention</h2>
          <ul>
            <li>
              <strong>Active accounts:</strong> Your data is retained for as long as your account is active.
            </li>
            <li>
              <strong>Cancelled accounts:</strong> Your data is retained for 90 days after cancellation to allow for
              reactivation or final export. After 90 days, data may be permanently deleted.
            </li>
            <li>
              <strong>Backup exports:</strong> Download links for backup files expire after 30 days (scheduled backups) or
              90 days (cancellation exports).
            </li>
          </ul>

          <h2>8. Your Rights</h2>
          <p>Regardless of your location, you have the right to:</p>
          <ul>
            <li>
              <strong>Access</strong> a complete copy of your data at any time via the Data Backup & Export feature
              (available on all tiers).
            </li>
            <li>
              <strong>Correct</strong> inaccurate data by editing your records in the Platform.
            </li>
            <li>
              <strong>Delete</strong> your account and all associated data self-serve from{" "}
              <em>Settings → Facilities → Delete Account</em>. Owners type the organization name to confirm; a final
              data export is generated automatically. For assistance you may also contact{" "}
              <a href="mailto:support@solera.vin">support@solera.vin</a>.
            </li>
            <li>
              <strong>Export</strong> your data in CSV or Excel format at any time.
            </li>
          </ul>

          <p>
            <strong>For users in the European Economic Area (EEA) and United Kingdom:</strong> You additionally have the
            right to object to processing, request restriction of processing, and lodge a complaint with your local data
            protection authority. Our legal basis for processing is contractual necessity (providing the service you
            subscribed to) and legitimate interest (improving the Platform).
          </p>

          <p>
            <strong>For users in California:</strong> Under the CCPA, you have the right to know what personal information we
            collect, request deletion, and opt out of the sale of personal information. We do not sell personal information.
          </p>

          <p>
            <strong>For users in Australia:</strong> We comply with the Australian Privacy Principles (APPs) under the
            Privacy Act 1988. Your data may be transferred to servers outside Australia as described in Section 6. By using
            the Platform, you consent to this transfer.
          </p>

          <h2>9. Children's Privacy</h2>
          <p>
            The Platform is designed for business use and is not directed at individuals under 18. We do not knowingly
            collect data from minors. The DTC storefront module includes age verification (21+) as required by alcohol
            beverage regulations.
          </p>

          <h2>10. International Data Transfers</h2>
          <p>
            Your data may be processed in the United States or other countries where our infrastructure providers maintain
            servers. We ensure appropriate safeguards are in place for international data transfers.
          </p>

          <h2>11. Changes to This Policy</h2>
          <p>
            We will notify you of material changes via email at least 30 days before they take effect. Minor changes
            (clarifications, formatting) may be made without notice.
          </p>

          <h2>12. Contact</h2>
          <p>
            For privacy questions or data requests:{" "}
            <a href="mailto:privacy@solera.vin">privacy@solera.vin</a>
          </p>
          <p>
            For general support:{" "}
            <a href="mailto:support@solera.vin">support@solera.vin</a>
          </p>
        </div>
      </section>
    </>
  );
}