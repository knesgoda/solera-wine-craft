import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, CreditCard, ArrowRight, Info, Loader2 } from "lucide-react";
import { getTierDisplay } from "@/hooks/useTierGate";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { getPaddle } from "@/lib/paddle-client";
import { PADDLE_PRICES } from "@/constants/paddle-prices";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const PLANS = [
  {
    tier: "hobbyist",
    price: "Free",
    features: ["1 vineyard, 2 blocks", "1 user", "Basic lab tracking", "Weather data"],
  },
  {
    tier: "small_boutique",
    price: "$69/mo",
    features: ["Unlimited vineyards & blocks", "5 users", "Cellar management", "Sales & DTC", "Innovint/VinNow import"],
  },
  {
    tier: "mid_size",
    price: "$129/mo",
    features: ["Everything in Pro", "15 users", "Ask Solera AI", "Custom reports", "DTC storefront & wine club", "All integrations"],
  },
  {
    tier: "enterprise",
    price: "$399/mo",
    features: ["Everything in Growth", "Unlimited users", "Custom crush client portal", "SSO / SAML", "Multi-facility", "API & webhooks", "Dedicated support"],
  },
];


const BillingSettings = () => {
  const { user, organization } = useAuth();
  const currentTier = organization?.tier || "hobbyist";
  const hasPaddleCustomer = !!(organization as any)?.paddle_customer_id;
  const hasPaddleSub = !!(organization as any)?.paddle_subscription_id;
  const [downgradeTarget, setDowngradeTarget] = useState<string | null>(null);
  const [downgradeLoading, setDowngradeLoading] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState<string | null>(null);

  const handleManageBilling = async () => {
    if (!hasPaddleCustomer) return;
    try {
      const { data, error } = await supabase.functions.invoke("paddle-portal", {
        body: { org_id: organization?.id },
      });
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleDowngrade = (tier: string) => {
    if (!hasPaddleSub) {
      toast({ title: "No active subscription", description: "No active subscription to downgrade.", variant: "destructive" });
      return;
    }
    setDowngradeTarget(tier);
  };

  const confirmDowngrade = async () => {
    if (!downgradeTarget) return;
    setDowngradeLoading(true);
    try {
      const paddleKey = TIER_TO_PADDLE_KEY[downgradeTarget];
      if (downgradeTarget === "hobbyist") {
        // Cancel subscription
        const { error } = await supabase.functions.invoke("paddle-subscription", {
          body: { action: "cancel", org_id: organization?.id },
        });
        if (error) throw error;
        toast({ title: "Subscription canceled", description: "Your subscription will end at the current billing period." });
      } else if (paddleKey) {
        const priceId = (PADDLE_PRICES as any)[paddleKey]?.monthly;
        if (priceId) {
          const { error } = await supabase.functions.invoke("paddle-subscription", {
            body: {
              action: "change_plan",
              org_id: organization?.id,
              new_price_id: priceId,
              billing_mode: "prorated_next_billing_period",
            },
          });
          if (error) throw error;
          toast({ title: "Plan changed", description: "Your plan will change at the next billing period." });
        }
      }
    } catch (e: any) {
      toast({ title: "Error", description: "Something went wrong. Please try again.", variant: "destructive" });
    } finally {
      setDowngradeLoading(false);
      setDowngradeTarget(null);
    }
  };

  const handleUpgrade = async (tier: string) => {
    setUpgradeLoading(tier);
    try {
      const paddleKey = TIER_TO_PADDLE_KEY[tier];
      if (!paddleKey) return;

      if (hasPaddleSub) {
        // Existing subscriber — change plan via API
        const priceId = (PADDLE_PRICES as any)[paddleKey]?.monthly;
        if (priceId) {
          const { error } = await supabase.functions.invoke("paddle-subscription", {
            body: {
              action: "change_plan",
              org_id: organization?.id,
              new_price_id: priceId,
              billing_mode: "prorated_immediately",
            },
          });
          if (error) throw error;
          toast({ title: "Plan upgraded!", description: `You're now on the ${getTierDisplay(tier)} plan.` });
        }
      } else {
        // No subscription — open Paddle checkout
        const priceId = (PADDLE_PRICES as any)[paddleKey]?.monthly;
        if (!priceId) return;

        const paddle = await getPaddle();
        if (!paddle) {
          toast({ title: "Error", description: "Payment system not initialized. Please try again.", variant: "destructive" });
          return;
        }

        const checkoutConfig: any = {
          items: [{ priceId, quantity: 1 }],
          settings: {
            successUrl: `${window.location.origin}/settings/billing?checkout=success`,
            theme: 'light',
            locale: 'en',
          },
        };

        if (organization?.id) {
          checkoutConfig.customData = { org_id: organization.id };
        }
        if (user?.email) {
          checkoutConfig.customer = { email: user.email };
        }

        paddle.Checkout.open(checkoutConfig);
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setUpgradeLoading(null);
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
          {hasPaddleCustomer ? (
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
                  <Button className="w-full" onClick={() => handleUpgrade(plan.tier)} disabled={upgradeLoading === plan.tier}>
                    {upgradeLoading === plan.tier ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Upgrade <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                ) : (
                  <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => handleDowngrade(plan.tier)}>
                    Downgrade
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <AlertDialog open={!!downgradeTarget} onOpenChange={(open) => !open && setDowngradeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {downgradeTarget === "hobbyist"
                ? "Cancel subscription?"
                : `Downgrade to ${downgradeTarget ? getTierDisplay(downgradeTarget) : ""}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {downgradeTarget === "hobbyist"
                ? "Your subscription will end at the current billing period. You'll revert to the free Hobbyist plan."
                : "Your plan will change at the end of your current billing period. You may lose access to some features."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={downgradeLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDowngrade} disabled={downgradeLoading}>
              {downgradeLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading…</> : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default BillingSettings;
