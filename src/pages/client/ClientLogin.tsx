import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import soleraLogo from "@/assets/solera-logo.png";

const ClientLogin = () => {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });

  const handleLogin = async () => {
    setSubmitting(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password });
      if (error) throw error;

      // Verify this is a client user
      const { data: clientUser } = await supabase.from("client_users").select("id, client_org_id").eq("auth_user_id", data.user.id).single();
      if (!clientUser) {
        await supabase.auth.signOut();
        toast.error("This account is not a client portal account");
        return;
      }

      navigate("/client/dashboard");
    } catch (e: any) { toast.error(e.message); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md border-none shadow-lg">
        <CardHeader className="text-center">
          <img src={soleraLogo} alt="Solera" className="h-12 w-12 mx-auto mb-2" />
          <CardTitle className="font-display text-xl">Client Portal</CardTitle>
          <CardDescription>Sign in to view your vintages and documents</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><Label>Password</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
          <Button onClick={handleLogin} disabled={submitting} className="w-full">
            {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}Sign In
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientLogin;
