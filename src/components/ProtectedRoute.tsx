import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, organization, profile, authError, refreshProfile } = useAuth();
  const [timedOut, setTimedOut] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [clientCheck, setClientCheck] = useState<"pending" | "winery" | "client">("pending");

  // P0: Detect client portal users and redirect them to the client portal.
  // Prevents dual-role/legacy accounts from rendering winery routes.
  useEffect(() => {
    let cancelled = false;
    if (!user) { setClientCheck("pending"); return; }
    (async () => {
      const { data } = await supabase
        .from("client_users")
        .select("id")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      setClientCheck(data ? "client" : "winery");
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  // 6-second timeout for org loading
  useEffect(() => {
    if (!loading && user && profile?.org_id && !organization && !authError) {
      const timer = setTimeout(() => setTimedOut(true), 6000);
      return () => clearTimeout(timer);
    }
    if (organization || authError) {
      setTimedOut(false);
    }
  }, [loading, user, profile?.org_id, organization, authError]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-primary font-display text-2xl">Solera</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (clientCheck === "client") return <Navigate to="/client/dashboard" replace />;

  // Show error state if auth failed or timed out
  if (authError || timedOut) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4 max-w-sm px-4">
          <h2 className="text-xl font-display font-bold text-foreground">Unable to load your account</h2>
          <p className="text-sm text-muted-foreground">
            {authError || "Loading your organization is taking longer than expected. Please try again."}
          </p>
          <Button
            onClick={async () => {
              setRetrying(true);
              setTimedOut(false);
              await refreshProfile();
              setRetrying(false);
            }}
            disabled={retrying}
          >
            {retrying ? "Retrying…" : "Retry"}
          </Button>
        </div>
      </div>
    );
  }

  // Org is still loading (profile has org_id but org hasn't resolved yet)
  if (!organization && profile?.org_id) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-primary font-display text-2xl">Solera</div>
      </div>
    );
  }

  if (organization && !organization.onboarding_completed) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
};
