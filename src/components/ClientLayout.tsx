import { useEffect, useState } from "react";
import { Outlet, useNavigate, useLocation, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { LayoutDashboard, Wine, FileText, MessageSquare, User, Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import soleraLogo from "@/assets/solera-logo.png";

const navItems = [
  { label: "Dashboard", path: "/client/dashboard", icon: LayoutDashboard },
  { label: "My Vintages", path: "/client/vintages", icon: Wine },
  { label: "Documents", path: "/client/documents", icon: FileText },
  { label: "Messages", path: "/client/messages", icon: MessageSquare },
];

export default function ClientLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { navigate("/client/login"); return; }
      setUserId(session.user.id);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) navigate("/client/login");
      else setUserId(session.user.id);
    });
    return () => subscription.unsubscribe();
  }, []);

  const { data: clientUser } = useQuery({
    queryKey: ["client-user", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("client_users").select("*, client_orgs(name)").eq("auth_user_id", userId!).single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!userId,
  });

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["client-unread", clientUser?.client_org_id],
    queryFn: async () => {
      const { count } = await supabase.from("client_messages").select("id", { count: "exact", head: true }).eq("client_org_id", clientUser.client_org_id).eq("sender_type", "facility").eq("read", false);
      return count || 0;
    },
    enabled: !!clientUser?.client_org_id,
    refetchInterval: 30000,
  });

  if (loading) return <div className="flex items-center justify-center h-screen"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="flex h-screen bg-background">
      <aside className="w-64 border-r bg-sidebar flex flex-col">
        <div className="flex items-center gap-3 px-4 py-5">
          <img src={soleraLogo} alt="Solera" className="h-9 w-9 shrink-0" />
          <div>
            <span className="font-display text-lg font-bold text-sidebar-foreground block">Client Portal</span>
            {clientUser && <span className="text-xs text-sidebar-foreground/60">{clientUser.client_orgs?.name}</span>}
          </div>
        </div>
        <nav className="flex-1 px-2 space-y-1">
          {navItems.map((item) => {
            const active = location.pathname.startsWith(item.path);
            return (
              <Link key={item.path} to={item.path} className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${active ? "bg-sidebar-accent text-sidebar-foreground font-medium" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50"}`}>
                <item.icon className="h-5 w-5 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.label === "Messages" && unreadCount > 0 && <Badge variant="destructive" className="text-xs px-1.5">{unreadCount}</Badge>}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t">
          <Button variant="ghost" className="w-full justify-start text-sidebar-foreground/70" onClick={async () => { await supabase.auth.signOut(); navigate("/client/login"); }}>
            <LogOut className="h-4 w-4 mr-2" />Sign Out
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-6">
        <Outlet context={{ clientUser }} />
      </main>
    </div>
  );
}
