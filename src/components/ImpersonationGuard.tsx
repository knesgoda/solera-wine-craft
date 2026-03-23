import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useNavigate } from "react-router-dom";
import { ShieldAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: React.ReactNode;
}

export function ImpersonationGuard({ children }: Props) {
  const { active, orgName, stopImpersonation } = useImpersonation();
  const navigate = useNavigate();

  const handleExit = () => {
    stopImpersonation();
    navigate("/admin");
  };

  if (!active) return <>{children}</>;

  return (
    <>
      {/* Warning banner */}
      <div className="bg-destructive text-destructive-foreground px-4 py-2 text-sm font-medium flex items-center justify-between z-50">
        <span>⚠️ Admin Mode: Viewing as <strong>{orgName}</strong></span>
        <Button variant="ghost" size="sm" className="text-destructive-foreground hover:bg-destructive/80 h-7" onClick={handleExit}>
          <X className="h-3 w-3 mr-1" /> Exit
        </Button>
      </div>
      <div className="bg-destructive/90 text-destructive-foreground px-4 py-1.5 text-xs flex items-center gap-2 z-50">
        <ShieldAlert className="h-3 w-3" />
        🚫 Read-only mode — no changes can be saved while viewing as another org
      </div>
      {children}
    </>
  );
}
