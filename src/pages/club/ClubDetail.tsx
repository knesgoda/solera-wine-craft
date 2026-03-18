import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Plus, Users, Pause, XCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const FREQ_LABELS: Record<string, string> = {
  monthly: "Monthly", bimonthly: "Bimonthly", quarterly: "Quarterly",
  twice_yearly: "Twice Yearly", annual: "Annual",
};
const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800", paused: "bg-yellow-100 text-yellow-800",
  cancelled: "bg-gray-100 text-gray-800", payment_failed: "bg-red-100 text-red-800",
};

const ClubDetail = () => {
  const { clubId } = useParams();
  const navigate = useNavigate();
  const { organization } = useAuth();
  const orgId = organization?.id;
  const qc = useQueryClient();
  const [showAddMember, setShowAddMember] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: club, isLoading } = useQuery({
    queryKey: ["club-detail", clubId],
    queryFn: async () => {
      const { data, error } = await supabase.from("wine_clubs").select("*").eq("id", clubId!).single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!clubId,
  });

  const { data: members = [] } = useQuery({
    queryKey: ["club-members", clubId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("club_members")
        .select("*, customers:customer_id(email, first_name, last_name)")
        .eq("club_id", clubId!)
        .order("joined_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!clubId,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-for-club", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("id, email, first_name, last_name").eq("org_id", orgId!);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!orgId && showAddMember,
  });

  const handleAddMember = async () => {
    if (!orgId || !clubId || !selectedCustomerId) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("club_members").insert({
        org_id: orgId,
        club_id: clubId,
        customer_id: selectedCustomerId,
        status: "active" as any,
      });
      if (error) throw error;
      toast.success("Member added");
      qc.invalidateQueries({ queryKey: ["club-members", clubId] });
      setShowAddMember(false);
      setSelectedCustomerId("");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (memberId: string, newStatus: string) => {
    try {
      const update: any = { status: newStatus };
      if (newStatus === "cancelled") update.cancelled_at = new Date().toISOString();
      await supabase.from("club_members").update(update).eq("id", memberId);
      toast.success(`Member ${newStatus}`);
      qc.invalidateQueries({ queryKey: ["club-members", clubId] });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading...</div>;
  if (!club) return <div className="p-8 text-muted-foreground">Club not found</div>;

  const activeCount = members.filter((m: any) => m.status === "active").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/club")}><ArrowLeft className="h-5 w-5" /></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-display font-bold text-foreground">{club.name}</h1>
          <div className="flex gap-2 mt-1">
            <Badge variant={club.active ? "default" : "secondary"}>{club.active ? "Active" : "Inactive"}</Badge>
            <Badge variant="outline">{FREQ_LABELS[club.frequency]}</Badge>
          </div>
        </div>
        <Button onClick={() => setShowAddMember(true)}><Plus className="h-4 w-4 mr-2" />Add Member</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-none shadow-md">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Active Members</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold font-display">{activeCount}</p></CardContent>
        </Card>
        <Card className="border-none shadow-md">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Price/Shipment</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold font-display">${Number(club.price_per_shipment).toFixed(2)}</p></CardContent>
        </Card>
        <Card className="border-none shadow-md">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Est. Revenue/Shipment</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold font-display">${(activeCount * Number(club.price_per_shipment)).toLocaleString()}</p></CardContent>
        </Card>
      </div>

      {club.description && (
        <Card className="border-none shadow-md">
          <CardContent className="py-4"><p className="text-muted-foreground">{club.description}</p></CardContent>
        </Card>
      )}

      <Card className="border-none shadow-md">
        <CardHeader><CardTitle className="font-display">Members</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Next Shipment</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m: any) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.customers?.first_name} {m.customers?.last_name}</TableCell>
                  <TableCell className="text-muted-foreground">{m.customers?.email}</TableCell>
                  <TableCell><Badge className={STATUS_COLORS[m.status] || ""}>{m.status}</Badge></TableCell>
                  <TableCell>{format(new Date(m.joined_at), "MMM d, yyyy")}</TableCell>
                  <TableCell>{m.next_shipment_date ? format(new Date(m.next_shipment_date), "MMM d, yyyy") : "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {m.status === "active" && (
                        <>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleStatusChange(m.id, "paused")} title="Pause">
                            <Pause className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleStatusChange(m.id, "cancelled")} title="Cancel">
                            <XCircle className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                      {m.status === "paused" && (
                        <Button variant="ghost" size="sm" onClick={() => handleStatusChange(m.id, "active")}>Resume</Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {members.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground"><Users className="h-8 w-8 mx-auto mb-2 opacity-50" />No members yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showAddMember} onOpenChange={setShowAddMember}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Add Member</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Customer</Label>
              <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                <SelectTrigger><SelectValue placeholder="Select customer..." /></SelectTrigger>
                <SelectContent>
                  {customers.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name} ({c.email})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleAddMember} disabled={saving || !selectedCustomerId} className="w-full">{saving ? "Adding..." : "Add Member"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClubDetail;
