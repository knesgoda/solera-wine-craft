import React from "react";
import { Link } from "react-router-dom";
import soleraLogo from "@/assets/solera-logo.png";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "Features", to: "/features" },
      { label: "Pricing", to: "/pricing" },
      { label: "Changelog", to: "/changelog" },
      { label: "Roadmap", to: "/changelog?tab=roadmap" },
    ],
  },
  {
    title: "Compare",
    links: [
      { label: "vs Innovint", to: "/compare#innovint" },
      { label: "vs Ekos", to: "/compare#ekos" },
      { label: "vs vintrace", to: "/compare#vintrace" },
      { label: "vs VinSuite", to: "/compare#vinsuite" },
      { label: "vs WineDirect", to: "/compare#winedirect" },
      { label: "vs Commerce7", to: "/compare#commerce7" },
      { label: "vs Spreadsheets", to: "/compare#spreadsheets" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", to: "/about" },
      { label: "Blog", to: "/blog" },
      { label: "FAQ", to: "/faq" },
      { label: "Contact", to: "/about#contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", to: "/privacy" },
      { label: "Terms of Service", to: "/terms" },
    ],
  },
];

export const MarketingFooter = React.forwardRef<HTMLElement>(function MarketingFooter(_, ref) {
  return (
    <footer ref={ref} className="bg-primary text-primary-foreground">
      <div className="container mx-auto px-4 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <img src={soleraLogo} alt="Solera" className="h-8 w-8 rounded" />
              <span className="font-display text-xl font-bold">Solera</span>
            </div>
            <p className="text-sm text-primary-foreground/70 leading-relaxed">
              From Vine to Bottle to Doorstep. One Platform.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="font-semibold text-sm mb-4 text-secondary">{col.title}</h4>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.to}
                      className="text-sm text-primary-foreground/70 hover:text-primary-foreground transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-primary-foreground/10">
        <div className="container mx-auto px-4 lg:px-8 py-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-primary-foreground/60">
            © 2026 Solera. All rights reserved. solera.vin
          </p>
          <div className="flex items-center gap-4">
            {/* Social icons as simple text links */}
            <a href="#" className="text-primary-foreground/60 hover:text-primary-foreground text-sm transition-colors">Twitter/X</a>
            <a href="#" className="text-primary-foreground/60 hover:text-primary-foreground text-sm transition-colors">LinkedIn</a>
            <a href="#" className="text-primary-foreground/60 hover:text-primary-foreground text-sm transition-colors">Instagram</a>
          </div>
        </div>
      </div>
    </footer>
});
