import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, organization, profile } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-primary font-display text-2xl">Solera</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

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
