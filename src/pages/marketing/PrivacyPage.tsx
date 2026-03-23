import { SEOHead } from "@/components/SEOHead";

export default function PrivacyPage() {
  return (
    <>
      <SEOHead
        title="Privacy Policy — Solera"
        description="Solera's privacy policy. Learn how we collect, use, and protect your winery data. CCPA compliant."
        canonicalUrl="https://solera.vin/privacy"
        breadcrumbs={[
          { name: "Home", url: "https://solera.vin" },
          { name: "Privacy Policy", url: "https://solera.vin/privacy" },
        ]}
      />

      <section className="bg-primary py-16 md:py-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="font-display text-3xl md:text-4xl font-bold text-primary-foreground">Privacy Policy</h1>
          <p className="text-primary-foreground/70 mt-3">Last updated: March 18, 2026</p>
        </div>
      </section>

      <section className="py-16 bg-background">
        <div className="max-w-3xl mx-auto px-4 prose prose-lg prose-headings:font-display prose-headings:text-foreground prose-p:text-foreground/80 prose-a:text-primary prose-li:text-foreground/80 prose-strong:text-foreground">

          <p>
            Solera ("we," "us," or "our") respects your privacy. This policy explains in plain English what data we collect,
            why we collect it, and what rights you have over it. No legalese — just straightforward answers.
          </p>

          <h2>What Data We Collect</h2>
          <p>We collect only the data needed to run your winery management platform:</p>
          <ul>
            <li><strong>Account information:</strong> Your name, email address, and organization name when you sign up.</li>
            <li><strong>Winery data:</strong> Vintage records, lab samples, cellar operations, vineyard data, inventory, orders, and any other data you enter into Solera. <strong>This is your data — you own it, always.</strong></li>
            <li><strong>Payment information:</strong> Credit card details are collected and processed entirely by our payment partner (Paddle). We never see or store your full card number.</li>
            <li><strong>Usage data:</strong> Basic analytics like pages visited and features used, to help us improve the product.</li>
            <li><strong>Weather data:</strong> If you enable weather tracking, we fetch publicly available weather data for your vineyard locations from Open-Meteo.</li>
            <li><strong>Device information:</strong> Browser type, operating system, and IP address for security and troubleshooting.</li>
          </ul>

          <h2>How We Use Your Data</h2>
          <ul>
            <li>To provide and improve the Solera platform and its features.</li>
            <li>To process payments and manage your subscription.</li>
            <li>To send transactional emails (password resets, important account notifications).</li>
            <li>To provide AI-powered features like Ask Solera, harvest predictions, and anomaly detection — using your winery data to give you personalized insights.</li>
            <li>To generate compliance reports (TTB, state reports) that you request.</li>
            <li>To respond to support requests and communicate with you about your account.</li>
          </ul>
          <p>We do <strong>not</strong> sell your data to anyone. We do <strong>not</strong> use your winery data for advertising. We do <strong>not</strong> share your data with other wineries.</p>

          <h2>Third-Party Processors</h2>
          <p>We use the following services to operate Solera. Each processes data only as necessary to provide their service:</p>
          <ul>
            <li><strong>Supabase</strong> — Database hosting, authentication, and file storage. Your winery data is stored in Supabase's infrastructure.</li>
            <li><strong>Stripe</strong> — Payment processing. Stripe handles all credit card data under their own PCI-compliant privacy policy.</li>
            <li><strong>Resend</strong> — Transactional email delivery (password resets, notifications).</li>
            <li><strong>Anthropic</strong> — AI processing for Ask Solera and other AI features. Your data is sent to Anthropic's API for processing but is not retained by Anthropic for training.</li>
            <li><strong>Open-Meteo</strong> — Weather data retrieval. Only your vineyard's geographic coordinates are sent; no personal data.</li>
          </ul>

          <h2>Data Retention</h2>
          <ul>
            <li><strong>Active accounts:</strong> Your data is retained as long as your account is active.</li>
            <li><strong>After cancellation:</strong> Your data is retained for 90 days after account cancellation, giving you time to export or reactivate. After 90 days, it is permanently deleted.</li>
            <li><strong>Backups:</strong> Encrypted backups may retain data for up to 30 additional days after deletion.</li>
            <li><strong>Legal obligations:</strong> Some data may be retained longer if required by law (e.g., tax records, TTB compliance records).</li>
          </ul>

          <h2>Your Rights</h2>
          <p>You have the right to:</p>
          <ul>
            <li><strong>Access:</strong> Request a copy of all data we hold about you and your organization.</li>
            <li><strong>Deletion:</strong> Request that we delete your account and all associated data. We will comply within 30 days, subject to legal retention requirements.</li>
            <li><strong>Portability:</strong> Export your winery data at any time. Solera includes built-in data export features for all your records — we will never hold your data hostage.</li>
            <li><strong>Correction:</strong> Request correction of inaccurate personal information.</li>
            <li><strong>Opt-out:</strong> Opt out of non-essential communications at any time.</li>
          </ul>

          <h2>California Residents (CCPA)</h2>
          <p>
            If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA):
          </p>
          <ul>
            <li>The right to know what personal information we collect and how it is used.</li>
            <li>The right to delete your personal information.</li>
            <li>The right to opt out of the sale of personal information. <strong>We do not sell personal information.</strong></li>
            <li>The right to non-discrimination for exercising your CCPA rights.</li>
          </ul>
          <p>To exercise any of these rights, contact us at <a href="mailto:kevin@solera.vin">kevin@solera.vin</a>.</p>

          <h2>Cookies</h2>
          <p>
            We use essential cookies for authentication and session management. We do not use third-party advertising or tracking cookies.
          </p>

          <h2>Security</h2>
          <p>
            We take security seriously. All data is encrypted in transit (TLS) and at rest. We use row-level security policies
            to ensure your data is only accessible to your organization. Authentication tokens are securely managed, and
            sensitive credentials are stored in encrypted vaults.
          </p>

          <h2>Children's Privacy</h2>
          <p>
            Solera is not intended for use by anyone under 21 years of age (consistent with alcohol industry regulations).
            We do not knowingly collect data from minors.
          </p>

          <h2>Changes to This Policy</h2>
          <p>
            We may update this policy from time to time. If we make significant changes, we'll notify you via email
            or an in-app notification. The "last updated" date at the top of this page reflects the most recent revision.
          </p>

          <h2>Contact</h2>
          <p>
            Questions about this policy? Reach Kevin directly at{" "}
            <a href="mailto:kevin@solera.vin">kevin@solera.vin</a>.
          </p>
        </div>
      </section>
    </>
  );
}
