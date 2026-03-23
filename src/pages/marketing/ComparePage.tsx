import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { SEOHead } from "@/components/SEOHead";
import { Check, X, Minus } from "lucide-react";

type Val = true | false | "Partial";

const COMPETITORS = [
  {
    id: "innovint",
    name: "Innovint",
    summary: "Innovint is cellar-only. You'll still need a separate DTC platform, vineyard tracking solution, and compliance tool. Solera replaces all of them at a fraction of the cost.",
    features: {
      "Starting price": ["$69/mo", "$149/mo"],
      "Free tier": [true, false],
      "Vineyard ops": [true, false],
      "Lab tracking": [true, true],
      "Cellar management": [true, true],
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
    id: "ekos",
    name: "Ekos",
    summary: "Ekos is built for breweries and adapted for wineries as an afterthought. Solera is purpose-built for wine from day one — including TTB compliance, vineyard tracking, and AI.",
    features: {
      "Starting price": ["$69/mo", "$279/mo"],
      "Free tier": [true, false],
      "Vineyard ops": [true, false],
      "Lab tracking": [true, "Partial"],
      "Cellar management": [true, true],
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
    summary: "WineDirect is DTC-only. It handles ecommerce but doesn't touch your cellar, vineyard, or compliance. Solera gives you DTC plus everything else — at a lower price.",
    features: {
      "Starting price": ["$69/mo", "$149/mo + fees"],
      "Free tier": [true, false],
      "Vineyard ops": [true, false],
      "Lab tracking": [true, false],
      "Cellar management": [true, false],
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
    summary: "Commerce7 focuses on POS and ecommerce. For cellar, vineyard, and compliance you need additional tools. Solera covers it all without the hefty price tag or transaction markups.",
    features: {
      "Starting price": ["$69/mo", "$399/mo"],
      "Free tier": [true, false],
      "Vineyard ops": [true, false],
      "Lab tracking": [true, false],
      "Cellar management": [true, false],
      "DTC storefront": [true, true],
      "Wine club": [true, true],
      "Custom crush portal": [true, false],
      "Transaction fees": ["None", "1.5% markup"],
      "Onboarding fees": ["None", "Varies"],
      "Price transparency": [true, false],
    },
  },
  {
    id: "spreadsheets",
    name: "Spreadsheets",
    summary: "Spreadsheets are free but cost you hours every week. Manual data entry, no alerts, no compliance automation, and zero AI. Solera's Hobbyist plan is also free — but actually built for winemaking.",
    features: {
      "Starting price": ["Free", "Free"],
      "Vineyard ops": [true, "Partial"],
      "Lab tracking": [true, "Partial"],
      "Cellar management": [true, false],
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
        title="Compare Solera vs Innovint, Ekos, WineDirect, Commerce7"
        description="See how Solera stacks up against Innovint, Ekos, WineDirect, Commerce7, and spreadsheets. Lower cost, more features, honestly priced."
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

            <div className="mt-8">
              <Button asChild>
                <Link to="/signup">Switch from {c.name} — we'll migrate your data free</Link>
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
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 pr-4 text-muted-foreground">Feature</th>
                  <th className="py-3 px-3 text-center font-semibold text-primary bg-primary/5">Solera</th>
                  <th className="py-3 px-3 text-center text-muted-foreground">Innovint</th>
                  <th className="py-3 px-3 text-center text-muted-foreground">Ekos</th>
                  <th className="py-3 px-3 text-center text-muted-foreground">WineDirect</th>
                  <th className="py-3 px-3 text-center text-muted-foreground">Commerce7</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Starting price", "$69/mo", "$149/mo", "$199/mo", "$399/mo", "$399/mo"],
                  ["Free tier", true, false, false, false, false],
                  ["Vineyard ops", true, false, false, false, false],
                  ["Lab tracking", true, true, "Partial", false, false],
                  ["Cellar management", true, true, true, false, false],
                  ["AI assistant", true, false, false, false, false],
                  ["DTC storefront", true, false, false, true, true],
                  ["Wine club", true, false, false, true, true],
                  ["Custom crush portal", true, false, false, false, false],
                  ["TTB OW-1 export", true, "Partial", "Partial", false, false],
                  ["Mobile PWA", true, false, "Partial", false, false],
                  ["Offline mode", true, false, false, false, false],
                  ["Transaction fees", "None", "N/A", "N/A", "2-3%", "1.5%"],
                  ["Onboarding fees", "None", "$500+", "$250+", "$1,000+", "Varies"],
                ].map(([feat, ...vals]) => (
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
