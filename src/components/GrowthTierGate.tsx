import { useTierGate } from "@/hooks/useTierGate";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface GrowthTierGateProps {
  children: React.ReactNode;
  featureName?: string;
  featureDescription?: string;
}

export function GrowthTierGate({ children, featureName, featureDescription }: GrowthTierGateProps) {
  const { allowed } = useTierGate("mid_size");
  const navigate = useNavigate();

  if (allowed) return <>{children}</>;

  const displayName = featureName ?? "Production Cost Tracking";
  const displayDescription = featureDescription ??
    "Track every dollar from grape to bottle with real-time COGS per lot, barrel, and gallon.";

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto mt-12">
      <Card className="border-dashed border-2 border-border">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <DollarSign className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="font-display text-xl font-semibold mb-2">{displayName}</h3>
          <p className="text-muted-foreground text-sm mb-2 max-w-md">
            {displayDescription}
          </p>
          <p className="text-muted-foreground text-xs mb-6 max-w-md">
            Available on Growth ($129/mo) and Enterprise ($399/mo) plans.
          </p>
          <Button onClick={() => navigate("/settings/billing")}>Upgrade to Growth</Button>
        </CardContent>
      </Card>
    </div>
  );
}
