import { LayoutDashboard, Grape, Wine, ClipboardList, MoreHorizontal, Bot, ShoppingCart, Upload, Settings, Warehouse } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const mainTabs = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Vineyard", url: "/operations", icon: Grape },
  { title: "Tasks", url: "/tasks", icon: ClipboardList },
  { title: "Vintages", url: "/vintages", icon: Wine },
];

const moreTabs = [
  { title: "Ask Solera", url: "/ask-solera", icon: Bot },
  { title: "Sales", url: "/sales", icon: ShoppingCart },
  { title: "Data Import", url: "/data-import", icon: Upload },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around h-16">
        {mainTabs.map((tab) => (
          <NavLink
            key={tab.url}
            to={tab.url}
            end={tab.url === "/dashboard"}
            className="flex flex-col items-center justify-center gap-1 min-w-[64px] min-h-[44px] text-muted-foreground"
            activeClassName="text-primary"
          >
            <tab.icon className="h-5 w-5" />
            <span className="text-[10px] font-medium">{tab.title}</span>
          </NavLink>
        ))}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger className="flex flex-col items-center justify-center gap-1 min-w-[64px] min-h-[44px] text-muted-foreground">
            <MoreHorizontal className="h-5 w-5" />
            <span className="text-[10px] font-medium">More</span>
          </SheetTrigger>
          <SheetContent side="bottom" className="pb-safe">
            <div className="grid grid-cols-2 gap-4 py-4">
              {moreTabs.map((tab) => (
                <NavLink
                  key={tab.url}
                  to={tab.url}
                  className="flex items-center gap-3 p-4 rounded-lg hover:bg-muted min-h-[44px]"
                  activeClassName="bg-primary/10 text-primary"
                  onClick={() => setOpen(false)}
                >
                  <tab.icon className="h-5 w-5" />
                  <span className="font-medium">{tab.title}</span>
                </NavLink>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
