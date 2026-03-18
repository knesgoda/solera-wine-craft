import { useTierGate, TierName } from "@/hooks/useTierGate";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface TierGateProps {
  requiredTier: TierName;
  featureName: string;
  children: React.ReactNode;
}

export function TierGate({ requiredTier, featureName, children }: TierGateProps) {
  const { allowed, requiredTierDisplay } = useTierGate(requiredTier);
  const navigate = useNavigate();

  if (allowed) return <>{children}</>;

  return (
    <Card className="border-dashed border-2 border-border">
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <Lock className="h-10 w-10 text-muted-foreground mb-4" />
        <h3 className="font-display text-lg font-semibold mb-2">{featureName}</h3>
        <p className="text-muted-foreground text-sm mb-6 max-w-md">
          This feature is available on the <strong>{requiredTierDisplay}</strong> plan and above.
          Upgrade to unlock it.
        </p>
        <Button onClick={() => navigate("/settings/billing")}>Upgrade Plan</Button>
      </CardContent>
    </Card>
  );
}
