import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Check, Grape, Wine, Warehouse, Brain, ShoppingCart } from "lucide-react";
import soleraLogo from "@/assets/solera-logo.png";

const TIERS = [
  { value: "hobbyist" as const, label: "Hobbyist", desc: "Personal or hobby winemaking" },
  { value: "small_boutique" as const, label: "Pro", desc: "Small boutique winery, under 5,000 cases/year" },
  { value: "mid_size" as const, label: "Growth", desc: "Mid-size operation, 5,000–50,000 cases/year" },
  { value: "enterprise" as const, label: "Enterprise", desc: "50,000+ cases/year" },
];

const MODULES = [
  { key: "vineyard_ops", label: "Vineyard Ops", icon: Grape, desc: "Track blocks, vines, and field work" },
  { key: "vintage_management", label: "Vintage Management", icon: Wine, desc: "Manage fermentation and aging" },
  { key: "cellar_management", label: "Cellar Management", icon: Warehouse, desc: "Barrel tracking and inventory" },
  { key: "ai_analytics", label: "AI Analytics", icon: Brain, desc: "Smart insights from your data" },
  { key: "sales_dtc", label: "Sales & DTC", icon: ShoppingCart, desc: "Direct-to-consumer and orders" },
];

const Onboarding = () => {
  const navigate = useNavigate();
  const { profile, refreshProfile } = useAuth();
  const [step, setStep] = useState(1);
  const [tier, setTier] = useState<"hobbyist" | "small_boutique" | "mid_size" | "enterprise" | null>(null);
  const [enabledModules, setEnabledModules] = useState<string[]>(["vineyard_ops", "vintage_management", "cellar_management"]);
  const [loading, setLoading] = useState(false);

  const toggleModule = (key: string) => {
    setEnabledModules((prev) =>
      prev.includes(key) ? prev.filter((m) => m !== key) : [...prev, key]
    );
  };

  const handleFinish = async () => {
    if (!profile?.org_id || !tier) return;
    setLoading(true);
    const { error } = await supabase
      .from("organizations")
      .update({ tier, enabled_modules: enabledModules, onboarding_completed: true })
      .eq("id", profile.org_id);

    if (error) {
      toast.error("Failed to save settings");
    } else {
      await refreshProfile();
      toast.success("Welcome to Solera!");
      navigate("/dashboard");
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-4 py-8">
      <div className="w-full max-w-2xl">
        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`h-2 rounded-full transition-all ${s <= step ? "bg-primary w-16" : "bg-border w-8"}`} />
          ))}
        </div>

        {step === 1 && (
          <Card className="border-none shadow-xl">
            <CardHeader className="text-center">
              <img src={soleraLogo} alt="Solera" className="h-16 w-16 mx-auto mb-2" />
              <CardTitle className="text-2xl font-display text-primary">What type of operation?</CardTitle>
              <CardDescription>This helps us tailor Solera to your needs</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {TIERS.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTier(t.value)}
                  className={`p-4 rounded-lg border-2 text-left transition-all min-h-[80px] ${
                    tier === t.value
                      ? "border-primary bg-primary/5 shadow-md"
                      : "border-border hover:border-secondary/50"
                  }`}
                >
                  <div className="font-semibold text-foreground">{t.label}</div>
                  <div className="text-sm text-muted-foreground mt-1">{t.desc}</div>
                  {tier === t.value && <Check className="h-4 w-4 text-primary mt-2" />}
                </button>
              ))}
            </CardContent>
            <div className="p-6 pt-0">
              <Button className="w-full" disabled={!tier} onClick={() => setStep(2)}>
                Continue
              </Button>
            </div>
          </Card>
        )}

        {step === 2 && (
          <Card className="border-none shadow-xl">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-display text-primary">Choose Your Modules</CardTitle>
              <CardDescription>Enable the features you need — you can change these later</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {MODULES.map((m) => (
                <div key={m.key} className="flex items-center justify-between p-4 rounded-lg border border-border">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-primary/10">
                      <m.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <Label className="font-medium cursor-pointer">{m.label}</Label>
                      <p className="text-sm text-muted-foreground">{m.desc}</p>
                    </div>
                  </div>
                  <Switch
                    checked={enabledModules.includes(m.key)}
                    onCheckedChange={() => toggleModule(m.key)}
                  />
                </div>
              ))}
            </CardContent>
            <div className="p-6 pt-0 flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Back</Button>
              <Button onClick={() => setStep(3)} className="flex-1">Continue</Button>
            </div>
          </Card>
        )}

        {step === 3 && (
          <Card className="border-none shadow-xl">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-display text-primary">You're All Set!</CardTitle>
              <CardDescription>Review your setup and get started</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 rounded-lg bg-muted">
                <div className="text-sm font-medium text-muted-foreground mb-1">Operation Type</div>
                <div className="font-semibold text-foreground capitalize">{tier?.replace("_", " ")}</div>
              </div>
              <div className="p-4 rounded-lg bg-muted">
                <div className="text-sm font-medium text-muted-foreground mb-2">Enabled Modules</div>
                <div className="flex flex-wrap gap-2">
                  {enabledModules.map((key) => {
                    const mod = MODULES.find((m) => m.key === key);
                    return mod ? (
                      <span key={key} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium">
                        <mod.icon className="h-3.5 w-3.5" />
                        {mod.label}
                      </span>
                    ) : null;
                  })}
                </div>
              </div>
            </CardContent>
            <div className="p-6 pt-0 flex gap-3">
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1">Back</Button>
              <Button onClick={handleFinish} disabled={loading} className="flex-1">
                {loading ? "Setting up..." : "Launch Solera"}
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Onboarding;
