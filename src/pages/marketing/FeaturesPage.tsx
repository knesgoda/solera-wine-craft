import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { SEOHead } from "@/components/SEOHead";
import {
  Grape, FlaskConical, Wine, Bot, Upload, ShoppingCart, Users, FileCheck,
  MapPin, Thermometer, Calendar, BarChart3, TestTube, AlertTriangle, Bell,
  Database, FileSpreadsheet, Layers, CreditCard, Package, Truck, UserPlus,
  FileText, Shield, Check, DollarSign, Wheat, Scale, TrendingUp
} from "lucide-react";

const FEATURES = [
  {
    id: "vineyard",
    name: "Vineyard Operations",
    icon: Grape,
    desc: "Manage every vine from planting to harvest with precision.",
    bullets: [
      "Track vineyards, blocks, varieties, clones, and rootstock",
      "Growing Degree Day accumulation with weather integration",
      "AI-powered harvest window predictions per block",
      "Task management with calendar view and field crew assignments",
      "Offline-capable data entry for field workers",
      "Soil profile tracking — pH, texture, organic matter",
    ],
    mockup: (
      <div className="bg-card rounded-lg border p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <MapPin className="h-4 w-4 text-primary" /> Estate Vineyard — Block A
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[{ l: "Variety", v: "Pinot Noir" }, { l: "GDD", v: "2,847" }, { l: "Acres", v: "3.2" }].map(s => (
            <div key={s.l} className="bg-muted rounded p-2">
              <p className="text-[10px] text-muted-foreground">{s.l}</p>
              <p className="text-sm font-bold text-foreground">{s.v}</p>
            </div>
          ))}
        </div>
        <div className="h-2 rounded-full bg-muted"><div className="h-full w-3/4 rounded-full bg-secondary" /></div>
        <p className="text-[10px] text-muted-foreground">Harvest readiness: 75%</p>
      </div>
    ),
  },
  {
    id: "vintage",
    name: "Vintage & Lab Tracking",
    icon: FlaskConical,
    desc: "Every data point, every vintage, every decision — tracked.",
    bullets: [
      "Full vintage lifecycle from crush to bottle",
      "Lab sample recording with trend charts",
      "AI anomaly detection flags out-of-range readings",
      "TTB additions tracking with regulatory compliance",
      "Certificate of Analysis PDF generation",
      "Compare vintages side by side with analog explorer",
    ],
    mockup: (
      <div className="bg-card rounded-lg border p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <TestTube className="h-4 w-4 text-primary" /> 2025 Syrah — Lab Results
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[{ l: "pH", v: "3.62" }, { l: "TA", v: "5.8 g/L" }, { l: "VA", v: "0.42 g/L" }, { l: "Alcohol", v: "14.2%" }].map(s => (
            <div key={s.l} className="bg-muted rounded p-2 flex justify-between">
              <span className="text-[10px] text-muted-foreground">{s.l}</span>
              <span className="text-xs font-semibold text-foreground">{s.v}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-secondary">
          <AlertTriangle className="h-3 w-3" /> All readings within normal range
        </div>
      </div>
    ),
  },
  {
    id: "cellar",
    name: "Cellar & Fermentation",
    icon: Wine,
    desc: "Every vessel, every barrel, every fermentation curve.",
    bullets: [
      "Fermentation vessel management with Brix/temp logging",
      "Barrel inventory with cooperage, toast, and fill tracking",
      "Barrel group operations for batch processing",
      "Blending trial workbench with star ratings",
      "Multi-facility support with transfer tracking",
      "Real-time fermentation curves and alerts",
    ],
    mockup: (
      <div className="bg-card rounded-lg border p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Thermometer className="h-4 w-4 text-primary" /> Fermentation — Tank 3
        </div>
        <div className="space-y-2">
          {[{ d: "Sep 1", b: "24.5°", t: "72°F" }, { d: "Sep 3", b: "18.2°", t: "75°F" }, { d: "Sep 5", b: "8.1°", t: "70°F" }].map(r => (
            <div key={r.d} className="flex justify-between text-xs bg-muted rounded px-2 py-1.5">
              <span className="text-muted-foreground">{r.d}</span>
              <span className="text-foreground font-medium">Brix {r.b}</span>
              <span className="text-muted-foreground">{r.t}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "cogs",
    name: "Production Cost Tracking",
    icon: DollarSign,
    desc: "Stop reconciling COGS in Xero. Every dollar from grape to bottle, tracked automatically.",
    tier: "Growth+",
    bullets: [
      "Real-time COGS per lot, per barrel, and per gallon",
      "Three costing methods: apportioned, transactional, and ad hoc",
      "Costs follow gallons through blending — automatically",
      "Material price list with auto-calculated transactional costs",
      "QuickBooks export with one-click CSV/IIF generation",
      "What-if calculator to project COGS before bottling decisions",
    ],
    mockup: (
      <div className="bg-card rounded-lg border p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <DollarSign className="h-4 w-4 text-primary" /> 2025 Estate Cab — COGS
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[{ l: "Total COGS", v: "$14,230" }, { l: "$/Gallon", v: "$47.43" }, { l: "$/Case", v: "$71.80" }].map(s => (
            <div key={s.l} className="bg-muted rounded p-2">
              <p className="text-[10px] text-muted-foreground">{s.l}</p>
              <p className="text-sm font-bold text-foreground">{s.v}</p>
            </div>
          ))}
        </div>
        <div className="space-y-1.5">
          {[{ cat: "Grape", pct: 62, color: "bg-primary" }, { cat: "Cooperage", pct: 18, color: "bg-secondary" }, { cat: "Labor", pct: 12, color: "bg-accent" }].map(c => (
            <div key={c.cat} className="flex items-center gap-2 text-[10px]">
              <span className="text-muted-foreground w-16">{c.cat} {c.pct}%</span>
              <div className="flex-1 h-1.5 rounded-full bg-muted">
                <div className={`h-full rounded-full ${c.color}`} style={{ width: `${c.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground">Includes $3,200 blend transfer from 2025 Merlot</p>
      </div>
    ),
  },
  {
    id: "growers",
    name: "Grower Contract Management",
    icon: Wheat,
    desc: "Your grape purchase agreements, grading scales, and intake pricing — in the same platform as your cellar data.",
    tier: "Enterprise",
    bullets: [
      "Multi-metric grading scales: Brix, MOG, pH, and custom tiers",
      "Automated harvest intake with weigh tag pricing engine",
      "Bonuses and penalties applied instantly at the scale",
      "Grape costs auto-flow into COGS when deliveries are approved",
      "Contract dashboards with delivery tracking and tonnage summaries",
      "PDF/CSV financial reports for grower payment reconciliation",
    ],
    mockup: (
      <div className="bg-card rounded-lg border p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Scale className="h-4 w-4 text-primary" /> Harvest Intake — WT-2025-0042
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[{ l: "Grower", v: "Rancho Vista" }, { l: "Variety", v: "Cab Sauv" }, { l: "Net Tons", v: "4.82" }, { l: "Brix", v: "25.1°" }].map(s => (
            <div key={s.l} className="bg-muted rounded p-2 flex justify-between">
              <span className="text-[10px] text-muted-foreground">{s.l}</span>
              <span className="text-xs font-semibold text-foreground">{s.v}</span>
            </div>
          ))}
        </div>
        <div className="bg-muted rounded p-2">
          <div className="flex justify-between text-[10px]">
            <span className="text-muted-foreground">Base: $3,200/ton</span>
            <span className="text-green-600 font-semibold">+$150 Brix Bonus</span>
          </div>
          <p className="text-sm font-bold text-foreground mt-1">Total: $16,148.50</p>
        </div>
      </div>
    ),
  },
  {
    id: "ai",
    name: "Ask Solera AI",
    icon: Bot,
    desc: "Your AI winemaking co-pilot.",
    bullets: [
      "Ask questions about your winery in plain English",
      "Answers grounded in your actual lab, weather, and vintage data",
      "Harvest timing recommendations based on GDD and forecast",
      "Anomaly trend analysis and early warnings",
      "Vintage comparison and analog matching",
      "Conversation history for ongoing analysis",
    ],
    mockup: (
      <div className="bg-card rounded-lg border p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Bot className="h-4 w-4 text-primary" /> Ask Solera
        </div>
        <div className="bg-muted rounded p-2 text-xs text-foreground">How does the 2025 Cab compare to 2023?</div>
        <div className="bg-primary/5 rounded p-2 text-xs text-foreground leading-relaxed">
          Your 2025 Cab Sauv is tracking 8% higher GDD than 2023 at this point. pH is similar (3.58 vs 3.55), but TA is running lower. The 2023 vintage scored 94pts — you're on a promising trajectory.
        </div>
      </div>
    ),
  },
  {
    id: "migration",
    name: "Data Migration Hub",
    icon: Upload,
    desc: "Your history migrates in minutes, not months.",
    bullets: [
      "Upload CSV or XLSX from any winery software",
      "AI automatically maps columns to Solera fields",
      "Supports Innovint, VinNow, and generic exports",
      "Preview data before import with validation",
      "Error reporting with row-level detail",
      "Free migration assistance on every plan",
    ],
    mockup: (
      <div className="bg-card rounded-lg border p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <FileSpreadsheet className="h-4 w-4 text-primary" /> Import Progress
        </div>
        <div className="h-3 rounded-full bg-muted"><div className="h-full w-[85%] rounded-full bg-green-500" /></div>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[{ l: "Imported", v: "847" }, { l: "Skipped", v: "3" }, { l: "Errors", v: "0" }].map(s => (
            <div key={s.l} className="text-[10px]">
              <p className="font-bold text-foreground">{s.v}</p>
              <p className="text-muted-foreground">{s.l}</p>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "dtc",
    name: "Sales & DTC Storefront",
    icon: ShoppingCart,
    desc: "Sell direct. No middleman. No markup.",
    bullets: [
      "Public wine store with secure checkout",
      "Inventory management with facility-level tracking",
      "Order management with fulfillment workflow",
      "Customer database with lifetime value metrics",
      "Wine club management with automated shipments",
      "Zero transaction fee markup",
    ],
    mockup: (
      <div className="bg-card rounded-lg border p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Package className="h-4 w-4 text-primary" /> Recent Orders
        </div>
        {[{ id: "#1042", c: "Sarah M.", s: "Shipped", amt: "$156" }, { id: "#1041", c: "James R.", s: "Processing", amt: "$89" }].map(o => (
          <div key={o.id} className="flex justify-between items-center text-xs bg-muted rounded px-2 py-1.5">
            <span className="font-medium text-foreground">{o.id}</span>
            <span className="text-muted-foreground">{o.c}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${o.s === "Shipped" ? "bg-green-100 text-green-700" : "bg-secondary/20 text-secondary"}`}>{o.s}</span>
            <span className="font-semibold text-foreground">{o.amt}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "crush",
    name: "Custom Crush Client Portal",
    icon: Users,
    desc: "Give your clients their own window into their wine.",
    bullets: [
      "Dedicated portal for each custom crush client",
      "Vintage visibility with lab results and status",
      "Secure messaging per vintage",
      "Document sharing — COAs, invoices, contracts",
      "Invite-based onboarding with branded experience",
      "Enterprise pricing starts at $399/mo for 10 clients",
    ],
    mockup: (
      <div className="bg-card rounded-lg border p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <UserPlus className="h-4 w-4 text-primary" /> Client Portal
        </div>
        <div className="bg-muted rounded p-2 text-xs">
          <p className="font-medium text-foreground mb-1">Acme Wines</p>
          <p className="text-muted-foreground">3 active vintages • 2 unread messages</p>
        </div>
        <div className="flex gap-2">
          {["Vintages", "Messages", "Documents"].map(t => (
            <span key={t} className="text-[10px] bg-primary/10 text-primary px-2 py-1 rounded">{t}</span>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "compliance",
    name: "TTB Compliance",
    icon: FileCheck,
    desc: "Stay compliant without the headache.",
    bullets: [
      "Automated OW-1 monthly report generation",
      "Certificate of Analysis PDF export",
      "TTB additions tracking with regulatory categories",
      "ShipCompliant integration for DTC shipping compliance",
      "State-by-state shipping permission management",
      "Audit-ready records with full traceability",
    ],
    mockup: (
      <div className="bg-card rounded-lg border p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Shield className="h-4 w-4 text-primary" /> Compliance Status
        </div>
        <div className="space-y-2">
          {["OW-1 Report — Current", "ShipCompliant — Connected", "TTB Additions — Up to date"].map(s => (
            <div key={s} className="flex items-center gap-2 text-xs">
              <Check className="h-3 w-3 text-green-600" />
              <span className="text-foreground">{s}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
];

export default function FeaturesPage() {
  return (
    <>
      <SEOHead
        title="Features — Solera Winery Management Platform"
        description="Ten fully integrated modules: vineyard ops, lab tracking, cellar management, production cost tracking, grower contracts, AI assistant, DTC sales, custom crush portal, TTB compliance, and data migration."
        breadcrumbs={[
          { name: "Home", url: "https://solera.vin" },
          { name: "Features", url: "https://solera.vin/features" },
        ]}
      />

      {/* Hero */}
      <section className="pt-28 pb-16 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 lg:px-8 text-center">
          <h1 className="font-display text-4xl md:text-5xl font-bold mb-4">Everything your winery needs.</h1>
          <p className="text-xl text-primary-foreground/80">Ten fully integrated modules. One monthly price.</p>
        </div>
      </section>

      {/* Feature sections */}
      {FEATURES.map((f, i) => (
        <section key={f.id} id={f.id} className={`py-20 ${i % 2 === 0 ? "bg-background" : "bg-muted/50"}`}>
          <div className="container mx-auto px-4 lg:px-8">
            <div className={`grid lg:grid-cols-2 gap-12 items-center ${i % 2 === 1 ? "lg:flex-row-reverse" : ""}`}>
              <div className={i % 2 === 1 ? "lg:order-2" : ""}>
                <div className="flex items-center gap-3 mb-4">
                  <f.icon className="h-8 w-8 text-primary" />
                  <h2 className="font-display text-3xl font-bold text-foreground">{f.name}</h2>
                  {"tier" in f && f.tier && (
                    <span className="text-xs font-semibold bg-secondary/20 text-secondary px-2 py-0.5 rounded-full">{f.tier}</span>
                  )}
                </div>
                <p className="text-lg text-muted-foreground mb-6">{f.desc}</p>
                <ul className="space-y-3">
                  {f.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-3 text-foreground">
                      <Check className="h-4 w-4 text-secondary shrink-0 mt-1" />
                      <span className="text-sm">{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className={i % 2 === 1 ? "lg:order-1" : ""}>
                {f.mockup}
              </div>
            </div>
          </div>
        </section>
      ))}

      {/* CTA */}
      <section className="py-20 bg-primary text-primary-foreground text-center">
        <div className="container mx-auto px-4">
          <h2 className="font-display text-3xl font-bold mb-4">Ready to simplify your winery?</h2>
          <p className="text-primary-foreground/80 mb-8">Start free. No credit card required.</p>
          <Button size="lg" className="bg-secondary text-secondary-foreground hover:bg-secondary/90" asChild>
            <Link to="/coming-soon">Start Free</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
