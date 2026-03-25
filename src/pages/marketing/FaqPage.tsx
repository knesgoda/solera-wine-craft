import { Link } from "react-router-dom";
import { SEOHead, buildFaqSchema } from "@/components/SEOHead";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const FAQ_CATEGORIES = [
  {
    category: "Getting Started",
    items: [
      { question: "What is Solera?", answer: "Solera is a complete winery management platform that covers vineyard operations, cellar management, lab tracking, DTC sales, wine clubs, custom crush, TTB compliance, and AI — all in one place." },
      { question: "How do I sign up?", answer: "We're currently in final testing. Visit solera.vin/coming-soon to join the waitlist and be first to know when we go live." },
      { question: "Is there really a free plan forever?", answer: "Yes — the Hobbyist plan is free forever with no credit card required. It includes 1 vineyard, 2 blocks, vintage tracking, lab samples, weather, and data import." },
      { question: "What do I need to get started?", answer: "Just a web browser. Solera is a Progressive Web App (PWA) that works on desktop, tablet, and mobile. You can install it on your home screen for native-like experience." },
    ],
  },
  {
    category: "Pricing & Billing",
    items: [
      { question: "Do you charge onboarding fees?", answer: "Never. Every Solera plan includes free onboarding. Enterprise plans include a dedicated concierge call." },
      { question: "What happens to my DTC transaction fees?", answer: "You pay standard payment processing fees. Solera adds zero markup. Many competitors add 1-3% on top." },
      { question: "Is there a free trial on paid plans?", answer: "Yes — 30 days free on Pro, Growth, and Enterprise. No credit card required to start." },
      { question: "Can I change plans at any time?", answer: "Yes — upgrade or downgrade any time. Upgrades take effect immediately. Downgrades apply at the end of your current billing period." },
      { question: "What does the annual price lock mean?", answer: "Your rate is guaranteed for 24 months on any annual plan. Even if we raise prices, your rate stays the same." },
      { question: "What is custom crush pricing?", answer: "Enterprise starts at $399/mo and includes up to 10 client organizations. Additional client orgs are $10–15/mo each." },
    ],
  },
  {
    category: "Data & Migration",
    items: [
      { question: "Can I import my data from Innovint or VinNow?", answer: "Yes — every plan includes AI-assisted import. Upload your CSV or XLSX export and Solera automatically maps your columns to the correct fields." },
      { question: "How long does data migration take?", answer: "Most imports complete in under 5 minutes. Complex datasets with thousands of rows may take 10-15 minutes." },
      { question: "Can I export my data from Solera?", answer: "Yes — you always own your data. Export any table as CSV at any time from the settings panel." },
      { question: "What file formats do you support for import?", answer: "CSV and XLSX (Excel). We support exports from Innovint, VinNow, and any other winery software that can export to spreadsheet format." },
    ],
  },
  {
    category: "Features",
    items: [
      { question: "How does the AI assistant work?", answer: "Ask Solera uses your actual winery data — lab readings, weather, GDD, vintage history — to answer questions in plain English. It's not generic advice; it's grounded in your operation." },
      { question: "What weather data does Solera use?", answer: "We integrate with Open-Meteo for free weather data including temperature, precipitation, and GDD calculations. Enterprise plans can upgrade to Tomorrow.io for premium ag-specific data." },
      { question: "Does Solera handle TTB compliance?", answer: "Yes — Solera generates OW-1 monthly reports, tracks TTB additions by category, and exports Certificates of Analysis. We also integrate with ShipCompliant for DTC shipping compliance." },
    ],
  },
  {
    category: "Mobile & Offline",
    items: [
      { question: "Does Solera work offline?", answer: "Yes — field crew task completion, lab sample entry, and fermentation logging all work offline. Data syncs automatically when you reconnect." },
      { question: "Is there a mobile app?", answer: "Solera is a Progressive Web App (PWA) that can be installed on any smartphone. A native iOS and Android app is on our roadmap." },
      { question: "What offline features are available?", answer: "Task completion, lab sample entry, and fermentation log entry work offline. Data is queued locally and syncs when you're back online." },
    ],
  },
  {
    category: "Compliance",
    items: [
      { question: "Does Solera generate OW-1 reports?", answer: "Yes — Solera automatically generates TTB OW-1 monthly reports based on your production data, additions, and inventory movements." },
      { question: "How does ShipCompliant integration work?", answer: "Connect your ShipCompliant account in Settings → Integrations. Solera checks shipping compliance in real-time and validates state-by-state permissions before orders ship." },
    ],
  },
  {
    category: "Custom Crush",
    items: [
      { question: "How does the client portal work?", answer: "Each custom crush client gets their own branded portal where they can view their vintages, lab results, messages, and documents. You control what they see." },
      { question: "How many clients can I have?", answer: "Enterprise plan includes 10 client organizations. Additional clients are $10-15/mo each." },
    ],
  },
  {
    category: "Integrations",
    items: [
      { question: "What integrations does Solera support?", answer: "Commerce7, WineDirect, Shopify, QuickBooks Online, Google Sheets, ShipCompliant, and Tomorrow.io weather. More integrations are on our roadmap." },
      { question: "Does Solera have an API?", answer: "Yes — Growth and Enterprise plans include REST API access with scoped API keys. See our developer documentation at /developers." },
      { question: "Can I connect multiple integrations?", answer: "Yes — you can run Commerce7, Shopify, and QuickBooks simultaneously. Each integration syncs independently." },
    ],
  },
];

const ALL_FAQS = FAQ_CATEGORIES.flatMap((c) => c.items);

export default function FaqPage() {
  return (
    <>
      <SEOHead
        title="FAQ — Solera Winery Management"
        description="Frequently asked questions about Solera: pricing, features, data migration, compliance, offline mode, integrations, and more."
        jsonLd={buildFaqSchema(ALL_FAQS)}
        breadcrumbs={[
          { name: "Home", url: "https://solera.vin" },
          { name: "FAQ", url: "https://solera.vin/faq" },
        ]}
      />

      <section className="pt-28 pb-16 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 lg:px-8 text-center">
          <h1 className="font-display text-4xl md:text-5xl font-bold mb-4">Frequently Asked Questions</h1>
          <p className="text-xl text-primary-foreground/80">Everything you need to know about Solera.</p>
        </div>
      </section>

      <section className="py-16 bg-background">
        <div className="container mx-auto px-4 lg:px-8 max-w-3xl">
          {FAQ_CATEGORIES.map((cat) => (
            <div key={cat.category} className="mb-12">
              <h2 className="font-display text-2xl font-bold text-foreground mb-4">{cat.category}</h2>
              <Accordion type="single" collapsible className="w-full">
                {cat.items.map((faq, i) => (
                  <AccordionItem key={i} value={`${cat.category}-${i}`}>
                    <AccordionTrigger className="text-left">{faq.question}</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">{faq.answer}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
