import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Wraps /client/* routes. Ensures:
 *  - User is authenticated
 *  - User has a row in client_users (i.e., is a client portal user, not a winery user)
 * Winery users hitting /client/* are redirected to /dashboard.
 * Unauthenticated users go to /client/login.
 */
export const ClientProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const [state, setState] = useState<"loading" | "client" | "winery" | "anon">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!session) { setState("anon"); return; }
      const { data: clientRow } = await supabase
        .from("client_users")
        .select("id")
        .eq("auth_user_id", session.user.id)
        .maybeSingle();
      if (cancelled) return;
      setState(clientRow ? "client" : "winery");
    })();
    return () => { cancelled = true; };
  }, [location.pathname]);

  if (state === "loading") {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (state === "anon") return <Navigate to="/client/login" replace />;
  if (state === "winery") return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};
