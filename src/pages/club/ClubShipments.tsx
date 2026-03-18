import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Truck, Loader2, CheckCircle, XCircle, Package } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const SHIPMENT_STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800", processing: "bg-yellow-100 text-yellow-800",
  billed: "bg-blue-100 text-blue-800", shipping: "bg-purple-100 text-purple-800",
  completed: "bg-green-100 text-green-800",
};

const ClubShipments = () => {
  const { organization } = useAuth();
  const orgId = organization?.id;
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processResults, setProcessResults] = useState<any>(null);
  const [selectedShipment, setSelectedShipment] = useState<any>(null);
  const [showFulfillment, setShowFulfillment] = useState(false);

  // New shipment form
  const [newClubId, setNewClubId] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [skuAllocations, setSkuAllocations] = useState<{ sku_id: string; qty_per_member: number }[]>([]);

  const { data: clubs = [] } = useQuery({
    queryKey: ["wine-clubs", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("wine_clubs").select("*").eq("org_id", orgId!).eq("active", true);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!orgId,
  });

  const { data: skus = [] } = useQuery({
    queryKey: ["inventory-skus-for-club", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("inventory_skus").select("id, label, cases, bottles_per_case").eq("org_id", orgId!).eq("active", true);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!orgId && showNew,
  });

  const { data: shipments = [] } = useQuery({
    queryKey: ["club-shipments", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("club_shipments")
        .select("*, wine_clubs:club_id(name)")
        .eq("org_id", orgId!)
        .order("shipment_date", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!orgId,
  });

  const { data: memberCount = 0 } = useQuery({
    queryKey: ["club-active-members", newClubId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("club_members")
        .select("*", { count: "exact", head: true })
        .eq("club_id", newClubId)
        .eq("status", "active");
      if (error) throw error;
      return count || 0;
    },
    enabled: !!newClubId,
  });

  const { data: shipmentMembers = [] } = useQuery({
    queryKey: ["shipment-members", selectedShipment?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("club_shipment_members")
        .select("*, club_members:member_id(customers:customer_id(first_name, last_name, email), shipping_address_json)")
        .eq("shipment_id", selectedShipment.id);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!selectedShipment?.id && showFulfillment,
  });

  const handleCreateShipment = async () => {
    if (!orgId || !newClubId || !newDate) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("club_shipments").insert({
        org_id: orgId,
        club_id: newClubId,
        shipment_date: newDate,
        sku_allocations_json: skuAllocations.length > 0 ? skuAllocations : null,
        notes: newNotes || null,
      });
      if (error) throw error;
      toast.success("Shipment created");
      qc.invalidateQueries({ queryKey: ["club-shipments"] });
      setShowNew(false);
      setNewClubId(""); setNewDate(""); setNewNotes(""); setSkuAllocations([]);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleProcess = async (shipmentId: string) => {
    setProcessing(true);
    setProcessResults(null);
    try {
      const { data, error } = await supabase.functions.invoke("process-club-shipment", {
        body: { shipment_id: shipmentId },
      });
      if (error) throw error;
      setProcessResults(data);
      toast.success(`Processed: ${data.billed} billed, ${data.failed} failed`);
      qc.invalidateQueries({ queryKey: ["club-shipments"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleAddTracking = async (smId: string, tracking: string) => {
    try {
      await supabase.from("club_shipment_members").update({
        tracking_number: tracking,
        shipped_at: new Date().toISOString(),
        status: "shipped" as any,
      }).eq("id", smId);
      toast.success("Tracking added");
      qc.invalidateQueries({ queryKey: ["shipment-members"] });

      // Check if all members shipped
      const { data: allMembers } = await supabase.from("club_shipment_members").select("status").eq("shipment_id", selectedShipment.id);
      if (allMembers?.every((m: any) => m.status === "shipped")) {
        await supabase.from("club_shipments").update({ status: "completed" as any, total_members_shipped: allMembers.length }).eq("id", selectedShipment.id);
        toast.success("All members shipped — shipment completed!");
        qc.invalidateQueries({ queryKey: ["club-shipments"] });
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const addSkuAllocation = () => {
    setSkuAllocations([...skuAllocations, { sku_id: "", qty_per_member: 1 }]);
  };

  const selectedClub = clubs.find((c: any) => c.id === newClubId);
  const estBottles = skuAllocations.reduce((s, a) => s + a.qty_per_member, 0) * memberCount;
  const estRevenue = memberCount * (selectedClub?.price_per_shipment || 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Club Shipments</h1>
          <p className="text-muted-foreground mt-1">{shipments.length} shipments</p>
        </div>
        <Button onClick={() => setShowNew(true)}><Plus className="h-4 w-4 mr-2" />New Shipment</Button>
      </div>

      {processResults && (
        <Card className="border-none shadow-md bg-muted/50">
          <CardContent className="py-4">
            <div className="flex gap-6 items-center">
              <div className="flex items-center gap-2"><CheckCircle className="h-5 w-5 text-green-600" /><span className="font-medium">{processResults.billed} billed</span></div>
              <div className="flex items-center gap-2"><XCircle className="h-5 w-5 text-red-600" /><span className="font-medium">{processResults.failed} failed</span></div>
              <div className="font-bold">${processResults.total_revenue?.toLocaleString()} collected</div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-none shadow-md">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Club</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Billed</TableHead>
                <TableHead>Shipped</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shipments.map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell>{format(new Date(s.shipment_date), "MMM d, yyyy")}</TableCell>
                  <TableCell className="font-medium">{s.wine_clubs?.name}</TableCell>
                  <TableCell><Badge className={SHIPMENT_STATUS_COLORS[s.status] || ""}>{s.status}</Badge></TableCell>
                  <TableCell>{s.total_members_billed}</TableCell>
                  <TableCell>{s.total_members_shipped}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {s.status === "draft" && (
                        <Button size="sm" onClick={() => handleProcess(s.id)} disabled={processing}>
                          {processing ? <Loader2 className="h-3 w-3 animate-spin" /> : "Process"}
                        </Button>
                      )}
                      {(s.status === "billed" || s.status === "shipping") && (
                        <Button size="sm" variant="outline" onClick={() => { setSelectedShipment(s); setShowFulfillment(true); }}>
                          <Truck className="h-3 w-3 mr-1" />Fulfill
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {shipments.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground"><Package className="h-8 w-8 mx-auto mb-2 opacity-50" />No shipments yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* New Shipment Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display">New Shipment</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Club</Label>
              <Select value={newClubId} onValueChange={setNewClubId}>
                <SelectTrigger><SelectValue placeholder="Select club..." /></SelectTrigger>
                <SelectContent>
                  {clubs.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Shipment Date</Label><Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} /></div>

            {newClubId && (
              <Card className="bg-muted/50 border-none">
                <CardContent className="py-3 text-sm space-y-1">
                  <p><span className="text-muted-foreground">Active members:</span> {memberCount}</p>
                  <p><span className="text-muted-foreground">Est. bottles needed:</span> {estBottles}</p>
                  <p><span className="text-muted-foreground">Est. revenue:</span> ${estRevenue.toLocaleString()}</p>
                </CardContent>
              </Card>
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>SKU Allocations</Label>
                <Button variant="ghost" size="sm" onClick={addSkuAllocation}><Plus className="h-3 w-3 mr-1" />Add SKU</Button>
              </div>
              {skuAllocations.map((alloc, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <Select value={alloc.sku_id} onValueChange={(v) => { const a = [...skuAllocations]; a[i].sku_id = v; setSkuAllocations(a); }}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Select SKU..." /></SelectTrigger>
                    <SelectContent>
                      {skus.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.label} ({s.cases} cs)</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input type="number" className="w-20" value={alloc.qty_per_member} onChange={(e) => { const a = [...skuAllocations]; a[i].qty_per_member = parseInt(e.target.value) || 1; setSkuAllocations(a); }} />
                </div>
              ))}
            </div>

            <div><Label>Notes</Label><Textarea value={newNotes} onChange={(e) => setNewNotes(e.target.value)} rows={2} /></div>
            <Button onClick={handleCreateShipment} disabled={saving || !newClubId || !newDate} className="w-full">{saving ? "Creating..." : "Create Shipment"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Fulfillment Dialog */}
      <Dialog open={showFulfillment} onOpenChange={setShowFulfillment}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display">Fulfillment — {selectedShipment?.wine_clubs?.name}</DialogTitle></DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tracking</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shipmentMembers.map((sm: any) => {
                const addr = sm.club_members?.shipping_address_json as any;
                return (
                  <TableRow key={sm.id}>
                    <TableCell className="font-medium">{sm.club_members?.customers?.first_name} {sm.club_members?.customers?.last_name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {addr ? `${addr.line1}, ${addr.city} ${addr.state} ${addr.zip}` : "No address"}
                    </TableCell>
                    <TableCell><Badge variant={sm.status === "shipped" ? "default" : "secondary"}>{sm.status}</Badge></TableCell>
                    <TableCell>
                      {sm.status === "shipped" ? (
                        <span className="text-sm">{sm.tracking_number}</span>
                      ) : sm.status === "billed" ? (
                        <TrackingInput onSubmit={(t) => handleAddTracking(sm.id, t)} />
                      ) : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Small inline component for tracking input
const TrackingInput = ({ onSubmit }: { onSubmit: (tracking: string) => void }) => {
  const [val, setVal] = useState("");
  return (
    <div className="flex gap-1">
      <Input value={val} onChange={(e) => setVal(e.target.value)} placeholder="Tracking #" className="h-7 text-xs w-32" />
      <Button size="sm" className="h-7 px-2 text-xs" onClick={() => val && onSubmit(val)} disabled={!val}>Add</Button>
    </div>
  );
};

export default ClubShipments;
