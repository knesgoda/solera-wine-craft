import React, { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { setOrgTimezone } from "@/lib/timezone";
import { setUnitSystem } from "@/lib/units";
import i18n from "@/lib/i18n";

interface Profile {
  id: string;
  org_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  avatar_url: string | null;
  push_subscription: any | null;
  language: string | null;
}

interface Organization {
  id: string;
  name: string;
  tier: string | null;
  enabled_modules: string[] | null;
  onboarding_completed: boolean;
  timezone: string | null;
  units_preference: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  organization: Organization | null;
  loading: boolean;
  authError: string | null;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  organization: null,
  loading: true,
  authError: null,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const fetchProfile = async (userId: string) => {
    setAuthError(null);

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (profileError) {
      console.error("fetchProfile error:", profileError.message);
      setAuthError(`Failed to load profile: ${profileError.message}`);
      return;
    }

    if (profileData) {
      setProfile(profileData);

      // Apply user's language preference
      if (profileData.language && profileData.language !== i18n.language) {
        i18n.changeLanguage(profileData.language);
      }

      if (profileData.org_id) {
        const { data: orgData, error: orgError } = await supabase
          .from("organizations")
          .select("*")
          .eq("id", profileData.org_id)
          .single();
        if (orgError) {
          console.error("fetchOrg error:", orgError.message);
          setAuthError(`Failed to load organization: ${orgError.message}`);
        } else {
          setOrganization(orgData);
          setOrgTimezone(orgData.timezone ?? null);
          setUnitSystem((orgData.units_preference as any) ?? "imperial");
        }
      }
    }
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  useEffect(() => {
    let initialLoad = true;

    // Subscribe first — onAuthStateChange fires INITIAL_SESSION on mount
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          const promise = fetchProfile(session.user.id);
          // Only gate loading on the initial session event
          if (initialLoad) {
            initialLoad = false;
            promise.finally(() => setLoading(false));
          }
        } else {
          setProfile(null);
          setOrganization(null);
          setAuthError(null);
          if (initialLoad) {
            initialLoad = false;
            setLoading(false);
          }
        }
      }
    );

    // Trigger the INITIAL_SESSION event (no state set here)
    supabase.auth.getSession();

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setOrganization(null);
    setAuthError(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, organization, loading, authError, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
