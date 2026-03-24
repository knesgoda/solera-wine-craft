import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SEOHead, HOMEPAGE_SCHEMA } from "@/components/SEOHead";
import {
  Grape, FlaskConical, Wine, Bot, Upload, ShoppingCart, Users, FileCheck,
  Check, X, ChevronRight, BarChart3, Thermometer, Calendar, Bell, DollarSign, Wheat
} from "lucide-react";
import { useEffect, useState } from "react";

const MODULES = [
  { icon: Grape, name: "Vineyard Operations", desc: "GDD tracking, block management, task scheduling, and weather-driven harvest predictions." },
  { icon: FlaskConical, name: "Vintage & Lab Tracking", desc: "Record lab samples, track additions, detect anomalies with AI, and monitor every vintage's lifecycle." },
  { icon: Wine, name: "Cellar & Fermentation", desc: "Manage vessels, barrels, fermentation logs, and run blending trials with confidence." },
  { icon: DollarSign, name: "Production Cost Tracking", desc: "Real-time COGS per lot, barrel, and gallon. Costs follow wine through blends automatically. Never reconcile a spreadsheet in Xero again." },
  { icon: Wheat, name: "Grower Contracts", desc: "Grape purchase agreements, multi-metric grading scales, and automated intake pricing — connected to your cellar data and COGS." },
  { icon: Bot, name: "Ask Solera AI", desc: "Ask anything about your operation in plain English and get answers grounded in your actual data." },
  { icon: Upload, name: "Data Import & Migration", desc: "AI-assisted import from Innovint, VinNow, or any CSV/XLSX. Your history migrates in minutes." },
  { icon: ShoppingCart, name: "Sales & DTC Storefront", desc: "Public wine store, inventory management, order fulfillment, and wine club shipments." },
  { icon: Users, name: "Custom Crush Portal", desc: "Give your custom crush clients their own portal with vintage visibility, messaging, and documents." },
  { icon: FileCheck, name: "TTB Compliance", desc: "Generate OW-1 reports, Certificates of Analysis, and stay compliant with ShipCompliant integration." },
];

const STATS = [
  "54% cheaper than Innovint",
  "Replaces $700/mo of fragmented tools",
  "Full TTB compliance from day one",
  "AI harvest predictions built in",
  "Your historical data migrates in minutes",
];

export default function Homepage() {
  const [statIdx, setStatIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setStatIdx((i) => (i + 1) % STATS.length), 3000);
    return () => clearInterval(t);
  }, []);

  return (
    <>
      <SEOHead jsonLd={HOMEPAGE_SCHEMA} />

      {/* HERO */}
      <section className="relative min-h-[90vh] flex items-center bg-background overflow-hidden">
        {/* Subtle vineyard texture pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%236B1B2A' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
        <div className="container mx-auto px-4 lg:px-8 pt-24 pb-16 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-secondary font-semibold text-sm tracking-wider uppercase mb-4">
                The Winery OS Built for the AI Era
              </p>
              <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight mb-6">
                From Vine to Bottle to Doorstep — One Platform.
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed mb-8 max-w-xl">
                Solera gives every winemaker — from weekend hobbyist to 50,000-case custom crush facility — the operational intelligence of a world-class winery. Free to start. No onboarding fees. No transaction markups.
              </p>
              <div className="flex flex-wrap gap-4 mb-8">
                <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 text-base px-8" asChild>
                  <Link to="/coming-soon">Start Free</Link>
                </Button>
                <Button size="lg" variant="outline" className="text-base px-8" asChild>
                  <a href="#modules">See How It Works</a>
                </Button>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                {["Free for hobbyists", "Replaces Innovint + Commerce7", "AI-powered", "No transaction fees"].map((t) => (
                  <span key={t} className="flex items-center gap-1.5">
                    <Check className="h-4 w-4 text-green-600" /> {t}
                  </span>
                ))}
              </div>
            </div>

            {/* Dashboard mockup */}
            <div className="hidden lg:block">
              <div className="bg-card rounded-xl shadow-2xl border p-4">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b">
                  <div className="w-3 h-3 rounded-full bg-destructive/60" />
                  <div className="w-3 h-3 rounded-full bg-secondary/60" />
                  <div className="w-3 h-3 rounded-full bg-green-500/60" />
                  <span className="ml-2 text-xs text-muted-foreground">Solera Dashboard</span>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[
                    { label: "Active Vintages", val: "12", icon: Wine },
                    { label: "GDD Today", val: "2,847", icon: Thermometer },
                    { label: "Tasks Due", val: "5", icon: Calendar },
                  ].map((s) => (
                    <div key={s.label} className="bg-muted rounded-lg p-3">
                      <s.icon className="h-4 w-4 text-secondary mb-1" />
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                      <p className="text-lg font-bold text-foreground">{s.val}</p>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted rounded-lg p-3">
                    <BarChart3 className="h-4 w-4 text-primary mb-2" />
                    <div className="space-y-1">
                      {[80, 60, 45, 70].map((w, i) => (
                        <div key={i} className="h-2 rounded-full bg-primary/20">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${w}%` }} />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-muted rounded-lg p-3">
                    <Bell className="h-4 w-4 text-secondary mb-2" />
                    <div className="space-y-2">
                      {["Harvest window open", "Lab sample due", "VA anomaly detected"].map((a) => (
                        <p key={a} className="text-[10px] text-muted-foreground truncate">{a}</p>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF BAR */}
      <section className="bg-primary py-6">
        <div className="container mx-auto px-4 text-center">
          <p className="text-primary-foreground/80 text-sm mb-3">Built for winemakers, by a winemaker.</p>
          <p className="text-primary-foreground font-semibold text-lg transition-all duration-500">
            {STATS[statIdx]}
          </p>
        </div>
      </section>

      {/* PROBLEM / SOLUTION */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12">
            <div>
              <h2 className="font-display text-3xl font-bold text-foreground mb-6">The old way</h2>
              <ul className="space-y-4">
                {[
                  "Innovint for cellar ($149/mo)",
                  "Commerce7 for DTC ($299/mo + 1% fees)",
                  "Spreadsheets for vineyard tracking",
                  "Paper lab logs and manual compliance",
                  "$700/mo and still missing features",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-muted-foreground">
                    <X className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="font-display text-3xl font-bold text-foreground mb-6">The Solera way</h2>
              <ul className="space-y-4">
                {[
                  "One platform — vineyard to DTC",
                  "AI assistant built into every workflow",
                  "Full TTB compliance from day one",
                  "Mobile-first, works offline in the field",
                  "From $69/mo — or free for hobbyists",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-foreground">
                    <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* MODULE SHOWCASE */}
      <section id="modules" className="py-20 bg-muted/50">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
              Everything your winery needs. Nothing it doesn't.
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {MODULES.map((m) => (
              <Card
                key={m.name}
                className="bg-card hover:shadow-lg hover:border-secondary transition-all duration-300 group cursor-default"
              >
                <CardContent className="p-6">
                  <m.icon className="h-8 w-8 text-primary mb-4 group-hover:text-secondary transition-colors" />
                  <h3 className="font-display text-lg font-semibold text-foreground mb-2">{m.name}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{m.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* AI FEATURE HIGHLIGHT */}
      <section className="py-20 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="font-display text-3xl md:text-4xl font-bold mb-6">
                Meet Ask Solera. Your AI winemaking co-pilot.
              </h2>
              <p className="text-primary-foreground/80 text-lg leading-relaxed mb-8">
                Ask anything about your operation in plain English. When should we harvest Block A? Is our VA trending toward a problem? How does this vintage compare to 2019? Solera answers with your actual data — not generic advice.
              </p>
              <Button size="lg" className="bg-secondary text-secondary-foreground hover:bg-secondary/90" asChild>
                <Link to="/coming-soon">Try Ask Solera Free</Link>
              </Button>
            </div>
            <div className="bg-primary-foreground/10 rounded-xl p-6 backdrop-blur-sm border border-primary-foreground/20">
              <div className="space-y-4">
                <div className="flex justify-end">
                  <div className="bg-secondary/20 rounded-lg rounded-br-sm px-4 py-2 max-w-[80%]">
                    <p className="text-sm">When should we harvest Block A based on current GDD?</p>
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className="bg-primary-foreground/10 rounded-lg rounded-bl-sm px-4 py-3 max-w-[85%]">
                    <p className="text-sm leading-relaxed">
                      Based on Block A's current GDD of 2,847 and the 10-day forecast, your optimal harvest window is <strong>September 12–16</strong>. Brix is trending at 24.2° and your 2023 analog vintage harvested at 2,900 GDD with excellent results.
                    </p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <div className="bg-secondary/20 rounded-lg rounded-br-sm px-4 py-2 max-w-[80%]">
                    <p className="text-sm">Is VA trending toward a problem on the 2025 Syrah?</p>
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className="bg-primary-foreground/10 rounded-lg rounded-bl-sm px-4 py-3 max-w-[85%]">
                    <p className="text-sm leading-relaxed">
                      VA on the 2025 Syrah is at 0.52 g/L — within normal range but up 18% from last month. I'd recommend a lab check within the next 5 days. Your threshold alert is set at 0.6 g/L.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MIGRATION PROMISE */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4 lg:px-8 text-center">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
            Your history comes with you.
          </h2>
          <p className="text-lg text-muted-foreground mb-12 max-w-2xl mx-auto">
            Every Solera plan includes AI-assisted import of your Innovint exports, VinNow data, or any spreadsheet. We've never met a winery that wanted to start from scratch.
          </p>
          <div className="grid md:grid-cols-3 gap-8 mb-12">
            {[
              { step: "1", title: "Export your data", desc: "Export from Innovint or upload any CSV/XLSX file." },
              { step: "2", title: "AI maps your columns", desc: "Solera's AI automatically maps your columns to the right fields." },
              { step: "3", title: "History goes live", desc: "Your full history is live and queryable in minutes." },
            ].map((s) => (
              <Card key={s.step} className="bg-card">
                <CardContent className="p-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center text-xl font-bold mx-auto mb-4">
                    {s.step}
                  </div>
                  <h3 className="font-display text-lg font-semibold text-foreground mb-2">{s.title}</h3>
                  <p className="text-sm text-muted-foreground">{s.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <Button variant="outline" asChild>
            <Link to="/features#migration">See How Migration Works <ChevronRight className="ml-1 h-4 w-4" /></Link>
          </Button>
        </div>
      </section>

      {/* PRICING PREVIEW */}
      <section className="py-20 bg-muted/50">
        <div className="container mx-auto px-4 lg:px-8 text-center">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
            Honest pricing. No surprises.
          </h2>
          <p className="text-muted-foreground mb-12">
            No onboarding fees. No transaction markups. Annual plans lock your rate for 2 years.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[
              { name: "Hobbyist", price: "Free", sub: "forever" },
              { name: "Pro", price: "$69", sub: "/month" },
              { name: "Growth", price: "$129", sub: "/month" },
              { name: "Enterprise", price: "$399", sub: "/month" },
            ].map((t) => (
              <Card key={t.name} className={`bg-card ${t.name === "Growth" ? "border-secondary border-2 scale-105" : ""}`}>
                <CardContent className="p-6 text-center">
                  <h3 className="font-display text-lg font-semibold text-foreground mb-2">{t.name}</h3>
                  <p className="text-3xl font-bold text-foreground">{t.price}</p>
                  <p className="text-sm text-muted-foreground">{t.sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <Button asChild>
            <Link to="/pricing">See Full Pricing <ChevronRight className="ml-1 h-4 w-4" /></Link>
          </Button>
        </div>
      </section>

      {/* FOUNDER STORY TEASER */}
      <section className="py-20 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 lg:px-8 text-center max-w-3xl">
          <div className="w-20 h-20 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center text-2xl font-display font-bold mx-auto mb-8">
            KN
          </div>
          <blockquote className="text-lg md:text-xl leading-relaxed text-primary-foreground/90 italic mb-8">
            "I fell in love with a Pinot Noir under an old oak in Santa Ynez in 2005. Twenty years later I watched winemakers drowning in spreadsheets and overpriced software. Solera is the platform I wish they'd always had."
          </blockquote>
          <p className="text-secondary font-semibold mb-8">— Kevin Nesgoda, Founder</p>
          <Button variant="outline" className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10" asChild>
            <Link to="/about">Read Kevin's Story <ChevronRight className="ml-1 h-4 w-4" /></Link>
          </Button>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4 lg:px-8 text-center max-w-2xl">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
            Your winery deserves better software.
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Start free. No credit card. No onboarding fees. Your first vintage set up in under 10 minutes.
          </p>
          <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 text-lg px-10 py-6" asChild>
            <Link to="/coming-soon">Start Free</Link>
          </Button>
          <p className="text-sm text-muted-foreground mt-6">
            Already on Innovint? We'll help you migrate for free.
          </p>
        </div>
      </section>
    </>
  );
}
