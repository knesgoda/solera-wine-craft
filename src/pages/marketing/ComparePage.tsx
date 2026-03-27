import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { SEOHead } from "@/components/SEOHead";
import { Check, X, Minus } from "lucide-react";

type Val = true | false | "Partial";

const COMPETITORS = [
  {
    id: "innovint",
    name: "Innovint",
    summary: "Innovint is cellar-only. You'll still need a separate DTC platform, vineyard tracking solution, compliance tool, and a COGS spreadsheet. Solera replaces all of them at a fraction of the cost.",
    prose: [
      {
        heading: "Full-Lifecycle at Half the Price",
        body: "Innovint focuses on harvest and cellar tracking but has no production cost management, no grower contracts, and no accounting integration. With Solera Growth, you get everything Innovint offers plus real-time COGS tracking, QuickBooks export, and AI-powered analytics — at $69/mo vs. Innovint's $149/mo.",
      },
      {
        heading: "Ripening Intelligence Innovint Doesn't Have",
        body: "Solera includes a Ripening Tracker that compares clone and rootstock combinations across blocks with interactive charts and automatic divergence alerts. Innovint has no equivalent — you'd need a separate spreadsheet. Solera also lets you export all your data anytime in CSV or Excel format on every tier. Try getting your data out of Innovint without a support ticket.",
      },
    ],
    features: {
      "Starting price": ["$69/mo", "$149/mo"],
      "Free tier": [true, false],
      "Vineyard ops": [true, false],
      "Lab tracking": [true, true],
      "Cellar management": [true, true],
      "Ripening tracker": ["Clone & rootstock comparison with divergence alerts", false],
      "Production cost tracking (COGS)": ["Per-lot, per-barrel, per-gallon. Costs flow through blends automatically. QuickBooks export.", "Not available"],
      "Blend cost propagation": [true, false],
      "Grower contracts & grading": ["Full grower registry, multi-metric grading scales, auto-pricing at intake, weigh tags", "No"],
      "QuickBooks integration": ["COGS export with configurable account mapping", "No"],
      "Multi-language support": [true, false],
      "Free data export": ["CSV/Excel on every tier, anytime", "Support ticket required"],
      "AI assistant": [true, false],
      "DTC storefront": [true, false],
      "Wine club": [true, false],
      "Custom crush portal": [true, false],
      "TTB OW-1 export": [true, "Partial"],
      "Mobile PWA": [true, false],
      "Offline mode": [true, false],
      "Data import": [true, "Partial"],
      "Transaction fees": ["None", "N/A"],
      "Onboarding fees": ["None", "$500+"],
    },
  },
  {
    id: "vintrace",
    name: "vintrace",
    summary: "vintrace tracks cellar operations but leaves you reconciling COGS in Xero and managing grower contracts in spreadsheets. Solera gives you production costs, grading scales, and intake pricing in the same platform as your cellar data.",
    prose: [
      {
        heading: "Stop Reconciling COGS in Xero",
        body: "Vintrace tracks production costs, but reconciling those costs with your accounting system means hours of manual work in Xero every month. Solera's production cost tracking computes COGS per gallon, per barrel, and per case in real time — and when you blend wines, costs flow automatically based on gallon contribution. Export to QuickBooks with one click. No spreadsheets. No manual reconciliation. No Xero subscription required.",
      },
      {
        heading: "Grower Contracts That Actually Calculate Prices",
        body: "Vintrace offers basic grower contract management, but it can't automatically grade fruit against multi-metric scales and calculate the final price per ton as grapes arrive at the crush pad. Solera's grower contracts support Brix, MOG, total acidity, pH, berry size, and any custom metric — with tier-based bonuses and penalties applied in real time during harvest intake. Grape costs flow directly into your COGS tracking. One platform, zero re-entry.",
      },
      {
        heading: "Global-Ready, Not English-Only",
        body: "Solera supports multiple languages (starting with French) and automatic timezone handling for international operations. vintrace is English-only. Solera also includes free automatic data backups on every tier — your data is always exportable without vendor lock-in.",
      },
    ],
    savingStat: "Solera Growth at $129/mo includes COGS tracking that replaces vintrace ($159+/mo) AND Xero ($25+/mo) — saving you $55+/mo and 5+ hours of manual reconciliation.",
    features: {
      "Starting price": ["$69/mo", "Contact for pricing"],
      "Free tier": [true, false],
      "Vineyard ops": [true, false],
      "Lab tracking": [true, true],
      "Cellar management": [true, true],
      "Ripening tracker": ["Clone & rootstock comparison with divergence alerts", false],
      "Production cost tracking (COGS)": ["Per-lot, per-barrel, per-gallon. Costs flow through blends automatically. QuickBooks export.", "Yes, but costs reconciled manually via Xero. No automatic blend propagation."],
      "Blend cost propagation": [true, false],
      "Grower contracts & grading": ["Full grower registry, multi-metric grading scales, auto-pricing at intake, weigh tags", "Basic grower contracts. No multi-metric grading scales with automatic price calculation."],
      "Automated intake pricing": [true, false],
      "QuickBooks integration": ["COGS export with configurable account mapping", "Xero only (not QuickBooks). Manual reconciliation required."],
      "Multi-language support": ["English, French + 5 more coming", "English only"],
      "Free data export": ["CSV/Excel on every tier with automatic backups", false],
      "AI assistant": [true, false],
      "DTC storefront": [true, false],
      "Custom crush portal": [true, false],
      "TTB OW-1 export": [true, true],
      "Mobile PWA": [true, false],
      "Offline mode": [true, false],
      "Transaction fees": ["None", "N/A"],
      "Onboarding fees": ["None", "$500+"],
    },
  },
  {
    id: "ekos",
    name: "Ekos",
    summary: "Ekos is built for breweries and adapted for wineries as an afterthought. No vineyard tracking, no COGS per lot, no grower contracts, and no AI. Solera is purpose-built for wine from day one.",
    prose: [
      {
        heading: "Wine-First Ripening Intelligence",
        body: "Solera's Ripening Tracker gives winemakers clone-level harvest intelligence that brewery-first platforms like Ekos simply don't understand. Plus, every Solera tier includes free data export and automatic backups — because your winery data belongs to you.",
      },
    ],
    features: {
      "Starting price": ["$69/mo", "$279/mo"],
      "Free tier": [true, false],
      "Vineyard ops": [true, false],
      "Lab tracking": [true, "Partial"],
      "Cellar management": [true, true],
      "Ripening tracker": ["Clone & rootstock comparison with divergence alerts", false],
      "Production cost tracking (COGS)": ["Per-lot, per-barrel, per-gallon. Costs flow through blends automatically. QuickBooks export.", "Basic (brewery-focused, not wine-specific)"],
      "Blend cost propagation": [true, false],
      "Grower contracts & grading": ["Full grower registry, multi-metric grading scales, auto-pricing at intake, weigh tags", "No"],
      "QuickBooks integration": ["COGS export with configurable account mapping", "Basic"],
      "Free data export": ["CSV/Excel on every tier with automatic backups", false],
      "AI assistant": [true, false],
      "DTC storefront": [true, false],
      "Wine club": [true, false],
      "TTB OW-1 export": [true, "Partial"],
      "Mobile PWA": [true, "Partial"],
      "Offline mode": [true, false],
    },
  },
  {
    id: "winedirect",
    name: "WineDirect",
    summary: "WineDirect is DTC-only. It handles ecommerce but doesn't touch your cellar, vineyard, COGS, or compliance. Solera gives you DTC plus everything else — at a lower price with zero transaction markup.",
    prose: [
      {
        heading: "Full Winery Operations, Not Just Sales",
        body: "Solera includes full vineyard operations, ripening tracking, and cellar management alongside DTC — WineDirect only handles the sales side. And every Solera tier includes free data export with integrity verification, so you're never locked in.",
      },
    ],
    features: {
      "Starting price": ["$69/mo", "$149/mo + fees"],
      "Free tier": [true, false],
      "Vineyard ops": [true, false],
      "Lab tracking": [true, false],
      "Cellar management": [true, false],
      "Ripening tracker": [true, false],
      "Production cost tracking (COGS)": ["Per-lot, per-barrel, per-gallon. Costs flow through blends automatically. QuickBooks export.", "No (DTC only)"],
      "Grower contracts & grading": ["Full grower registry, multi-metric grading scales, auto-pricing at intake, weigh tags", "No"],
      "QuickBooks integration": ["COGS export with configurable account mapping", "No"],
      "Free data export": ["CSV/Excel on every tier with integrity verification", false],
      "AI assistant": [true, false],
      "DTC storefront": [true, true],
      "Wine club": [true, true],
      "Transaction fees": ["None", "4.5% markup"],
      "Onboarding fees": ["None", "$1,000+"],
    },
  },
  {
    id: "commerce7",
    name: "Commerce7",
    summary: "Commerce7 focuses on POS and ecommerce. For cellar, vineyard, COGS, and compliance you need additional tools. Solera covers it all without the hefty price tag or transaction markups.",
    prose: [
      {
        heading: "More Than Just a Cash Register",
        body: "Solera includes full vineyard operations, ripening tracking, and cellar management alongside DTC — Commerce7 only handles the sales side. And every Solera tier includes free data export with integrity verification, so you're never locked in.",
      },
    ],
    features: {
      "Starting price": ["$69/mo", "$299/mo + fees"],
      "Free tier": [true, false],
      "Vineyard ops": [true, false],
      "Lab tracking": [true, false],
      "Cellar management": [true, false],
      "Ripening tracker": [true, false],
      "Production cost tracking (COGS)": ["Per-lot, per-barrel, per-gallon. Costs flow through blends automatically. QuickBooks export.", "No (DTC only)"],
      "Grower contracts & grading": ["Full grower registry, multi-metric grading scales, auto-pricing at intake, weigh tags", "No"],
      "QuickBooks integration": ["COGS export with configurable account mapping", "No"],
      "Free data export": ["CSV/Excel on every tier with integrity verification", false],
      "DTC storefront": [true, true],
      "Wine club": [true, true],
      "Custom crush portal": [true, false],
      "Transaction fees": ["None", "1.5% markup"],
      "Onboarding fees": ["None", "Varies"],
      "Price transparency": [true, false],
    },
  },
  {
    id: "vinsuite",
    name: "VinSuite",
    summary: "VinSuite offers DTC and POS but lacks modern cellar management, COGS tracking, and grower contracts. Solera covers the full lifecycle with real-time production costing and AI analytics.",
    features: {
      "Starting price": ["$69/mo", "$149+/mo"],
      "Free tier": [true, false],
      "Vineyard ops": [true, false],
      "Lab tracking": [true, false],
      "Cellar management": [true, "Partial"],
      "Production cost tracking (COGS)": ["Per-lot, per-barrel, per-gallon. Costs flow through blends automatically. QuickBooks export.", "No (DTC only)"],
      "Grower contracts & grading": ["Full grower registry, multi-metric grading scales, auto-pricing at intake, weigh tags", "No"],
      "QuickBooks integration": ["COGS export with configurable account mapping", "QuickBooks POS integration only"],
      "AI assistant": [true, false],
      "DTC storefront": [true, true],
      "Wine club": [true, true],
      "TTB OW-1 export": [true, "Partial"],
      "Mobile PWA": [true, false],
      "Offline mode": [true, false],
    },
  },
  {
    id: "spreadsheets",
    name: "Spreadsheets",
    summary: "Spreadsheets are free but cost you hours every week. Manual COGS reconciliation, no automated grower pricing, no alerts, no compliance automation, and zero AI. Solera's Hobbyist plan is also free — but actually built for winemaking.",
    features: {
      "Starting price": ["Free", "Free"],
      "Vineyard ops": [true, "Partial"],
      "Lab tracking": [true, "Partial"],
      "Cellar management": [true, false],
      "Production cost tracking (COGS)": ["Per-lot, per-barrel, per-gallon. Costs flow through blends automatically. QuickBooks export.", "Manual (no automation)"],
      "Blend cost propagation": [true, false],
      "Grower contracts & grading": ["Full grower registry, multi-metric grading scales, auto-pricing at intake, weigh tags", "No"],
      "QuickBooks integration": ["COGS export with configurable account mapping", "No"],
      "AI assistant": [true, false],
      "DTC storefront": [true, false],
      "TTB OW-1 export": [true, false],
      "Offline mode": [true, true],
      "Data import": [true, "Partial"],
      "Automated alerts": [true, false],
    },
  },
];

const renderVal = (v: Val | string) => {
  if (v === true) return <Check className="h-4 w-4 text-green-600 mx-auto" />;
  if (v === false) return <X className="h-4 w-4 text-destructive mx-auto" />;
  if (v === "Partial") return <Minus className="h-4 w-4 text-secondary mx-auto" />;
  return <span className="text-xs text-foreground">{v}</span>;
};

export default function ComparePage() {
  return (
    <>
      <SEOHead
        title="Compare Solera to Innovint, vintrace, Commerce7, WineDirect, Ekos & VinSuite"
        description="Compare Solera to Innovint, vintrace, Commerce7, WineDirect, Ekos, and VinSuite. Full-lifecycle winery management with COGS tracking, grower contracts, AI analytics, and DTC — starting at $69/mo."
        breadcrumbs={[
          { name: "Home", url: "https://solera.vin" },
          { name: "Compare", url: "https://solera.vin/compare" },
        ]}
      />

      <section className="pt-28 pb-16 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 lg:px-8 text-center">
          <h1 className="font-display text-4xl md:text-5xl font-bold mb-4">See how Solera stacks up.</h1>
          <p className="text-xl text-primary-foreground/80">Honest comparisons. Real data. Your decision.</p>
        </div>
      </section>

      {COMPETITORS.map((c, i) => (
        <section key={c.id} id={c.id} className={`py-16 ${i % 2 === 0 ? "bg-background" : "bg-muted/50"}`}>
          <div className="container mx-auto px-4 lg:px-8 max-w-4xl">
            <h2 className="font-display text-3xl font-bold text-foreground mb-4">Solera vs {c.name}</h2>
            <p className="text-muted-foreground mb-8">{c.summary}</p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 pr-4 text-muted-foreground font-medium">Feature</th>
                    <th className="py-3 px-4 text-center font-semibold text-primary">Solera</th>
                    <th className="py-3 px-4 text-center font-medium text-muted-foreground">{c.name}</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(c.features).map(([feat, [sol, comp]]) => (
                    <tr key={feat} className="border-b border-border/50">
                      <td className="py-3 pr-4 text-foreground">{feat}</td>
                      <td className="py-3 px-4 text-center">{renderVal(sol)}</td>
                      <td className="py-3 px-4 text-center">{renderVal(comp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Prose sections for detailed comparisons */}
            {"prose" in c && (c as any).prose && (
              <div className="mt-10 space-y-8">
                {((c as any).prose as { heading: string; body: string }[]).map((p) => (
                  <div key={p.heading}>
                    <h3 className="font-display text-xl font-bold text-foreground mb-2">{p.heading}</h3>
                    <p className="text-muted-foreground leading-relaxed">{p.body}</p>
                  </div>
                ))}
              </div>
            )}

            {"savingStat" in c && (c as any).savingStat && (
              <div className="mt-6 p-4 bg-secondary/10 border border-secondary/20 rounded-lg">
                <p className="text-sm font-semibold text-foreground">{(c as any).savingStat}</p>
              </div>
            )}

            <div className="mt-8">
              <Button asChild>
                <Link to="/coming-soon">Switch from {c.name} — we'll migrate your data free</Link>
              </Button>
            </div>
          </div>
        </section>
      ))}

      {/* Master comparison */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4 lg:px-8">
          <h2 className="font-display text-3xl font-bold text-foreground text-center mb-8">Full Comparison</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 pr-4 text-muted-foreground">Feature</th>
                  <th className="py-3 px-3 text-center font-semibold text-primary bg-primary/5">Solera</th>
                  <th className="py-3 px-3 text-center text-muted-foreground">Innovint</th>
                  <th className="py-3 px-3 text-center text-muted-foreground">vintrace</th>
                  <th className="py-3 px-3 text-center text-muted-foreground">Ekos</th>
                  <th className="py-3 px-3 text-center text-muted-foreground">WineDirect</th>
                  <th className="py-3 px-3 text-center text-muted-foreground">Commerce7</th>
                  <th className="py-3 px-3 text-center text-muted-foreground">VinSuite</th>
                </tr>
              </thead>
              <tbody>
                {([
                  ["Starting price", "$69/mo", "$149/mo", "Contact for pricing", "$279/mo", "$149/mo + fees", "$299/mo + fees", "$149+/mo"],
                  ["Free tier", true, false, false, false, false, false, false],
                  ["Vineyard ops", true, false, false, false, false, false, false],
                  ["Lab tracking", true, true, true, "Partial", false, false, false],
                  ["Cellar management", true, true, true, true, false, false, "Partial"],
                  ["Production cost tracking (COGS)", true, false, "Partial", false, false, false, false],
                  ["Blend cost propagation", true, false, false, false, false, false, false],
                  ["Grower contracts & grading", true, false, "Partial", false, false, false, false],
                  ["QuickBooks integration", true, false, false, "Partial", false, false, "Partial"],
                  ["AI assistant", true, false, false, false, false, false, false],
                  ["DTC storefront", true, false, false, false, true, true, true],
                  ["Wine club", true, false, false, false, true, true, true],
                  ["Custom crush portal", true, false, false, false, false, false, false],
                  ["TTB OW-1 export", true, "Partial", true, "Partial", false, false, "Partial"],
                  ["Mobile PWA", true, false, false, "Partial", false, false, false],
                  ["Offline mode", true, false, false, false, false, false, false],
                  ["Transaction fees", "None", "N/A", "N/A", "N/A", "2-3%", "1.5%", "Varies"],
                  ["Onboarding fees", "None", "$500+", "$500+", "$250+", "$1,000+", "Varies", "Varies"],
                ] as (string | boolean | "Partial")[][]).map(([feat, ...vals]) => (
                  <tr key={feat as string} className="border-b border-border/50">
                    <td className="py-3 pr-4 text-foreground">{feat as string}</td>
                    {vals.map((v, j) => (
                      <td key={j} className={`py-3 px-3 text-center ${j === 0 ? "bg-primary/5" : ""}`}>
                        {renderVal(v as Val | string)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}
