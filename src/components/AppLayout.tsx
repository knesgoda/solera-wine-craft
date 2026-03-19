import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { TopBar } from "@/components/TopBar";
import { MobileNav } from "@/components/MobileNav";
import { FacilityProvider } from "@/contexts/FacilityContext";
import { Outlet } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { ImpersonationGuard } from "@/components/ImpersonationGuard";
import { supabase } from "@/integrations/supabase/client";

export function AppLayout() {
  const { user } = useAuth();
  const { active: isImpersonating } = useImpersonation();

  // Keep last_active_at current on every app mount
  useEffect(() => {
    if (user && !isImpersonating) {
      supabase
        .from("profiles")
        .update({ last_active_at: new Date().toISOString() })
        .eq("id", user.id)
        .then(({ error }) => {
          if (error) console.error("last_active_at update error:", error.message);
        });
    }
  }, [user, isImpersonating]);

  return (
    <SidebarProvider>
      <FacilityProvider>
        <div className="min-h-screen flex w-full">
          <div className="hidden md:block">
            <AppSidebar />
          </div>
          <div className="flex-1 flex flex-col min-w-0">
            <ImpersonationGuard>
              <TopBar />
              <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6 overflow-auto">
                <Outlet />
              </main>
            </ImpersonationGuard>
          </div>
        </div>
        <MobileNav />
      </FacilityProvider>
    </SidebarProvider>
  );
}
