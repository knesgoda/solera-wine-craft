import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import soleraLogo from "@/assets/solera-logo.png";

const NAV_LINKS = [
  { label: "Features", to: "/features" },
  { label: "Pricing", to: "/pricing" },
  { label: "Compare", to: "/compare" },
  { label: "Blog", to: "/blog" },
  { label: "About", to: "/about" },
];

export function MarketingNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const isHome = location.pathname === "/";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const solid = !isHome || scrolled || menuOpen;
  const textClass = solid ? "text-primary-foreground" : "text-foreground";
  const textMuted = solid ? "text-primary-foreground/80" : "text-foreground/70";

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-300 ${
        solid ? "bg-primary shadow-lg" : "bg-transparent"
      }`}
    >
      <div className="container mx-auto flex items-center justify-between h-16 px-4 lg:px-8">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2" onClick={() => setMenuOpen(false)}>
          <img src={soleraLogo} alt="Solera" className="h-8 w-8 rounded" />
          <span className={`font-display text-xl font-bold ${textClass}`}>Solera</span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-6">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={`text-sm font-medium transition-colors ${solid ? "text-primary-foreground/80 hover:text-primary-foreground" : "text-foreground/70 hover:text-foreground"}`}
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-3">
          <Button variant="ghost" className={`${textClass} ${solid ? "hover:bg-primary-foreground/10" : "hover:bg-foreground/10"}`} asChild>
            <Link to="/login">Log In</Link>
          </Button>
          <Button className={solid ? "bg-secondary text-secondary-foreground hover:bg-secondary/90" : "bg-primary text-primary-foreground hover:bg-primary/90"} asChild>
            <Link to="/coming-soon">Start Free</Link>
          </Button>
        </div>

        {/* Mobile hamburger */}
        <button
          className={`md:hidden ${textClass} p-2`}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile overlay */}
      {menuOpen && (
        <div className="md:hidden bg-primary absolute inset-x-0 top-16 bottom-0 h-[calc(100vh-4rem)] flex flex-col items-center justify-center gap-8 animate-in fade-in duration-200">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="text-2xl font-display font-semibold text-primary-foreground"
              onClick={() => setMenuOpen(false)}
            >
              {l.label}
            </Link>
          ))}
          <div className="flex flex-col gap-3 mt-4">
            <Button variant="ghost" className="text-primary-foreground hover:bg-primary-foreground/10" asChild>
              <Link to="/login" onClick={() => setMenuOpen(false)}>Log In</Link>
            </Button>
            <Button className="bg-secondary text-secondary-foreground hover:bg-secondary/90" asChild>
              <Link to="/coming-soon" onClick={() => setMenuOpen(false)}>Start Free</Link>
            </Button>
          </div>
        </div>
      )}
    </nav>
  );
}
