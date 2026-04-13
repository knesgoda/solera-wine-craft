import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SEOHead, buildFaqSchema } from "@/components/SEOHead";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Check, Minus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getPaddle } from "@/lib/paddle-client";
import { PADDLE_PRICES, ALL_PAID_PRICE_IDS } from "@/constants/paddle-prices";

const TIERS = [
  {
    key: "hobbyist",
    name: "Hobbyist",
    badge: "Most Popular for Hobbyists",
    badgeColor: "secondary",
    highlight: false,
    users: "1 user",
    features: [
      "1 vineyard, 2 blocks",
      "Vintage & lab tracking",
      "Weather & GDD tracking",
      "Data import (CSV/XLSX)",
      "Mobile PWA with offline",
      "Community support",
    ],
  },
  {
    key: "pro",
    name: "Pro",
    badge: null,
    highlight: false,
    users: "Up to 5 users",
    features: [
      "Everything in Hobbyist",
      "Unlimited vineyards & blocks",
      "Cellar & fermentation module",
      "TTB compliance & OW-1 reports",
      "Google Sheets sync",
      "Email support",
    ],
  },
  {
    key: "growth",
    name: "Growth",
    badge: "Most Popular",
    badgeColor: "default",
    highlight: true,
    users: "Up to 15 users",
    features: [
      "Everything in Pro",
      "Production cost tracking (COGS per gallon, barrel, case)",
      "Blend cost propagation — costs follow gallons automatically",
      "QuickBooks cost export",
      "Ask Solera AI assistant",
      "DTC storefront & wine club",
      "Commerce7, WineDirect, Shopify sync",
      "Multi-facility & API access",
      "Priority support",
    ],
  },
  {
    key: "enterprise",
    name: "Enterprise",
    badge: null,
    highlight: false,
    users: "Unlimited users",
    features: [
      "Everything in Growth",
      "Grower contract management with grading scales",
      "Harvest intake with auto-pricing",
      "Custom crush client portal (10 clients)",
      "SSO / SAML 2.0",
      "Audit logging",
      "SMS alerts (Twilio)",
      "Tomorrow.io premium weather",
      "Webhooks & advanced API",
      "Dedicated onboarding concierge",
    ],
  },
];

type ComparisonCell = true | string | false;

const COMPARISON_ROWS: { feature: string; hobbyist: ComparisonCell; pro: ComparisonCell; growth: ComparisonCell; enterprise: ComparisonCell; group?: string }[] = [
  { feature: "Vineyards & blocks", hobbyist: "1 / 2", pro: "Unlimited", growth: "Unlimited", enterprise: "Unlimited" },
  { feature: "Vintage & lab tracking", hobbyist: true, pro: true, growth: true, enterprise: true },
  { feature: "Weather & GDD", hobbyist: true, pro: true, growth: true, enterprise: true },
  { feature: "Ripening comparison dashboard", hobbyist: true, pro: true, growth: true, enterprise: true },
  { feature: "Ripening divergence alerts", hobbyist: false, pro: true, growth: true, enterprise: true },
  { feature: "Cross-block lab overlay", hobbyist: false, pro: true, growth: true, enterprise: true },
  { feature: "Data import (CSV/XLSX)", hobbyist: true, pro: true, growth: true, enterprise: true },
  { feature: "Mobile PWA with offline", hobbyist: true, pro: true, growth: true, enterprise: true },
  { feature: "Cellar & fermentation", hobbyist: false, pro: true, growth: true, enterprise: true },
  { feature: "TTB compliance & OW-1", hobbyist: false, pro: true, growth: true, enterprise: true },
  { feature: "Google Sheets sync", hobbyist: false, pro: true, growth: true, enterprise: true },
  { feature: "Production cost tracking (COGS)", hobbyist: false, pro: false, growth: "Per-lot, per-barrel, per-gallon", enterprise: true },
  { feature: "QuickBooks COGS export", hobbyist: false, pro: false, growth: true, enterprise: true },
  { feature: "Ask Solera AI", hobbyist: false, pro: false, growth: true, enterprise: true },
  { feature: "DTC storefront & wine club", hobbyist: false, pro: false, growth: true, enterprise: true },
  { feature: "Commerce7 / WineDirect / Shopify", hobbyist: false, pro: false, growth: true, enterprise: true },
  { feature: "Multi-facility", hobbyist: false, pro: false, growth: true, enterprise: true },
  { feature: "Grower contract management", hobbyist: false, pro: false, growth: false, enterprise: "Multi-metric grading scales" },
  { feature: "Harvest intake & weigh tags", hobbyist: false, pro: false, growth: false, enterprise: "Auto-pricing from contracts" },
  { feature: "Custom crush client portal", hobbyist: false, pro: false, growth: false, enterprise: "10 clients included" },
  { feature: "SSO / SAML 2.0", hobbyist: false, pro: false, growth: false, enterprise: true },
  { feature: "Audit logging", hobbyist: false, pro: false, growth: false, enterprise: true },
  { feature: "Webhooks & API", hobbyist: false, pro: false, growth: true, enterprise: true },
  // Platform & Infrastructure
  { feature: "Multi-language support", hobbyist: true, pro: true, growth: true, enterprise: true, group: "Platform" },
  { feature: "Timezone & unit customization", hobbyist: true, pro: true, growth: true, enterprise: true },
  { feature: "On-demand data export (CSV/Excel)", hobbyist: true, pro: true, growth: true, enterprise: true },
  { feature: "Scheduled automatic backups", hobbyist: true, pro: true, growth: true, enterprise: true },
  { feature: "Cancellation auto-export with 90-day retention", hobbyist: true, pro: true, growth: true, enterprise: true },
  { feature: "Support", hobbyist: "Community", pro: "Email", growth: "Priority", enterprise: "Dedicated concierge" },
];

const COMPETITOR_DATA: Record<string, { cost: number; tier: string; tierCost: number }> = {
  innovint: { cost: 149, tier: "Pro", tierCost: 69 },
  ekos: { cost: 279, tier: "Pro", tierCost: 69 },
  winedirect: { cost: 149, tier: "Growth", tierCost: 129 },
  commerce7: { cost: 299, tier: "Growth", tierCost: 129 },
  vintrace: { cost: 184, tier: "Growth", tierCost: 129 },
  spreadsheets: { cost: 0, tier: "Hobbyist", tierCost: 0 },
  multiple: { cost: 700, tier: "Growth", tierCost: 129 },
};

const FAQS = [
  { question: "Is there really a free plan forever?", answer: "Yes — the Hobbyist plan is free forever with no credit card required. Perfect for home winemakers and hobbyists with a single vineyard." },
  { question: "Do you charge onboarding fees?", answer: "Never. Every Solera plan includes free onboarding. Enterprise plans include a dedicated concierge." },
  { question: "Can I import my data from Innovint or VinNow?", answer: "Yes — every plan includes AI-assisted import. Upload your CSV/XLSX export and Solera maps your columns automatically." },
  { question: "Is there a free trial on paid plans?", answer: "Yes — 30 days free on any paid plan, no credit card required." },
  { question: "Can I change plans at any time?", answer: "Yes — upgrade or downgrade any time. Changes take effect immediately." },
  { question: "What does the annual price lock mean?", answer: "Your rate is guaranteed for 24 months on any annual plan. Even if prices go up, your rate stays the same." },
  { question: "Does Solera work offline?", answer: "Yes — field crew task completion and lab entry work offline and sync automatically when reconnected." },
  { question: "What is production cost tracking?", answer: "Growth plans include full COGS tracking per lot, barrel, and gallon. Costs follow wine through blending operations automatically. You'll never reconcile a COGS spreadsheet in Xero again." },
  { question: "What is grower contract management?", answer: "Enterprise plans include grape purchase agreements with multi-metric grading scales, automated intake pricing, and financial reporting — all connected to your cellar data and COGS." },
  { question: "What is custom crush pricing?", answer: "Enterprise starts at $399/mo including up to 10 client organizations. Additional client orgs are $10–15/mo each." },
  { question: "How does the AI assistant work?", answer: "Ask Solera uses your actual winery data — lab readings, weather, GDD, vintage history — to answer questions in plain English. No generic advice." },
];

// Fallback prices if PricePreview fails
const FALLBACK_PRICES: Record<string, Record<string, string>> = {
  'pri_01kmdx9xd7y43185qppke728d9': { formatted: "$69/mo" },
  'pri_01kmdxb9xev9x8823v4ssbvj1m': { formatted: "$59/mo" },
  'pri_01kmdxcs28byfa4q5ye3kh1xj3': { formatted: "$129/mo" },
  'pri_01kmdxeyq34dvq3mxex2xdyfwm': { formatted: "$109/mo" },
  'pri_01kmdxkejxc2bssknbrm9phj48': { formatted: "$399/mo" },
  'pri_01kmdxmnh6v670ng8dtz5skec8': { formatted: "$339/mo" },
};

function ComparisonCellContent({ value }: { value: ComparisonCell }) {
  if (value === false) return <Minus className="h-4 w-4 text-muted-foreground/40 mx-auto" />;
  if (value === true) return <Check className="h-4 w-4 text-secondary mx-auto" />;
  // String = checkmark + tooltip subtext
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex flex-col items-center gap-0.5">
            <Check className="h-4 w-4 text-secondary" />
            <span className="text-[10px] text-muted-foreground leading-tight text-center hidden sm:block">{value}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent><p className="text-xs">{value}</p></TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);
  const [competitor, setCompetitor] = useState<string>("");
  const [prices, setPrices] = useState<Record<string, string>>({});
  const { user, profile, organization } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchPrices() {
      try {
        const paddle = await getPaddle();
        if (!paddle) {
          const fallback: Record<string, string> = {};
          for (const [id, data] of Object.entries(FALLBACK_PRICES)) {
            fallback[id] = data.formatted;
          }
          setPrices(fallback);
          return;
        }

        const preview = await paddle.PricePreview({
          items: ALL_PAID_PRICE_IDS.map(id => ({ priceId: id, quantity: 1 })),
        });

        const priceMap: Record<string, string> = {};
        for (const item of preview.data?.details?.lineItems || []) {
          priceMap[item.price.id] = item.formattedTotals?.subtotal || item.formattedTotals?.total || "";
        }
        if (Object.keys(priceMap).length > 0) {
          setPrices(priceMap);
        } else {
          const fallback: Record<string, string> = {};
          for (const [id, data] of Object.entries(FALLBACK_PRICES)) {
            fallback[id] = data.formatted;
          }
          setPrices(fallback);
        }
      } catch (e) {
        console.warn("Paddle PricePreview failed, using fallback prices:", e);
        const fallback: Record<string, string> = {};
        for (const [id, data] of Object.entries(FALLBACK_PRICES)) {
          fallback[id] = data.formatted;
        }
        setPrices(fallback);
      }
    }
    fetchPrices();
  }, []);

  const handleCheckout = async (tierKey: string) => {
    if (tierKey === "hobbyist") {
      navigate("/signup");
      return;
    }

    // If user is logged in and already has a subscription, send them to billing settings
    if (user && organization) {
      navigate("/settings/billing");
      return;
    }

    // If user is logged in but no subscription, open Paddle inline checkout
    if (user && organization?.id) {
      const paddleKey = TIER_TO_PADDLE[tierKey] || tierKey;
      const priceConfig = PADDLE_PRICES[paddleKey as keyof typeof PADDLE_PRICES];
      if (!priceConfig) return;
      const priceId = annual && "annual" in priceConfig
        ? (priceConfig as any).annual
        : priceConfig.monthly;

      try {
        const paddle = await getPaddle();
        if (!paddle) {
          navigate("/settings/billing");
          return;
        }
        paddle.Checkout.open({
          items: [{ priceId, quantity: 1 }],
          customer: { email: user.email || "" },
          customData: { org_id: organization.id },
          settings: {
            successUrl: `${window.location.origin}/settings/billing?checkout=success`,
            theme: "light",
            locale: "en",
          },
        });
      } catch {
        navigate("/settings/billing");
      }
      return;
    }

    // Not logged in — send to signup
    navigate("/signup");
  };

  const TIER_TO_PADDLE: Record<string, string> = {
    pro: "small_boutique",
    growth: "mid_size",
  };

  const getPrice = (tierKey: string): string => {
    if (tierKey === "hobbyist") return "Free";
    const paddleKey = TIER_TO_PADDLE[tierKey] || tierKey;
    const priceConfig = PADDLE_PRICES[paddleKey as keyof typeof PADDLE_PRICES];
    if (!priceConfig) return "";
    const priceId = annual && "annual" in priceConfig
      ? (priceConfig as any).annual
      : priceConfig.monthly;
    return prices[priceId] || FALLBACK_PRICES[priceId]?.formatted || "";
  };

  const comp = competitor ? COMPETITOR_DATA[competitor] : null;

  return (
    <>
      <SEOHead
        title="Pricing | Solera — Free Tier, Pro $69/mo, Growth $129/mo, Enterprise $399/mo"
        description="Solera pricing starts free for hobbyists. Pro at $69/mo for boutique wineries. Growth at $129/mo with production cost tracking (COGS) and AI. Enterprise at $399/mo with grower contracts and custom crush portals. No onboarding fees. 30-day free trial on all paid plans."
        jsonLd={buildFaqSchema(FAQS)}
        breadcrumbs={[
          { name: "Home", url: "https://solera.vin" },
          { name: "Pricing", url: "https://solera.vin/pricing" },
        ]}
      />

      {/* Hero */}
      <section className="pt-28 pb-16 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 lg:px-8 text-center">
          <h1 className="font-display text-4xl md:text-5xl font-bold mb-4">
            Honest pricing for every winemaker.
          </h1>
          <p className="text-xl text-primary-foreground/80">Start free. Upgrade when you're ready.</p>
        </div>
      </section>

      {/* Toggle + Tier Cards */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="flex items-center justify-center gap-4 mb-12">
            <button
              onClick={() => setAnnual(false)}
              className={`text-sm font-medium px-4 py-2 rounded-md transition-colors ${!annual ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`text-sm font-medium px-4 py-2 rounded-md transition-colors ${annual ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Annual <span className="text-xs ml-1 text-secondary">(Save 15%)</span>
            </button>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {TIERS.map((t) => {
              const priceStr = getPrice(t.key);
              return (
                <Card
                  key={t.name}
                  className={`relative ${t.highlight ? "border-secondary border-2 shadow-xl scale-[1.02]" : "bg-card"}`}
                >
                  {t.badge && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap">
                      {t.badge}
                    </Badge>
                  )}
                  <CardHeader className="text-center pb-2">
                    <CardTitle className="font-display text-xl">{t.name}</CardTitle>
                    <div className="mt-2">
                      <span className="text-4xl font-bold text-foreground">
                        {priceStr || "Free"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{t.users}</p>
                    {t.key !== "hobbyist" && (
                      <Badge variant="outline" className="mt-2 text-xs">
                        30-day free trial
                      </Badge>
                    )}
                  </CardHeader>
                  <CardContent className="pt-4">
                    <ul className="space-y-2.5 mb-6">
                      {t.features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-sm text-foreground">
                          <Check className="h-4 w-4 text-secondary shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      className={`w-full ${t.highlight ? "bg-secondary text-secondary-foreground hover:bg-secondary/90" : ""}`}
                      variant={t.highlight ? "default" : "outline"}
                      onClick={() => handleCheckout(t.key)}
                    >
                      {t.key === "hobbyist" ? "Start Free" : "Start Free Trial"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <p className="text-center text-sm text-muted-foreground mt-8">
            No onboarding fees ever. Annual plans lock your rate for 24 months.
          </p>
        </div>
      </section>

      {/* Feature Comparison Table */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4 lg:px-8">
          <h2 className="font-display text-3xl font-bold text-foreground text-center mb-10">
            Compare plans side by side
          </h2>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Feature</TableHead>
                  <TableHead className="text-center min-w-[100px]">Hobbyist</TableHead>
                  <TableHead className="text-center min-w-[100px]">Pro</TableHead>
                  <TableHead className="text-center min-w-[100px] text-secondary font-bold">Growth</TableHead>
                  <TableHead className="text-center min-w-[100px]">Enterprise</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {COMPARISON_ROWS.map((row) => (
                  <TableRow key={row.feature}>
                    <TableCell className="font-medium text-sm">{row.feature}</TableCell>
                    <TableCell className="text-center"><ComparisonCellContent value={row.hobbyist} /></TableCell>
                    <TableCell className="text-center"><ComparisonCellContent value={row.pro} /></TableCell>
                    <TableCell className="text-center"><ComparisonCellContent value={row.growth} /></TableCell>
                    <TableCell className="text-center"><ComparisonCellContent value={row.enterprise} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </section>

      {/* Savings Calculator */}
      <section className="py-16 bg-muted/50">
        <div className="container mx-auto px-4 lg:px-8 max-w-2xl">
          <h2 className="font-display text-3xl font-bold text-foreground text-center mb-8">See how much you save.</h2>
          <div className="bg-card rounded-xl border p-8">
            <label className="text-sm font-medium text-foreground mb-2 block">I currently use...</label>
            <Select value={competitor} onValueChange={setCompetitor}>
              <SelectTrigger><SelectValue placeholder="Select your current tool" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="innovint">Innovint</SelectItem>
                <SelectItem value="ekos">Ekos</SelectItem>
                <SelectItem value="winedirect">WineDirect</SelectItem>
                <SelectItem value="commerce7">Commerce7</SelectItem>
                <SelectItem value="vintrace">vintrace</SelectItem>
                <SelectItem value="spreadsheets">Spreadsheets</SelectItem>
                <SelectItem value="multiple">Multiple tools</SelectItem>
              </SelectContent>
            </Select>

            {comp && (
              <div className="mt-6 p-6 bg-muted rounded-lg text-center">
                <p className="text-muted-foreground mb-2">
                  You currently pay ~<span className="font-bold text-foreground">${comp.cost}/mo</span>
                </p>
                <p className="text-muted-foreground mb-2">
                  Solera <span className="font-semibold text-foreground">{comp.tier}</span> costs <span className="font-bold text-foreground">${comp.tierCost}/mo</span>
                </p>
                {comp.cost > comp.tierCost ? (
                  <p className="text-lg font-bold text-green-600 mt-4">
                    You save ${comp.cost - comp.tierCost}/mo — ${(comp.cost - comp.tierCost) * 12}/year
                  </p>
                ) : (
                  <p className="text-lg font-bold text-secondary mt-4">
                    Solera is free! Upgrade to Pro at $69/mo when you need more.
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-3">
                  Solera Growth includes COGS tracking — no separate accounting tool needed.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4 lg:px-8 max-w-3xl">
          <h2 className="font-display text-3xl font-bold text-foreground text-center mb-8">
            Frequently Asked Questions
          </h2>
          <Accordion type="single" collapsible className="w-full">
            {FAQS.map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`}>
                <AccordionTrigger className="text-left">{faq.question}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>
    </>
  );
}