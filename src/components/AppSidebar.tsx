import {
  LayoutDashboard, Grape, Wine, Warehouse, Bot, ShoppingCart, Upload, Settings, ClipboardList, Cylinder, Beaker,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";
import soleraLogo from "@/assets/solera-logo.png";

const items = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Vineyard Ops", url: "/operations", icon: Grape },
  { title: "Tasks", url: "/tasks", icon: ClipboardList },
  { title: "Vintages", url: "/vintages", icon: Wine },
  { title: "Cellar", url: "/cellar", icon: Warehouse },
  { title: "Barrels", url: "/cellar/barrels", icon: Cylinder, indent: true },
  { title: "Blending", url: "/cellar/blending", icon: Beaker, indent: true },
  { title: "Ask Solera", url: "/ask-solera", icon: Bot },
  { title: "Sales", url: "/sales", icon: ShoppingCart },
  { title: "Data Import", url: "/data-import", icon: Upload },
  { title: "Settings", url: "/settings", icon: Settings },
];

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
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/dashboard"}
                      className="hover:bg-sidebar-accent/50 text-sidebar-foreground/80 py-3"
                      activeClassName="bg-sidebar-accent text-sidebar-foreground font-medium"
                    >
                      <item.icon className="mr-3 h-5 w-5 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
