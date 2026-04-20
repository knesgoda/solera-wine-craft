import { useEffect, useState } from "react";
import { Outlet, useNavigate, useLocation, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { LayoutDashboard, Wine, FileText, MessageSquare, LogOut, Loader2, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
  const [mobileOpen, setMobileOpen] = useState(false);

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

  const { data: clientUser, isLoading: clientUserLoading, isError: clientUserError } = useQuery({
    queryKey: ["client-user", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_users")
        .select("*, client_orgs(name)")
        .eq("auth_user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!userId,
    retry: false,
  });

  // P0: If the authenticated user has no client_users row, they are not a client
  // portal user — sign them out and bounce to /login. Prevents a winery user
  // from landing on /client/* and seeing an empty/broken portal shell.
  useEffect(() => {
    if (!userId) return;
    if (clientUserLoading) return;
    if (clientUserError || clientUser === null) {
      supabase.auth.signOut().finally(() => navigate("/login", { replace: true }));
    }
  }, [userId, clientUserLoading, clientUserError, clientUser, navigate]);

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

  const handleSignOut = async () => { await supabase.auth.signOut(); navigate("/client/login"); };

  const NavContent = () => (
    <>
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
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${active ? "bg-sidebar-accent text-sidebar-foreground font-medium" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50"}`}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.label === "Messages" && unreadCount > 0 && <Badge variant="destructive" className="text-xs px-1.5">{unreadCount}</Badge>}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t">
        <Button variant="ghost" className="w-full justify-start text-sidebar-foreground/70" onClick={handleSignOut}>
          <LogOut className="h-4 w-4 mr-2" />Sign Out
        </Button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 border-r bg-sidebar flex-col">
        <NavContent />
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="md:hidden flex items-center gap-3 px-4 h-14 border-b bg-card shrink-0">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0 bg-sidebar">
              <SheetHeader className="sr-only">
                <SheetTitle>Navigation</SheetTitle>
              </SheetHeader>
              <div className="flex flex-col h-full">
                <NavContent />
              </div>
            </SheetContent>
          </Sheet>
          <img src={soleraLogo} alt="Solera" className="h-7 w-7" />
          <span className="font-display font-bold text-foreground">Client Portal</span>
        </header>

        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-area-bottom">
          <div className="flex items-center justify-around min-h-[64px]">
            {navItems.map((item) => {
              const active = location.pathname.startsWith(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex flex-col items-center justify-center gap-1 min-w-[64px] min-h-[44px] ${active ? "text-primary" : "text-muted-foreground"}`}
                >
                  <div className="relative">
                    <item.icon className="h-6 w-6" />
                    {item.label === "Messages" && unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-bold">
                        {unreadCount}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-medium">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6">
          <Outlet context={{ clientUser }} />
        </main>
      </div>
    </div>
  );
}
