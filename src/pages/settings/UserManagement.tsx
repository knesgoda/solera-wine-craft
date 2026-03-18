import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { UserPlus, Users, Ban } from "lucide-react";
import { TIER_LIMITS, getTierDisplay } from "@/hooks/useTierGate";
import { format } from "date-fns";
import { RoleGate } from "@/components/RoleGate";

const ROLE_OPTIONS = [
  { value: "owner", label: "Owner" },
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "cellar", label: "Cellar" },
  { value: "field", label: "Field" },
  { value: "member", label: "Member" },
];

const UserManagement = () => {
  const { organization, profile } = useAuth();
  const queryClient = useQueryClient();
  const orgId = organization?.id;
  const currentTier = organization?.tier || "hobbyist";
  const userLimit = TIER_LIMITS[currentTier]?.users || 1;
  const [open, setOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");

  const { data: users = [] } = useQuery({
    queryKey: ["org-users", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, first_name, last_name, role, last_active_at, created_at")
        .eq("org_id", orgId!)
        .order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const inviteUser = useMutation({
    mutationFn: async () => {
      if (users.length >= userLimit) throw new Error(`User limit reached (${userLimit} for ${getTierDisplay(currentTier)} plan)`);
      const { error } = await supabase.functions.invoke("invite-client", {
        body: { email: inviteEmail, role: inviteRole, org_id: orgId, type: "team_invite" },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Invite sent", description: `Invitation sent to ${inviteEmail}` });
      setOpen(false);
      setInviteEmail("");
      queryClient.invalidateQueries({ queryKey: ["org-users"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
      if (error) throw error;
      // Also update user_roles table
      await supabase.from("user_roles").upsert(
        { user_id: userId, role: role as any },
        { onConflict: "user_id,role" }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-users"] });
      toast({ title: "Role updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <RoleGate section="user-management">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">User Management</h1>
            <p className="text-muted-foreground">
              {users.length} of {userLimit === 999 ? "unlimited" : userLimit} users — {getTierDisplay(currentTier)} plan
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button disabled={users.length >= userLimit}>
                <UserPlus className="h-4 w-4 mr-2" />Invite User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display">Invite User</DialogTitle>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); inviteUser.mutate(); }} className="space-y-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required placeholder="user@example.com" />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.filter((r) => r.value !== "owner").map((r) => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full" disabled={inviteUser.isPending || !inviteEmail}>
                  {inviteUser.isPending ? "Sending…" : "Send Invite"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="border-none shadow-md">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Last Active</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u: any) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      {[u.first_name, u.last_name].filter(Boolean).join(" ") || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      {u.id === profile?.id ? (
                        <Badge variant="outline">{u.role || "member"}</Badge>
                      ) : (
                        <Select
                          value={u.role || "member"}
                          onValueChange={(role) => updateRole.mutate({ userId: u.id, role })}
                        >
                          <SelectTrigger className="w-[120px] h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLE_OPTIONS.map((r) => (
                              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {u.last_active_at ? format(new Date(u.last_active_at), "MMM d") : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(u.created_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      {u.id !== profile?.id && (
                        <Button variant="ghost" size="icon" title="Deactivate">
                          <Ban className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </RoleGate>
  );
};

export default UserManagement;
