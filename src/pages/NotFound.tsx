import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { SEOHead } from "@/components/SEOHead";
import { Grape, Home, Sparkles, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <SEOHead title="Page Not Found — Solera" description="The page you're looking for doesn't exist." noIndex />

      {/* Logo */}
      <Link to="/" className="mb-8">
        <img src="/logo.png" alt="Solera" className="h-10" />
      </Link>

      {/* 404 badge */}
      <div className="flex items-center gap-2 mb-6">
        <Grape className="w-8 h-8 text-secondary" />
        <span className="font-display text-6xl md:text-8xl font-bold text-primary">404</span>
        <Grape className="w-8 h-8 text-secondary" />
      </div>

      <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground text-center mb-3">
        Looks like that vine didn't take.
      </h1>
      <p className="text-muted-foreground text-center max-w-md mb-10">
        The page you're looking for doesn't exist or has been moved. Let's get you back to familiar ground.
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <Link to="/">
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
            <Home className="w-4 h-4" /> Back to Homepage
          </Button>
        </Link>
        <Link to="/features">
          <Button variant="outline" className="gap-2">
            <Sparkles className="w-4 h-4" /> Explore Features
          </Button>
        </Link>
        <Link to="/pricing">
          <Button variant="outline" className="gap-2">
            <DollarSign className="w-4 h-4" /> See Pricing
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
