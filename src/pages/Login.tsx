import { useState } from "react";
import { Link, useNavigate, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import soleraLogo from "@/assets/solera-logo.png";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { LanguageSelector } from "@/components/LanguageSelector";

const Login = () => {
  const { user, loading: authLoading } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  if (!authLoading && user) return <Navigate to="/dashboard" replace />;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error(error.message);
      setLoading(false);
    } else {
      navigate("/dashboard");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-4">
      <Card className="w-full max-w-md border-none shadow-xl">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto">
            <img src={soleraLogo} alt="Solera" className="h-20 w-20 mx-auto" />
          </div>
          <CardTitle className="text-3xl font-display text-primary">Welcome Back</CardTitle>
          <CardDescription>Sign in to your Solera account</CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@winery.com" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </Button>
            <div className="flex justify-between w-full text-sm">
              <Link to="/forgot-password" className="text-secondary hover:underline">Forgot password?</Link>
              <Link to="/coming-soon" className="text-secondary hover:underline">Create account</Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default Login;
