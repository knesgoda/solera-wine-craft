import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Shield } from "lucide-react";
import soleraLogo from "@/assets/solera-logo.png";

export default function SsoLogin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSsoLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Look up the user's org via their email domain to find SSO config
      const domain = email.split("@")[1];
      if (!domain) { toast.error("Please enter a valid email address"); setLoading(false); return; }

      // Try to initiate SSO via Supabase Auth signInWithSSO
      const { data, error } = await supabase.auth.signInWithSSO({ domain });

      if (error) {
        toast.error("SSO not configured for this email domain. Contact your administrator.");
        setLoading(false);
        return;
      }

      // Redirect to the IdP
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      toast.error(err.message || "SSO login failed");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-4">
      <Card className="w-full max-w-md border-none shadow-xl">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto">
            <img src={soleraLogo} alt="Solera" className="h-20 w-20 mx-auto" />
          </div>
          <CardTitle className="text-3xl font-display text-primary">SSO Login</CardTitle>
          <CardDescription>Sign in with your organization's identity provider</CardDescription>
        </CardHeader>
        <form onSubmit={handleSsoLogin}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sso-email">Work Email</Label>
              <Input
                id="sso-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
              />
            </div>
          </CardContent>
          <div className="px-6 pb-6 flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={loading}>
              <Shield className="h-4 w-4 mr-2" />
              {loading ? "Redirecting…" : "Continue with SSO"}
            </Button>
            <Button type="button" variant="ghost" className="w-full text-sm" onClick={() => navigate("/login")}>
              Sign in with email & password instead
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
