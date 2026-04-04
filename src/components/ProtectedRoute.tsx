import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, organization, profile, authError } = useAuth();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!organization && profile?.org_id) {
      const t = setTimeout(() => setTimedOut(true), 6000);
      return () => clearTimeout(t);
    }
  }, [organization, profile?.org_id]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-primary font-display text-2xl">Solera</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (authError || timedOut) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <p className="text-destructive text-sm">
          {authError || "Workspace took too long to load."}
        </p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
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
