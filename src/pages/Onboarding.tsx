import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Check, Grape, Wine, Warehouse, Brain, ShoppingCart, RefreshCw, LogOut, FileSpreadsheet, Scale, Users } from "lucide-react";
import soleraLogo from "@/assets/solera-logo.png";
import { SpreadsheetOnboarding } from "@/components/onboarding/SpreadsheetOnboarding";

const OPERATION_TYPES = [
  { value: "hobbyist", label: "Hobbyist", desc: "Home or hobby winemaker, <500 cases", type: "winery", tier: "hobbyist" },
  { value: "small_boutique", label: "Small Boutique", desc: "Family winery, 500–5,000 cases, 1–3 staff", type: "winery", tier: "small_boutique" },
  { value: "mid_size", label: "Mid-Size Winery", desc: "5,000–50,000 cases, dedicated teams", type: "winery", tier: "mid_size" },
  { value: "custom_crush", label: "Custom Crush Facility", desc: "Make wine for 5–20+ client labels", type: "custom_crush", tier: "enterprise" },
  { value: "enterprise", label: "Enterprise Winery", desc: "50,000+ cases, multi-facility", type: "winery", tier: "enterprise" },
];

const MODULES = [
  { key: "vineyard_ops", label: "Vineyard Ops", icon: Grape, desc: "Track blocks, vines, and field work" },
  { key: "vintage_management", label: "Vintage Management", icon: Wine, desc: "Manage fermentation and aging" },
  { key: "cellar_management", label: "Cellar Management", icon: Warehouse, desc: "Barrel tracking and inventory" },
  { key: "ttb_compliance", label: "TTB Compliance", icon: Scale, desc: "Automated TTB reporting and audit trails" },
  { key: "custom_crush", label: "Custom Crush", icon: Users, desc: "Client portal and multi-label management" },
  { key: "ai_analytics", label: "AI Analytics", icon: Brain, desc: "Smart insights from your data" },
  { key: "sales_dtc", label: "Sales & DTC", icon: ShoppingCart, desc: "Direct-to-consumer and orders" },
];

// Always-on module — included automatically, not toggleable
const ALWAYS_ON_MODULES = ["data_import"];

const MAX_RETRIES = 5;

const Onboarding = () => {
  const navigate = useNavigate();
  const { profile, refreshProfile, signOut } = useAuth();
  const [step, setStep] = useState(1);
  const [selection, setSelection] = useState<string | null>(null);
  const [spreadsheetPath, setSpreadsheetPath] = useState(false);
  const [enabledModules, setEnabledModules] = useState<string[]>(["vineyard_ops", "vintage_management", "cellar_management"]);
  const [loading, setLoading] = useState(false);
  const [setupFailed, setSetupFailed] = useState(false);
  const retryCount = useRef(0);

  // Retry mechanism for race condition between signup and DB trigger
  useEffect(() => {
    if (profile && !profile.org_id && retryCount.current < MAX_RETRIES) {
      const timer = setTimeout(() => {
        retryCount.current += 1;
        refreshProfile();
      }, 1000);
      return () => clearTimeout(timer);
    }
    if (profile && !profile.org_id && retryCount.current >= MAX_RETRIES) {
      setSetupFailed(true);
    }
  }, [profile, refreshProfile]);

  if (setupFailed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <img src={soleraLogo} alt="Solera" className="h-10 mx-auto mb-2" />
            <CardTitle className="font-display">Account Setup In Progress</CardTitle>
            <CardDescription>
              Your account is being set up. Please refresh the page or sign out and sign back in.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => { retryCount.current = 0; setSetupFailed(false); refreshProfile(); }}>
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
            <Button variant="destructive" onClick={signOut}>
              <LogOut className="h-4 w-4 mr-2" /> Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Spreadsheet onboarding path ──────────────────────────────────────
  if (spreadsheetPath) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream px-4 py-8">
        <SpreadsheetOnboarding
          onComplete={(dest) => navigate(dest)}
          onBack={() => setSpreadsheetPath(false)}
        />
      </div>
    );
  }

  // ── Standard onboarding path ─────────────────────────────────────────
  const selectedType = OPERATION_TYPES.find((t) => t.value === selection);

  const toggleModule = (key: string) => {
    setEnabledModules((prev) =>
      prev.includes(key) ? prev.filter((m) => m !== key) : [...prev, key]
    );
  };

  const handleFinish = async () => {
    if (!profile?.org_id) {
      toast.error("Organization not found. Please try signing out and back in.");
      return;
    }
    if (!selectedType) return;
    setLoading(true);
    const { error } = await supabase
      .from("organizations")
      .update({
        tier: selectedType.tier as "hobbyist" | "small_boutique" | "mid_size" | "enterprise",
        type: selectedType.type,
        enabled_modules: [...new Set([...enabledModules, ...ALWAYS_ON_MODULES])],
        onboarding_completed: true,
      })
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
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {OPERATION_TYPES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => { setSelection(t.value); setSpreadsheetPath(false); }}
                    className={`p-4 rounded-lg border-2 text-left transition-all min-h-[80px] ${
                      selection === t.value && !spreadsheetPath
                        ? "border-primary bg-primary/5 shadow-md"
                        : "border-border hover:border-secondary/50"
                    }`}
                  >
                    <div className="font-semibold text-foreground">{t.label}</div>
                    <div className="text-sm text-muted-foreground mt-1">{t.desc}</div>
                    {selection === t.value && !spreadsheetPath && <Check className="h-4 w-4 text-primary mt-2" />}
                  </button>
                ))}
              </div>

              {/* Spreadsheet path CTA */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">or</span>
                </div>
              </div>

              <button
                onClick={() => { setSelection(null); setSpreadsheetPath(true); }}
                className={`w-full p-4 rounded-lg border-2 text-left transition-all flex items-center gap-3 ${
                  spreadsheetPath
                    ? "border-primary bg-primary/5 shadow-md"
                    : "border-dashed border-border hover:border-secondary/50"
                }`}
              >
                <div className="p-2 rounded-md bg-primary/10">
                  <FileSpreadsheet className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="font-semibold text-foreground">I use spreadsheets</div>
                  <div className="text-sm text-muted-foreground">
                    Guided import — see your own data in Solera in under 5 minutes
                  </div>
                </div>
                {spreadsheetPath && <Check className="h-4 w-4 text-primary ml-auto" />}
              </button>
            </CardContent>
            <div className="p-6 pt-0">
              <Button
                className="w-full"
                disabled={!selection && !spreadsheetPath}
                onClick={() => {
                  if (spreadsheetPath) {
                    // handled by the spreadsheetPath state above — triggers re-render
                    return;
                  }
                  setStep(2);
                }}
              >
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
                <div className="font-semibold text-foreground">{selectedType?.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5 capitalize">
                  {selectedType?.type === "custom_crush" ? "Custom Crush" : "Winery"} · {selectedType?.tier?.replace("_", " ")} tier
                </div>
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
