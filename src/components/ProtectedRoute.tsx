import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, organization, profile, authError, refreshProfile } = useAuth();
  const [timedOut, setTimedOut] = useState(false);
  const [retrying, setRetrying] = useState(false);

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
