import { useState } from "react";
import { Link, useNavigate, Navigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import soleraLogo from "@/assets/solera-logo.png";
import { useAuth } from "@/contexts/AuthContext";

const Signup = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteCode = searchParams.get("invite");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [wineryName, setWineryName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  if (!authLoading && user) return <Navigate to="/dashboard" replace />;

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            winery_name: wineryName,
          },
          emailRedirectTo: window.location.origin,
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Signup failed. Please try again.");

      // Activate invite code if present
      if (inviteCode) {
        try {
          await supabase.functions.invoke("activate-invite", {
            body: { code: inviteCode },
          });
        } catch (inviteErr) {
          console.error("Invite activation failed:", inviteErr);
        }
      }

      // Admin notification (fire-and-forget)
      supabase.functions.invoke("notify-admin", {
        body: {
          event: "user_signup",
          data: {
            name: `${firstName} ${lastName}`,
            email,
            orgName: wineryName,
            tier: "hobbyist",
          },
        },
      }).catch(() => {});

      toast.success("Account created! Let's set up your winery.");
      navigate("/onboarding");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
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
          <CardTitle className="text-3xl font-display text-primary">Create Your Account</CardTitle>
          <CardDescription>Start managing your winery with Solera</CardDescription>
        </CardHeader>
        <form onSubmit={handleSignup}>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="John" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="wineryName">Winery Name</Label>
              <Input id="wineryName" value={wineryName} onChange={(e) => setWineryName(e.target.value)} placeholder="My Vineyard Estate" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@winery.com" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" minLength={6} required />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating account..." : "Create Account"}
            </Button>
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="text-secondary hover:underline">Sign in</Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default Signup;
