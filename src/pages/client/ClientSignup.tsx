import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import soleraLogo from "@/assets/solera-logo.png";

const ClientSignup = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  const [invite, setInvite] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ first_name: "", last_name: "", password: "", confirm_password: "" });

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    (async () => {
      const { data, error } = await supabase.from("client_invite_tokens").select("*, client_orgs(name, parent_org_id, organizations:parent_org_id(name))").eq("token", token).single();
      if (error || !data) { toast.error("Invalid invite link"); setLoading(false); return; }
      if (data.used) { toast.error("This invite has already been used"); setLoading(false); return; }
      if (new Date(data.expires_at) < new Date()) { toast.error("This invite has expired"); setLoading(false); return; }
      setInvite(data);
      setLoading(false);
    })();
  }, [token]);

  const handleSignup = async () => {
    if (form.password !== form.confirm_password) { toast.error("Passwords don't match"); return; }
    if (form.password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setSubmitting(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: invite.email,
        password: form.password,
        options: { data: { first_name: form.first_name, last_name: form.last_name } },
      });
      if (authError) throw authError;

      // Create client_users record via edge function (service role)
      const { error } = await supabase.functions.invoke("complete-client-signup", {
        body: {
          token,
          auth_user_id: authData.user?.id,
          first_name: form.first_name,
          last_name: form.last_name,
        },
      });
      if (error) throw error;

      toast.success("Account created! Please check your email to verify.");
      navigate("/client/login");
    } catch (e: any) { toast.error(e.message); }
    finally { setSubmitting(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-screen"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (!invite) return (
    <div className="flex items-center justify-center h-screen">
      <Card className="w-full max-w-md border-none shadow-lg">
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">Invalid or expired invite link.</p>
          <Button variant="link" onClick={() => navigate("/client/login")} className="mt-4">Go to Login</Button>
        </CardContent>
      </Card>
    </div>
  );

  const facilityName = (invite.client_orgs as any)?.organizations?.name || "Facility";

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md border-none shadow-lg">
        <CardHeader className="text-center">
          <img src={soleraLogo} alt="Solera" className="h-12 w-12 mx-auto mb-2" />
          <CardTitle className="font-display text-xl">Join {facilityName}</CardTitle>
          <CardDescription>Create your client portal account for {invite.client_orgs?.name}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><Label>First Name</Label><Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></div>
            <div><Label>Last Name</Label><Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></div>
          </div>
          <div><Label>Email</Label><Input value={invite.email} disabled /></div>
          <div><Label>Password</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
          <div><Label>Confirm Password</Label><Input type="password" value={form.confirm_password} onChange={(e) => setForm({ ...form, confirm_password: e.target.value })} /></div>
          <Button onClick={handleSignup} disabled={submitting} className="w-full">
            {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}Create Account
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientSignup;
