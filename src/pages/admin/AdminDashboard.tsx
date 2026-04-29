import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRoleAccess } from "@/hooks/useRoleAccess";
import {
  LayoutDashboard, CalendarDays, Users, DollarSign, BarChart3,
  Wrench, Search, FileText, RefreshCw, Monitor,
} from "lucide-react";
import { DashboardTab } from "./components/DashboardTab";
import { WeeklyStrategyTab } from "./components/WeeklyStrategyTab";
import { CustomersTab } from "./components/CustomersTab";
import { RevenueTab } from "./components/RevenueTab";
import { ProductAnalyticsTab } from "./components/ProductAnalyticsTab";
import { OperationsTab } from "./components/OperationsTab";
import { SeoContentTab } from "./components/SeoContentTab";
import { PdfReportsTab } from "./components/PdfReportsTab";
import soleraLogo from "@/assets/solera-logo.png";

// ─── API Hook ───
export function useAdminApi() {
  return useCallback(
    async (action: string, payload?: any) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Access denied");

      const { data, error } = await supabase.functions.invoke("admin-dashboard", {
        body: { action, payload },
        headers: { Authorization: `Bearer ${token}` },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    []
  );
}

// ─── Mobile Block ───
function MobileBlock() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "#1A1A1A" }}>
      <div className="text-center">
        <Monitor className="h-16 w-16 mx-auto mb-4" style={{ color: "#C8902A" }} />
        <h1 className="text-2xl font-display font-bold text-white mb-2">Admin requires desktop</h1>
        <p className="text-gray-400">Please use a device with a screen width of at least 768px.</p>
      </div>
    </div>
  );
}

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "weekly", label: "Weekly Strategy", icon: CalendarDays },
  { key: "customers", label: "Customers", icon: Users },
  { key: "revenue", label: "Revenue", icon: DollarSign },
  { key: "analytics", label: "Product Analytics", icon: BarChart3 },
  { key: "operations", label: "Operations", icon: Wrench },
  { key: "seo", label: "SEO & Content", icon: Search },
  { key: "reports", label: "PDF Reports", icon: FileText },
];

// ─── Main Admin Dashboard ───
export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [refreshKey, setRefreshKey] = useState(0);
  const isMobile = useIsMobile();
  const { isAtLeast } = useRoleAccess();
  const api = useAdminApi();

  const { data: adminVerified, isLoading: verifyingAdmin } = useQuery({
    queryKey: ["verify-admin-session"],
    queryFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return false;

      const { data, error } = await supabase.functions.invoke("verify-admin", {
        body: { action: "verify" },
        headers: { Authorization: `Bearer ${token}` },
      });
      if (error) return false;
      return data?.verified === true;
    },
    retry: false,
  });

  if (!isAtLeast("owner")) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-display font-bold text-foreground">Not Authorized</h1>
          <p className="text-muted-foreground">You don't have permission to access the admin dashboard.</p>
          <Button variant="outline" onClick={() => navigate("/dashboard")}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  if (isMobile) return <MobileBlock />;

  if (verifyingAdmin) {
    return (
      <>
        <SEOHead title="Admin — Solera" noIndex />
        <div className="min-h-screen flex items-center justify-center bg-background">
          <p className="text-muted-foreground">Verifying access…</p>
        </div>
      </>
    );
  }

  if (!adminVerified) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><h1 className="text-2xl font-display font-bold text-foreground">Access denied</h1></div>;
  }

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1);
    setLastRefreshed(new Date());
  };

  const renderTab = () => {
    switch (activeTab) {
      case "dashboard": return <DashboardTab api={api} key={refreshKey} />;
      case "weekly": return <WeeklyStrategyTab api={api} key={refreshKey} />;
      case "customers": return <CustomersTab api={api} password="" key={refreshKey} />;
      case "revenue": return <RevenueTab api={api} key={refreshKey} />;
      case "analytics": return <ProductAnalyticsTab api={api} key={refreshKey} />;
      case "operations": return <OperationsTab api={api} key={refreshKey} />;
      case "seo": return <SeoContentTab api={api} key={refreshKey} />;
      case "reports": return <PdfReportsTab api={api} key={refreshKey} />;
      default: return null;
    }
  };

  return (
    <>
      <SEOHead title="Admin Dashboard — Solera" noIndex />
      <div className="min-h-screen flex" style={{ background: "#F5F0E8" }}>
        {/* Dark Sidebar */}
        <aside className="w-56 min-h-screen flex-shrink-0 flex flex-col" style={{ background: "#1A1A1A" }}>
          <div className="p-4 flex items-center gap-2 border-b" style={{ borderColor: "#333" }}>
            <img src={soleraLogo} alt="Solera" className="h-7" />
            <span className="font-display text-white font-bold text-sm">Admin</span>
          </div>
          <nav className="flex-1 py-2">
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setActiveTab(item.key)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors"
                  style={{
                    background: isActive ? "#6B1B2A" : "transparent",
                    color: isActive ? "#fff" : "#ccc",
                  }}
                >
                  <item.icon className="h-4 w-4" style={{ color: isActive ? "#C8902A" : "#888" }} />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-h-screen overflow-auto">
          {/* Top Bar */}
          <header className="h-14 flex items-center justify-between px-6 bg-white border-b shadow-sm flex-shrink-0">
            <div className="flex items-center gap-3">
              <h1 className="font-display text-lg font-bold" style={{ color: "#6B1B2A" }}>
                {NAV_ITEMS.find((n) => n.key === activeTab)?.label || "Admin"}
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                Last refreshed: {lastRefreshed.toLocaleTimeString()}
              </span>
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4 mr-1" /> Refresh
              </Button>
            </div>
          </header>

          {/* Tab Content */}
          <main className="flex-1 p-6 overflow-auto">
            {renderTab()}
          </main>
        </div>
      </div>
    </>
  );
}
