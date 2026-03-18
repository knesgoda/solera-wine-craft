import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "owner" | "admin" | "manager" | "cellar" | "field" | "member";

const ROLE_HIERARCHY: Record<AppRole, number> = {
  owner: 100,
  admin: 90,
  manager: 80,
  member: 50,
  cellar: 40,
  field: 30,
};

// What each role can access
const ROLE_ACCESS: Record<AppRole, string[]> = {
  field: ["dashboard", "tasks", "operations", "vintages:view", "lab_samples:add"],
  cellar: ["dashboard", "tasks", "cellar", "vintages", "lab_samples", "barrels", "blending"],
  member: ["dashboard", "tasks", "operations", "vintages", "cellar", "lab_samples", "barrels", "blending", "inventory", "reports"],
  manager: ["dashboard", "tasks", "operations", "vintages", "cellar", "lab_samples", "barrels", "blending", "inventory", "reports", "orders", "customers", "club", "clients", "compliance", "data-import", "ask-solera", "analytics", "integrations", "store"],
  admin: ["*"],
  owner: ["*"],
};

// Sections that specific roles CANNOT access
const ROLE_DENIED: Record<AppRole, string[]> = {
  field: ["orders", "customers", "club", "settings", "financials", "inventory", "compliance", "integrations", "store", "clients", "ask-solera", "reports"],
  cellar: ["orders", "customers", "club", "settings", "financials", "store", "clients", "user-management"],
  member: ["settings", "user-management", "billing"],
  manager: ["user-management", "billing", "sso"],
  admin: [],
  owner: [],
};

export function useRoleAccess() {
  const { user, profile } = useAuth();

  const { data: roles = [] } = useQuery({
    queryKey: ["user-roles", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data.map((r) => r.role as AppRole);
    },
    enabled: !!user?.id,
  });

  // Use highest role
  const primaryRole: AppRole = roles.length > 0
    ? roles.reduce((highest, r) => ROLE_HIERARCHY[r] > ROLE_HIERARCHY[highest] ? r : highest)
    : "member";

  const canAccess = (section: string): boolean => {
    if (primaryRole === "owner" || primaryRole === "admin") return true;
    const denied = ROLE_DENIED[primaryRole] || [];
    return !denied.includes(section);
  };

  const isAtLeast = (role: AppRole): boolean => {
    return ROLE_HIERARCHY[primaryRole] >= ROLE_HIERARCHY[role];
  };

  return { primaryRole, roles, canAccess, isAtLeast };
}
