import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, CreditCard, ArrowRight, Info, Loader2, Copy, Gift, Users, Calendar } from "lucide-react";
import { getTierDisplay } from "@/hooks/useTierGate";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { getPaddle } from "@/lib/paddle-client";
import { PADDLE_PRICES } from "@/constants/paddle-prices";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";

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
      if (downgradeTarget === "hobbyist") {
        // Cancel subscription
        const { error } = await supabase.functions.invoke("paddle-subscription", {
          body: { action: "cancel", org_id: organization?.id },
        });
        if (error) throw error;
        toast({ title: "Subscription canceled", description: "Your subscription will end at the current billing period." });
      } else {
        const priceId = (PADDLE_PRICES as any)[downgradeTarget]?.monthly;
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
      if (hasPaddleSub) {
        // Existing subscriber — change plan via API
        const priceId = (PADDLE_PRICES as any)[tier]?.monthly;
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
        // No subscription — create checkout server-side to bind org_id securely
        const priceId = (PADDLE_PRICES as any)[tier]?.monthly;
        if (!priceId) {
          toast({ title: "Error", description: "Unable to start checkout. Please contact support.", variant: "destructive" });
          return;
        }

        const { data, error } = await supabase.functions.invoke("create-checkout", {
          body: { priceId },
        });
        if (error || !data?.checkoutUrl) {
          toast({ title: "Error", description: "Unable to start checkout. Please try again.", variant: "destructive" });
          return;
        }

        window.location.href = data.checkoutUrl;
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
        <CardContent className="space-y-3">
          {(() => {
            const nextBilledAt = (organization as any)?.next_billed_at;
            const subStatus = (organization as any)?.subscription_status;
            const isCanceledOrPaused = subStatus === 'canceled' || subStatus === 'paused';

            if (nextBilledAt && isCanceledOrPaused) {
              return (
                <p className="text-sm text-muted-foreground">
                  Subscription {subStatus} — access continues until{' '}
                  <strong>{new Date(nextBilledAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</strong>
                </p>
              );
            }

            if (nextBilledAt && !isCanceledOrPaused) {
              return (
                <p className="text-sm text-muted-foreground">
                  Next billing date:{' '}
                  <strong>{new Date(nextBilledAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</strong>
                </p>
              );
            }

            return null;
          })()}
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

      {/* Referral Program — Pro and Growth only */}
      {(currentTier === "small_boutique" || currentTier === "mid_size") && (
        <ReferralSection userId={user?.id} />
      )}

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

function ReferralSection({ userId }: { userId?: string }) {
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [stats, setStats] = useState({ total: 0, converted: 0, daysEarned: 0 });

  useEffect(() => {
    if (!userId) return;
    (async () => {
      // Get user's referral code
      const { data: profile } = await supabase
        .from("profiles")
        .select("referral_code")
        .eq("id", userId)
        .single();
      if (profile?.referral_code) setReferralCode(profile.referral_code);

      // Get referral stats
      const { data: referrals } = await supabase
        .from("referrals")
        .select("status, credit_days_earned")
        .eq("referrer_user_id", userId);

      if (referrals) {
        const total = referrals.length;
        const converted = referrals.filter((r: any) => r.status === "converted").length;
        const daysEarned = referrals.reduce((sum: number, r: any) => sum + (r.credit_days_earned || 0), 0);
        setStats({ total, converted, daysEarned });
      }
    })();
  }, [userId]);

  const referralLink = referralCode ? `solera.vin/join?ref=${referralCode}` : "";

  const copyLink = () => {
    navigator.clipboard.writeText(`https://${referralLink}`);
    toast({ title: "Copied!", description: "Referral link copied to clipboard." });
  };

  if (!referralCode) return null;

  return (
    <Card className="border-none shadow-md">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Gift className="h-5 w-5 text-secondary" />
          <CardTitle className="font-display text-lg">Referral Program</CardTitle>
        </div>
        <CardDescription>
          Share your link. When someone signs up and converts to a paid Pro or Growth plan, you earn 30 free days (up to 180 max).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Input readOnly value={referralLink} className="font-mono text-sm" />
          <Button variant="outline" size="icon" onClick={copyLink}>
            <Copy className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-muted rounded-lg">
            <Users className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-2xl font-bold text-foreground">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Referred</p>
          </div>
          <div className="text-center p-3 bg-muted rounded-lg">
            <Check className="h-4 w-4 mx-auto mb-1 text-secondary" />
            <p className="text-2xl font-bold text-foreground">{stats.converted}</p>
            <p className="text-xs text-muted-foreground">Converted</p>
          </div>
          <div className="text-center p-3 bg-muted rounded-lg">
            <Calendar className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-2xl font-bold text-foreground">{stats.daysEarned}</p>
            <p className="text-xs text-muted-foreground">Days Earned</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default BillingSettings;
