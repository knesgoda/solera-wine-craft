import { SEOHead } from "@/components/SEOHead";

export default function TermsPage() {
  return (
    <>
      <SEOHead
        title="Terms of Service — Solera"
        description="Solera's terms of service. Subscription terms, data ownership, Paddle billing, international users, acceptable use, and refund policy."
        canonicalUrl="https://solera.vin/terms"
        breadcrumbs={[
          { name: "Home", url: "https://solera.vin" },
          { name: "Terms of Service", url: "https://solera.vin/terms" },
        ]}
      />

      <section className="bg-primary py-16 md:py-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="font-display text-3xl md:text-4xl font-bold text-primary-foreground">Terms of Service</h1>
          <p className="text-primary-foreground/70 mt-3">Last Updated: March 2026</p>
        </div>
      </section>

      <section className="py-16 bg-background">
        <div className="max-w-3xl mx-auto px-4 prose prose-lg prose-headings:font-display prose-headings:text-foreground prose-p:text-foreground/80 prose-a:text-primary prose-li:text-foreground/80 prose-strong:text-foreground">

          <h2>1. Agreement to Terms</h2>
          <p>
            By accessing or using Solera ("the Platform") at solera.vin, you agree to be bound by these Terms of Service.
            If you do not agree, do not use the Platform. "You" refers to the individual or organization accessing the
            Platform. "We," "us," and "our" refer to Solera.
          </p>

          <h2>2. Description of Service</h2>
          <p>
            Solera is a cloud-based winery and vineyard management platform. The Platform provides tools for vineyard
            operations, vintage and lab tracking, cellar and fermentation management, AI-powered analytics, data migration,
            sales and direct-to-consumer commerce, custom crush client management, and regulatory compliance reporting.
            Features available to you depend on your subscription tier.
          </p>

          <h2>3. Accounts and Organizations</h2>
          <p>
            You must create an account to use the Platform. You are responsible for maintaining the confidentiality of your
            login credentials and for all activity under your account. Each account belongs to one organization. Organization
            administrators are responsible for managing user access within their organization. You must provide accurate and
            current information during registration.
          </p>

          <h2>4. Subscription Tiers and Billing</h2>
          <p>
            Solera offers tiered subscriptions: Hobbyist (free), Pro, Growth, and Enterprise. Paid subscriptions are billed
            monthly or annually as selected at checkout.
          </p>
          <p>
            All payments are processed by{" "}
            <a href="https://www.paddle.com" target="_blank" rel="noopener noreferrer">Paddle.com Market Limited</a>{" "}
            ("Paddle"), which acts as our Merchant of Record. This means Paddle is the entity that processes your payment,
            handles applicable sales tax, VAT, and GST, and is the seller of record for your subscription. By subscribing,
            you also agree to Paddle's{" "}
            <a href="https://www.paddle.com/legal/terms" target="_blank" rel="noopener noreferrer">Terms of Use</a> and{" "}
            <a href="https://www.paddle.com/legal/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
          </p>
          <p>
            Prices are displayed in your local currency where supported by Paddle. We reserve the right to change pricing
            with 30 days' written notice. Existing subscribers on annual plans are rate-locked for 24 months from their
            subscription start date.
          </p>

          <h2>5. Free Tier</h2>
          <p>
            The Hobbyist tier is free with no time limit. It includes limited functionality as described on our{" "}
            <a href="/pricing">pricing page</a>. We reserve the right to modify free tier features with 30 days' notice.
            We will not delete free tier data without 90 days' advance notice.
          </p>

          <h2>6. Cancellation and Refunds</h2>
          <p>
            You may cancel your subscription at any time from your account settings. Cancellation takes effect at the end of
            your current billing period — you retain access until then.
          </p>
          <p>
            Refund requests are handled in accordance with Paddle's refund policy, available at{" "}
            <a href="https://www.paddle.com/legal/refund-policy" target="_blank" rel="noopener noreferrer">
              paddle.com/legal/refund-policy
            </a>.
          </p>
          <p>
            Upon cancellation, we automatically generate a complete export of your data and email a download link to all
            users in your organization. Your data is retained for 90 days after cancellation, after which it may be
            permanently deleted.
          </p>

          <h2>7. Data Ownership and Portability</h2>
          <p>
            <strong>You own your data.</strong> We claim no intellectual property rights over the content you store in
            Solera — your vineyard records, lab samples, fermentation logs, compliance documents, customer lists, and all
            other data remain yours.
          </p>
          <p>
            You may export a complete copy of your data at any time using the Data Backup & Export feature, available on all
            tiers at no additional cost. Exports are provided in CSV and/or Excel format with SHA-256 integrity verification.
          </p>

          <h2>8. AI Features</h2>
          <p>
            The Platform includes AI-powered features ("Ask Solera") that provide analytical suggestions based on your winery
            data. AI outputs are informational only and do not constitute professional winemaking, agricultural, legal,
            financial, or compliance advice. You are responsible for all decisions made using AI-generated insights.
          </p>
          <p>
            Your data may be used to provide contextual AI responses within your organization's account. Your data is not
            used to train AI models and is not shared with other organizations.
          </p>

          <h2>9. Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Violate any applicable law or regulation.</li>
            <li>Attempt to access another organization's data.</li>
            <li>Interfere with or disrupt the Platform's infrastructure.</li>
            <li>Reverse engineer, decompile, or disassemble any part of the Platform.</li>
            <li>Use the Platform to store or transmit malicious code.</li>
            <li>Resell access to the Platform without written permission.</li>
          </ul>
          <p>We may suspend or terminate accounts that violate these terms.</p>

          <h2>10. Regulatory Compliance Features</h2>
          <p>
            The Platform includes features designed to assist with TTB (Alcohol and Tobacco Tax and Trade Bureau) compliance
            reporting, including OW-1 report generation. These features are tools to assist your compliance workflow — they
            do not guarantee regulatory compliance. You are solely responsible for the accuracy of your regulatory filings.
          </p>
          <p>
            Solera is not a licensed tax advisor, legal advisor, or compliance consultant. For wineries outside the United
            States, compliance features may not apply to your local regulatory requirements.
          </p>

          <h2>11. Availability and Support</h2>
          <p>
            We target 99.9% uptime but do not guarantee uninterrupted service. Scheduled maintenance will be announced in
            advance. The Platform includes offline functionality for core operations (task completion, lab sample entry),
            which syncs when connectivity is restored. Support is available via email at{" "}
            <a href="mailto:support@solera.vin">support@solera.vin</a>.
          </p>

          <h2>12. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, Solera shall not be liable for any indirect, incidental, special,
            consequential, or punitive damages, including loss of profits, data, or crop value, arising from your use of the
            Platform. Our total liability for any claim shall not exceed the amount you paid us in the 12 months preceding
            the claim. This limitation applies regardless of the theory of liability.
          </p>

          <h2>13. Indemnification</h2>
          <p>
            You agree to indemnify and hold harmless Solera, its officers, and affiliates from any claims, damages, or
            expenses arising from your use of the Platform, your violation of these terms, or your violation of any
            applicable law.
          </p>

          <h2>14. International Users</h2>
          <p>
            The Platform is available to users worldwide. By using the Platform from outside the United States, you consent
            to the transfer of your data to servers located in the United States (or such other locations as our
            infrastructure provider may use). We process data in accordance with our{" "}
            <a href="/privacy">Privacy Policy</a>.
          </p>
          <p>
            For users in the European Economic Area, United Kingdom, or other jurisdictions with data protection laws, please
            refer to our Privacy Policy for information on how we handle your data in compliance with applicable regulations.
          </p>

          <h2>15. Changes to Terms</h2>
          <p>
            We may update these Terms from time to time. Material changes will be communicated via email to the address
            associated with your account at least 30 days before taking effect. Continued use of the Platform after changes
            take effect constitutes acceptance.
          </p>

          <h2>16. Governing Law</h2>
          <p>
            These Terms are governed by the laws of the State of California, United States, without regard to conflict of law
            provisions. Any disputes shall be resolved in the courts of Ventura County, California. For international users,
            nothing in these Terms affects your statutory rights under applicable local consumer protection laws.
          </p>

          <h2>17. Contact</h2>
          <p>
            Questions about these Terms? Contact us at{" "}
            <a href="mailto:legal@solera.vin">legal@solera.vin</a>.
          </p>
        </div>
      </section>
    </>
  );
}