import { Outlet } from "react-router-dom";
import { MarketingNavbar } from "./MarketingNavbar";
import { MarketingFooter } from "./MarketingFooter";

export function MarketingLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <MarketingNavbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <MarketingFooter />
    </div>
  );
}
