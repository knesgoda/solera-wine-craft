import {
  LayoutDashboard, Grape, Wine, Warehouse, Bot, Upload, Settings, ClipboardList, Cylinder, Beaker,
  Bell, ShieldAlert, CloudSun, FileSpreadsheet, FileText, PenTool, TrendingUp, Star, BarChart3, Package,
  Store, ShoppingBag, Users, Plug, GlassWater, Truck, Building2, Scale, FileCheck, Shield, Key,
  CreditCard, ScrollText, MessageSquare, Lock, ChevronRight,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTierGate, type TierName } from "@/hooks/useTierGate";
import soleraLogo from "@/assets/solera-logo.png";
import { type LucideIcon } from "lucide-react";

type NavItem = { title: string; url: string; icon: LucideIcon };

interface NavGroupConfig {
  label: string;
  icon: LucideIcon;
  items: NavItem[];
  requiredTier?: TierName;
  defaultOpen?: boolean;
}

const NAV_GROUPS: NavGroupConfig[] = [
  {
    label: "Operations",
    icon: LayoutDashboard,
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
      { title: "Vineyard Ops", url: "/operations", icon: Grape },
      { title: "Tasks", url: "/tasks", icon: ClipboardList },
      { title: "Vintages", url: "/vintages", icon: Wine },
    ],
  },
  {
    label: "Cellar",
    icon: Warehouse,
    requiredTier: "small_boutique",
    items: [
      { title: "Cellar Dashboard", url: "/cellar", icon: Warehouse },
      { title: "Barrels", url: "/cellar/barrels", icon: Cylinder },
      { title: "Blending", url: "/cellar/blending", icon: Beaker },
    ],
  },
  {
    label: "AI & Analytics",
    icon: Bot,
    requiredTier: "mid_size",
    items: [
      { title: "Ask Solera", url: "/ask-solera", icon: Bot },
      { title: "Reports", url: "/reports", icon: FileText },
      { title: "Report Builder", url: "/reports/builder", icon: PenTool },
      { title: "Analog Explorer", url: "/analytics/analog", icon: TrendingUp },
    ],
  },
  {
    label: "Sales & DTC",
    icon: ShoppingBag,
    requiredTier: "small_boutique",
    items: [
      { title: "Inventory", url: "/inventory", icon: Package },
      { title: "Orders", url: "/orders", icon: ShoppingBag },
      { title: "Customers", url: "/customers", icon: Users },
      { title: "Wine Club", url: "/club", icon: GlassWater },
      { title: "Store", url: "/store", icon: Store },
    ],
  },
  {
    label: "Custom Crush",
    icon: Building2,
    requiredTier: "enterprise",
    items: [
      { title: "Clients", url: "/clients", icon: Building2 },
    ],
  },
  {
    label: "Compliance",
    icon: Scale,
    items: [
      { title: "TTB Compliance", url: "/compliance", icon: Scale },
    ],
  },
  {
    label: "Data",
    icon: Upload,
    items: [
      { title: "Data Import", url: "/data-import", icon: Upload },
      { title: "Notifications", url: "/notifications", icon: Bell },
    ],
  },
  {
    label: "Settings",
    icon: Settings,
    defaultOpen: false,
    items: [
      { title: "Billing", url: "/settings/billing", icon: CreditCard },
      { title: "Users", url: "/settings/users", icon: Users },
      { title: "Weather", url: "/settings/weather", icon: CloudSun },
      { title: "Alerts", url: "/settings/alerts", icon: ShieldAlert },
      { title: "SMS Alerts", url: "/settings/alerts/sms", icon: MessageSquare },
      { title: "Ratings", url: "/settings/ratings", icon: Star },
      { title: "Storefront", url: "/settings/storefront", icon: Store },
      { title: "Integrations", url: "/settings/integrations", icon: Plug },
      { title: "Google Sheets", url: "/settings/integrations/google-sheets", icon: FileSpreadsheet },
      { title: "SSO / SAML", url: "/settings/sso", icon: Shield },
      { title: "Facilities", url: "/settings/facilities", icon: Building2 },
      { title: "API & Webhooks", url: "/settings/api", icon: Key },
      { title: "Audit Log", url: "/settings/audit", icon: ScrollText },
    ],
  },
];

function SidebarNavGroup({ group, collapsed, currentPath }: { group: NavGroupConfig; collapsed: boolean; currentPath: string }) {
  const hasActiveItem = group.items.some((i) => currentPath === i.url || currentPath.startsWith(i.url + "/"));
  const defaultOpen = group.defaultOpen !== false || hasActiveItem;

  // Tier gating
  const tierCheck = useTierGate(group.requiredTier || "hobbyist");
  const locked = group.requiredTier ? !tierCheck.allowed : false;

  if (collapsed) {
    // In collapsed mode, show just the group icon
    const firstItem = group.items[0];
    const GroupIcon = group.icon;
    if (locked) {
      return (
        <SidebarMenuItem>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center justify-center py-3 opacity-40 cursor-not-allowed">
                <Lock className="h-5 w-5 text-sidebar-foreground/50" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">Upgrade to {tierCheck.requiredTierDisplay}</TooltipContent>
          </Tooltip>
        </SidebarMenuItem>
      );
    }
    return (
      <SidebarMenuItem>
        <SidebarMenuButton asChild>
          <NavLink
            to={firstItem.url}
            end={firstItem.url === "/dashboard" || firstItem.url === "/cellar"}
            className="hover:bg-sidebar-accent/50 text-sidebar-foreground/80 py-3 justify-center"
            activeClassName="bg-sidebar-accent text-sidebar-foreground font-medium"
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <GroupIcon className="h-5 w-5 shrink-0" />
              </TooltipTrigger>
              <TooltipContent side="right">{group.label}</TooltipContent>
            </Tooltip>
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  if (locked) {
    return (
      <SidebarGroup>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2 px-3 py-2 opacity-40 cursor-not-allowed select-none">
              <Lock className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">{group.label}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">Upgrade to {tierCheck.requiredTierDisplay}</TooltipContent>
        </Tooltip>
      </SidebarGroup>
    );
  }

  return (
    <Collapsible defaultOpen={defaultOpen} className="group/collapsible">
      <SidebarGroup>
        <CollapsibleTrigger asChild>
          <SidebarGroupLabel className="cursor-pointer hover:bg-sidebar-accent/30 rounded-md transition-colors flex items-center justify-between pr-2">
            <span>{group.label}</span>
            <ChevronRight className="h-3.5 w-3.5 transition-transform group-data-[state=open]/collapsible:rotate-90" />
          </SidebarGroupLabel>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/dashboard" || item.url === "/cellar" || item.url === "/reports"}
                      className="hover:bg-sidebar-accent/50 text-sidebar-foreground/80 py-2.5 pl-4"
                      activeClassName="bg-sidebar-accent text-sidebar-foreground font-medium"
                    >
                      <item.icon className="mr-3 h-4 w-4 shrink-0" />
                      <span className="text-sm">{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarContent className="bg-sidebar">
        <div className={`flex items-center gap-3 px-4 py-5 ${collapsed ? "justify-center" : ""}`}>
          <img src={soleraLogo} alt="Solera" className="h-9 w-9 shrink-0" />
          {!collapsed && <span className="font-display text-xl font-bold text-sidebar-foreground">Solera</span>}
        </div>

        {collapsed ? (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV_GROUPS.map((group) => (
                  <SidebarNavGroup key={group.label} group={group} collapsed currentPath={location.pathname} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : (
          NAV_GROUPS.map((group) => (
            <SidebarNavGroup key={group.label} group={group} collapsed={false} currentPath={location.pathname} />
          ))
        )}
      </SidebarContent>
    </Sidebar>
  );
}
