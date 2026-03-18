import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, CreditCard, ArrowRight, Info } from "lucide-react";
import { getTierDisplay } from "@/hooks/useTierGate";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const PLANS = [
  {
    tier: "hobbyist",
    price: "Free",
    features: ["1 vineyard, 2 blocks", "1 user", "Basic lab tracking", "Weather data"],
  },
  {
    tier: "small_boutique",
    price: "$69/mo",
    features: ["Unlimited vineyards & blocks", "5 users", "Cellar management", "Reports & analytics", "Inventory management"],
  },
  {
    tier: "mid_size",
    price: "$129/mo",
    features: ["Everything in Pro", "15 users", "DTC storefront & orders", "Wine club", "Client portal", "All integrations"],
  },
  {
    tier: "enterprise",
    price: "$399/mo",
    features: ["Everything in Growth", "Unlimited users", "SSO / SAML", "Multi-facility", "API & webhooks", "QuickBooks", "Dedicated support"],
  },
];

const BillingSettings = () => {
  const { organization } = useAuth();
  const currentTier = organization?.tier || "hobbyist";
  const hasStripeCustomer = !!(organization as any)?.stripe_customer_id;

  const handleManageBilling = async () => {
    if (!hasStripeCustomer) return;
    try {
      const { data, error } = await supabase.functions.invoke("stripe-portal", {
        body: { org_id: organization?.id },
      });
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleUpgrade = async (tier: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("stripe-checkout", {
        body: { action: "upgrade", org_id: organization?.id, target_tier: tier },
      });
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const TIER_ORDER = ["hobbyist", "small_boutique", "mid_size", "enterprise"];
  const currentIdx = TIER_ORDER.indexOf(currentTier);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Billing & Subscription</h1>
        <p className="text-muted-foreground">Manage your plan, payment method, and billing history.</p>
      </div>

      {/* Current Plan */}
      <Card className="border-none shadow-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="font-display text-lg">Current Plan</CardTitle>
              <CardDescription>You are on the <strong>{getTierDisplay(currentTier)}</strong> plan.</CardDescription>
            </div>
            <Badge className="text-sm px-3 py-1">{getTierDisplay(currentTier)}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {hasStripeCustomer ? (
            <Button variant="outline" onClick={handleManageBilling}>
              <CreditCard className="h-4 w-4 mr-2" />
              Manage Billing & Payment Method
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Info className="h-4 w-4 shrink-0" />
              No active subscription — upgrade to manage billing.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {PLANS.map((plan) => {
          const planIdx = TIER_ORDER.indexOf(plan.tier);
          const isCurrent = plan.tier === currentTier;
          const isUpgrade = planIdx > currentIdx;

          return (
            <Card key={plan.tier} className={`border-none shadow-md ${isCurrent ? "ring-2 ring-primary" : ""}`}>
              <CardHeader>
                <CardTitle className="font-display text-lg">{getTierDisplay(plan.tier)}</CardTitle>
                <CardDescription className="text-xl font-semibold text-foreground">{plan.price}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                {isCurrent ? (
                  <Button variant="outline" disabled className="w-full">Current Plan</Button>
                ) : isUpgrade ? (
                  <Button className="w-full" onClick={() => handleUpgrade(plan.tier)}>
                    Upgrade <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                ) : (
                  <Button variant="ghost" className="w-full text-muted-foreground" onClick={handleManageBilling}>
                    Downgrade
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default BillingSettings;
