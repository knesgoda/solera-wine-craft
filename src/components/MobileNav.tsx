import {
  LayoutDashboard, ClipboardList, Wine, Bot, Menu,
  Grape, Warehouse, Beaker, Cylinder, Package, ShoppingBag,
  Users, GlassWater, Store, Building2, Scale, Upload, Bell,
  Settings, CreditCard, CloudSun, ShieldAlert, Plug, Key, ScrollText,
  FileText, PenTool, TrendingUp, BarChart3,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";

const mainTabs = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Tasks", url: "/tasks", icon: ClipboardList },
  { title: "Vintages", url: "/vintages", icon: Wine },
  { title: "Ask Solera", url: "/ask-solera", icon: Bot },
];

const moreGroups = [
  {
    label: "Operations",
    items: [
      { title: "Vineyard Ops", url: "/operations", icon: Grape },
      { title: "Reports", url: "/reports", icon: FileText },
      { title: "Report Builder", url: "/reports/builder", icon: PenTool },
      { title: "Analog Explorer", url: "/analytics/analog", icon: TrendingUp },
    ],
  },
  {
    label: "Cellar",
    items: [
      { title: "Cellar Dashboard", url: "/cellar", icon: Warehouse },
      { title: "Barrels", url: "/cellar/barrels", icon: Cylinder },
      { title: "Blending", url: "/cellar/blending", icon: Beaker },
    ],
  },
  {
    label: "Sales & DTC",
    items: [
      { title: "Inventory", url: "/inventory", icon: Package },
      { title: "Orders", url: "/orders", icon: ShoppingBag },
      { title: "Customers", url: "/customers", icon: Users },
      { title: "Wine Club", url: "/club", icon: GlassWater },
      { title: "Store", url: "/store", icon: Store },
    ],
  },
  {
    label: "More",
    items: [
      { title: "Clients", url: "/clients", icon: Building2 },
      { title: "TTB Compliance", url: "/compliance", icon: Scale },
      { title: "Data Import", url: "/data-import", icon: Upload },
      { title: "Notifications", url: "/notifications", icon: Bell },
    ],
  },
  {
    label: "Settings",
    items: [
      { title: "Billing", url: "/settings/billing", icon: CreditCard },
      { title: "Users", url: "/settings/users", icon: Users },
      { title: "Weather", url: "/settings/weather", icon: CloudSun },
      { title: "Alerts", url: "/settings/alerts", icon: ShieldAlert },
      { title: "Integrations", url: "/settings/integrations", icon: Plug },
      { title: "API & Webhooks", url: "/settings/api", icon: Key },
      { title: "Audit Log", url: "/settings/audit", icon: ScrollText },
    ],
  },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around min-h-[64px]">
        {mainTabs.map((tab) => (
          <NavLink
            key={tab.url}
            to={tab.url}
            end={tab.url === "/dashboard"}
            className="flex flex-col items-center justify-center gap-1 min-w-[64px] min-h-[44px] text-muted-foreground"
            activeClassName="text-primary"
          >
            <tab.icon className="h-6 w-6" />
            <span className="text-[10px] font-medium">{tab.title}</span>
          </NavLink>
        ))}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger className="flex flex-col items-center justify-center gap-1 min-w-[64px] min-h-[44px] text-muted-foreground">
            <Menu className="h-6 w-6" />
            <span className="text-[10px] font-medium">More</span>
          </SheetTrigger>
          <SheetContent side="bottom" className="pb-safe max-h-[70vh]">
            <SheetHeader>
              <SheetTitle className="font-display text-lg">Navigation</SheetTitle>
            </SheetHeader>
            <ScrollArea className="h-full mt-4">
              <div className="space-y-6 pb-8">
                {moreGroups.map((group) => (
                  <div key={group.label}>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">{group.label}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {group.items.map((tab) => (
                        <NavLink
                          key={tab.url}
                          to={tab.url}
                          className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted min-h-[44px]"
                          activeClassName="bg-primary/10 text-primary"
                          onClick={() => setOpen(false)}
                        >
                          <tab.icon className="h-5 w-5 shrink-0" />
                          <span className="font-medium text-sm">{tab.title}</span>
                        </NavLink>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
