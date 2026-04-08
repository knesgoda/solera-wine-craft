import {
  LayoutDashboard, Grape, Wine, Warehouse, Bot, Upload, Settings, ClipboardList, Cylinder, Beaker,
  Bell, ShieldAlert, CloudSun, FileSpreadsheet, FileText, PenTool, TrendingUp, Star, BarChart3, Package,
  Store, ShoppingBag, Users, Plug, GlassWater, Truck, Building2, Scale, FileCheck, Shield, Key,
  CreditCard, ScrollText, MessageSquare, Lock, ChevronRight, Wheat, DollarSign,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTierGate, type TierName } from "@/hooks/useTierGate";
import soleraLogo from "@/assets/solera-logo.png";
import { type LucideIcon } from "lucide-react";

type NavItem = { title: string; tKey?: string; url: string; icon: LucideIcon };

interface NavGroupConfig {
  label: string;
  tKey?: string;
  icon: LucideIcon;
  items: NavItem[];
  requiredTier?: TierName;
  defaultOpen?: boolean;
}

const NAV_GROUPS: NavGroupConfig[] = [
  {
    label: "Operations", tKey: "nav.vineyardOps",
    icon: LayoutDashboard,
    items: [
      { title: "Dashboard", tKey: "nav.dashboard", url: "/dashboard", icon: LayoutDashboard },
      { title: "Vineyard Ops", tKey: "nav.vineyardOps", url: "/operations", icon: Grape },
      { title: "Ripening Tracker", tKey: "nav.ripeningTracker", url: "/ripening-comparison", icon: TrendingUp },
      { title: "Tasks", tKey: "nav.tasks", url: "/tasks", icon: ClipboardList },
      { title: "Vintages", tKey: "nav.vintages", url: "/vintages", icon: Wine },
    ],
  },
  {
    label: "Growers", tKey: "nav.growers",
    icon: Wheat,
    requiredTier: "enterprise",
    items: [
      { title: "Growers", tKey: "nav.growers", url: "/growers", icon: Wheat },
      { title: "Contracts", tKey: "nav.contracts", url: "/growers/contracts", icon: FileText },
      { title: "Intake", url: "/growers/intake", icon: Scale },
    ],
  },
  {
    label: "Cellar", tKey: "nav.cellar",
    icon: Warehouse,
    requiredTier: "small_boutique",
    items: [
      { title: "Cellar Dashboard", tKey: "nav.cellar", url: "/cellar", icon: Warehouse },
      { title: "Barrels", tKey: "nav.barrels", url: "/cellar/barrels", icon: Cylinder },
      { title: "Blending", tKey: "nav.blendingTrials", url: "/cellar/blending", icon: Beaker },
    ],
  },
  {
    label: "Production Costs", tKey: "nav.costs",
    icon: DollarSign,
    requiredTier: "mid_size",
    items: [
      { title: "Cost Overview", tKey: "nav.costs", url: "/costs", icon: DollarSign },
      { title: "COGS Dashboard", url: "/costs/dashboard", icon: BarChart3 },
      { title: "Material Prices", url: "/costs/materials", icon: Package },
      { title: "Settings", tKey: "nav.settings", url: "/costs/settings", icon: Settings },
    ],
  },
  {
    label: "AI & Analytics", tKey: "nav.analytics",
    icon: Bot,
    requiredTier: "mid_size",
    items: [
      { title: "Ask Solera", tKey: "nav.askSolera", url: "/ask-solera", icon: Bot },
      { title: "Reports", tKey: "nav.reports", url: "/reports", icon: FileText },
      { title: "Report Builder", url: "/reports/builder", icon: PenTool },
      { title: "Analog Explorer", url: "/analytics/analog", icon: TrendingUp },
    ],
  },
  {
    label: "Sales & DTC", tKey: "nav.sales",
    icon: ShoppingBag,
    requiredTier: "small_boutique",
    items: [
      { title: "Inventory", tKey: "nav.inventory", url: "/inventory", icon: Package },
      { title: "Orders", tKey: "nav.orders", url: "/orders", icon: ShoppingBag },
      { title: "Customers", tKey: "nav.customers", url: "/customers", icon: Users },
      { title: "Wine Club", tKey: "nav.wineClub", url: "/club", icon: GlassWater },
      { title: "Store", url: "/store", icon: Store },
    ],
  },
  {
    label: "Custom Crush", tKey: "nav.customCrush",
    icon: Building2,
    requiredTier: "enterprise",
    items: [
      { title: "Clients", url: "/clients", icon: Building2 },
    ],
  },
  {
    label: "Compliance", tKey: "nav.compliance",
    icon: Scale,
    items: [
      { title: "TTB Compliance", tKey: "nav.compliance", url: "/compliance", icon: Scale },
    ],
  },
  {
    label: "Data", tKey: "nav.dataMigration",
    icon: Upload,
    items: [
      { title: "Data Import", tKey: "nav.dataMigration", url: "/data-import", icon: Upload },
      { title: "Notifications", tKey: "nav.notifications", url: "/notifications", icon: Bell },
    ],
  },
  {
    label: "Settings", tKey: "nav.settings",
    icon: Settings,
    defaultOpen: false,
    items: [
      { title: "Billing", tKey: "nav.billing", url: "/settings/billing", icon: CreditCard },
      { title: "Users", tKey: "nav.users", url: "/settings/users", icon: Users },
      { title: "Weather", tKey: "nav.weather", url: "/settings/weather", icon: CloudSun },
      { title: "Alerts", tKey: "nav.alertRules", url: "/settings/alerts", icon: ShieldAlert },
      { title: "SMS Alerts", url: "/settings/alerts/sms", icon: MessageSquare },
      { title: "Ratings", url: "/settings/ratings", icon: Star },
      { title: "Storefront", url: "/settings/storefront", icon: Store },
      { title: "Integrations", tKey: "nav.integrations", url: "/settings/integrations", icon: Plug },
      { title: "Google Sheets", url: "/settings/integrations/google-sheets", icon: FileSpreadsheet },
      { title: "SSO / SAML", url: "/settings/sso", icon: Shield },
      { title: "Facilities", tKey: "nav.facilities", url: "/settings/facilities", icon: Building2 },
      { title: "API & Webhooks", tKey: "nav.developers", url: "/settings/api", icon: Key },
      { title: "Audit Log", url: "/settings/audit", icon: ScrollText },
    ],
  },
];

function SidebarNavGroup({ group, collapsed, currentPath }: { group: NavGroupConfig; collapsed: boolean; currentPath: string }) {
  const { t } = useTranslation();
  const hasActiveItem = group.items.some((i) => currentPath === i.url || currentPath.startsWith(i.url + "/"));
  const defaultOpen = group.defaultOpen !== false || hasActiveItem;
  const groupLabel = group.tKey ? t(group.tKey) : group.label;

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
              <TooltipContent side="right">{groupLabel}</TooltipContent>
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
            <div
              className="flex items-center gap-2 px-3 py-2 opacity-40 cursor-not-allowed select-none"
              role="group"
              aria-disabled="true"
              aria-label={`${groupLabel} — locked, upgrade required`}
            >
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">{groupLabel}</span>
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
            <span>{groupLabel}</span>
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
                      <span className="text-sm">{item.tKey ? t(item.tKey) : item.title}</span>
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
        <div className={`flex items-center px-4 py-5 ${collapsed ? "justify-center" : ""}`}>
          {!collapsed && <span className="font-display text-xl font-bold text-sidebar-foreground">SOLERA</span>}
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
