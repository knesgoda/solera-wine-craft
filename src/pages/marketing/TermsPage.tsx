import { SEOHead } from "@/components/SEOHead";

export default function TermsPage() {
  return (
    <>
      <SEOHead
        title="Terms of Service — Solera"
        description="Solera's terms of service. Subscription terms, data ownership, acceptable use, and refund policy."
        canonicalUrl="https://solera.vin/terms"
        breadcrumbs={[
          { name: "Home", url: "https://solera.vin" },
          { name: "Terms of Service", url: "https://solera.vin/terms" },
        ]}
      />

      <section className="bg-primary py-16 md:py-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="font-display text-3xl md:text-4xl font-bold text-primary-foreground">Terms of Service</h1>
          <p className="text-primary-foreground/70 mt-3">Last updated: March 18, 2026</p>
        </div>
      </section>

      <section className="py-16 bg-background">
        <div className="max-w-3xl mx-auto px-4 prose prose-lg prose-headings:font-display prose-headings:text-foreground prose-p:text-foreground/80 prose-a:text-primary prose-li:text-foreground/80 prose-strong:text-foreground">

          <p>
            These terms govern your use of Solera ("the platform," "we," "us"). By creating an account or using Solera,
            you agree to these terms. We've written them in plain English because we believe you should actually understand
            what you're agreeing to.
          </p>

          <h2>Your Account</h2>
          <ul>
            <li>You must provide accurate information when creating your account.</li>
            <li>You are responsible for keeping your login credentials secure.</li>
            <li>You must be at least 21 years old to use Solera (consistent with alcohol industry regulations).</li>
            <li>One organization account per winery or business entity. You may have multiple users within an organization.</li>
          </ul>

          <h2>Subscription Terms</h2>
          <ul>
            <li><strong>Free tier (Hobbyist):</strong> Free forever. No credit card required. Limited to 3 vintages, 1 vineyard, and core features.</li>
            <li><strong>Paid plans:</strong> Billed monthly or annually. Annual plans receive a 15% discount and lock your rate for 24 months.</li>
            <li><strong>No onboarding fees:</strong> We never charge setup, onboarding, or implementation fees.</li>
            <li><strong>No transaction markups:</strong> DTC sales are processed through our payment partner at standard rates. Solera adds zero markup.</li>
            <li><strong>Plan changes:</strong> You can upgrade or downgrade your plan at any time. Changes take effect at your next billing cycle.</li>
            <li><strong>Cancellation:</strong> You can cancel your subscription at any time. Your account remains active until the end of your current billing period.</li>
          </ul>

          <h2>Refund Policy</h2>
          <p>
            We want you to be happy with Solera. If you're not:
          </p>
          <ul>
            <li><strong>Within 14 days of any payment:</strong> Request a pro-rated refund for the unused portion of your billing period. No questions asked.</li>
            <li><strong>Annual plans:</strong> Pro-rated refund within 14 days of your annual payment. After 14 days, you may cancel but no refund is issued for the remaining term.</li>
            <li><strong>Free trial periods:</strong> You are never charged during a free trial. Cancel before the trial ends and you pay nothing.</li>
          </ul>
          <p>To request a refund, email <a href="mailto:kevin@solera.vin">kevin@solera.vin</a>.</p>

          <h2>Data Ownership</h2>
          <p>
            <strong>You own your data. Period.</strong>
          </p>
          <ul>
            <li>All winery data you enter into Solera — vintages, lab samples, cellar records, vineyard data, customer information, orders — belongs to you.</li>
            <li>We do not claim any ownership or intellectual property rights over your data.</li>
            <li>You can export your data at any time using Solera's built-in export features.</li>
            <li>If you cancel your account, you have 90 days to export your data before it is permanently deleted.</li>
            <li>We will never sell, license, or share your winery data with third parties for their benefit.</li>
          </ul>

          <h2>Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Use Solera for any illegal purpose or in violation of applicable laws and regulations.</li>
            <li>Attempt to access other users' accounts or data.</li>
            <li>Reverse engineer, decompile, or attempt to extract the source code of the platform.</li>
            <li>Use automated tools to scrape or extract data from Solera beyond your own account data.</li>
            <li>Interfere with or disrupt the platform's infrastructure.</li>
            <li>Resell access to Solera without written permission.</li>
            <li>Upload malicious code, viruses, or harmful content.</li>
          </ul>

          <h2>AI Features</h2>
          <ul>
            <li>Ask Solera and other AI features use your winery data to provide personalized insights.</li>
            <li>AI-generated recommendations are informational only and should not replace professional winemaking judgment.</li>
            <li>Your data sent to AI processors is not used to train AI models.</li>
            <li>AI features may occasionally produce inaccurate results. Always verify critical decisions independently.</li>
          </ul>

          <h2>Compliance & Regulatory</h2>
          <ul>
            <li>Solera provides tools to help with TTB compliance, but <strong>you are responsible</strong> for the accuracy of your regulatory filings.</li>
            <li>Generated compliance reports should be reviewed before submission to regulatory bodies.</li>
            <li>Solera is not a licensed compliance advisor and does not guarantee regulatory compliance.</li>
          </ul>

          <h2>Service Availability</h2>
          <ul>
            <li>We aim for 99.9% uptime but do not guarantee uninterrupted service.</li>
            <li>Scheduled maintenance will be communicated in advance whenever possible.</li>
            <li>The offline-capable features (lab entry, task completion) will continue to function without internet and sync when reconnected.</li>
          </ul>

          <h2>Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law:
          </p>
          <ul>
            <li>Solera is provided "as is" without warranties of any kind, express or implied.</li>
            <li>We are not liable for any indirect, incidental, special, or consequential damages arising from your use of the platform.</li>
            <li>Our total liability for any claim related to Solera is limited to the amount you paid us in the 12 months preceding the claim.</li>
            <li>We are not liable for losses resulting from AI-generated recommendations, compliance report errors, or data entered incorrectly by users.</li>
          </ul>

          <h2>Intellectual Property</h2>
          <ul>
            <li>The Solera platform, brand, logo, and proprietary features are owned by Solera.</li>
            <li>Your use of Solera does not grant you any rights to our intellectual property beyond the right to use the platform under these terms.</li>
            <li>Feedback or feature suggestions you provide may be used to improve the platform without obligation to you.</li>
          </ul>

          <h2>Termination</h2>
          <ul>
            <li>You can terminate your account at any time by canceling your subscription and requesting account deletion.</li>
            <li>We reserve the right to suspend or terminate accounts that violate these terms, with notice when practical.</li>
            <li>Upon termination, you have 90 days to export your data.</li>
          </ul>

          <h2>Governing Law</h2>
          <p>
            These terms are governed by the laws of the State of California, United States. Any disputes arising from these terms
            will be resolved in the courts of Santa Barbara County, California.
          </p>

          <h2>Changes to These Terms</h2>
          <p>
            We may update these terms from time to time. If we make material changes, we'll notify you via email or in-app notification
            at least 30 days before the changes take effect. Continued use of Solera after changes take effect constitutes acceptance
            of the updated terms.
          </p>

          <h2>Contact</h2>
          <p>
            Questions about these terms? Reach Kevin directly at{" "}
            <a href="mailto:kevin@solera.vin">kevin@solera.vin</a>.
          </p>
        </div>
      </section>
    </>
  );
}
