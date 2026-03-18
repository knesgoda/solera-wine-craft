import { useRoleAccess, AppRole } from "@/hooks/useRoleAccess";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldX } from "lucide-react";

interface RoleGateProps {
  /** Section key to check access for */
  section?: string;
  /** Or require a minimum role level */
  minRole?: AppRole;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RoleGate({ section, minRole, children, fallback }: RoleGateProps) {
  const { canAccess, isAtLeast } = useRoleAccess();

  const allowed = section ? canAccess(section) : minRole ? isAtLeast(minRole) : true;

  if (allowed) return <>{children}</>;

  if (fallback) return <>{fallback}</>;

  return (
    <Card className="border-dashed border-2 border-border">
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <ShieldX className="h-10 w-10 text-muted-foreground mb-4" />
        <h3 className="font-display text-lg font-semibold mb-2">Access Restricted</h3>
        <p className="text-muted-foreground text-sm max-w-md">
          You don't have permission to access this section. Contact your organization owner to request access.
        </p>
      </CardContent>
    </Card>
  );
}
