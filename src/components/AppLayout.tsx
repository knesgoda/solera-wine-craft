import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { TopBar } from "@/components/TopBar";
import { MobileNav } from "@/components/MobileNav";
import { FacilityProvider } from "@/contexts/FacilityContext";
import { Outlet } from "react-router-dom";

export function AppLayout() {
  return (
    <SidebarProvider>
      <FacilityProvider>
        <div className="min-h-screen flex w-full">
          <div className="hidden md:block">
            <AppSidebar />
          </div>
          <div className="flex-1 flex flex-col min-w-0">
            <TopBar />
            <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6 overflow-auto">
              <Outlet />
            </main>
          </div>
        </div>
        <MobileNav />
      </FacilityProvider>
    </SidebarProvider>
  );
}
