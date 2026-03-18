import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Filter, Loader2, Wine, FolderPlus } from "lucide-react";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";

const BARREL_TYPES = ["French Oak", "American Oak", "Hungarian Oak", "Other"];
const TOAST_LEVELS = ["Light", "Medium", "Heavy", "None"];
const BARREL_STATUSES = ["Full", "Partial", "Empty", "In Use"];

export default function BarrelInventory() {
  const { organization } = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const [addOpen, setAddOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterVariety, setFilterVariety] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({
    barrel_id: "", type: "", cooperage: "", toast: "", size_liters: "",
    variety: "", status: "Empty", fill_date: "", empty_date: "", barrel_group_id: "",
  });
  const [groupName, setGroupName] = useState("");

  const { data: barrels = [], isLoading } = useQuery({
    queryKey: ["barrels", organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("barrels")
        .select("*, vintages(year), barrel_groups(name)")
        .eq("org_id", organization!.id)
        .order("barrel_id");
      if (error) throw error;
      return data as any[];
    },
    enabled: !!organization?.id,
  });

  const { data: groups = [] } = useQuery({
    queryKey: ["barrel-groups", organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("barrel_groups")
        .select("*")
        .eq("org_id", organization!.id)
        .order("name");
      if (error) throw error;
      return data as any[];
    },
    enabled: !!organization?.id,
  });

  const { data: vintages = [] } = useQuery({
    queryKey: ["vintages-list", organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vintages").select("id, year").eq("org_id", organization!.id).order("year", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!organization?.id,
  });

  const saveBarrel = useMutation({
    mutationFn: async () => {
      const payload: any = {
        org_id: organization!.id,
        barrel_id: form.barrel_id || null,
        type: form.type || null,
        cooperage: form.cooperage || null,
        toast: form.toast || null,
        size_liters: form.size_liters ? parseFloat(form.size_liters) : null,
        variety: form.variety || null,
        status: form.status || "Empty",
        fill_date: form.fill_date || null,
        empty_date: form.empty_date || null,
        barrel_group_id: form.barrel_group_id || null,
      };
      if (editingId) {
        const { error } = await supabase.from("barrels").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("barrels").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["barrels"] });
      toast.success(editingId ? "Barrel updated" : "Barrel added");
      resetForm();
      setAddOpen(false);
      setEditingId(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const createGroup = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("barrel_groups").insert({
        org_id: organization!.id, name: groupName,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["barrel-groups"] });
      toast.success("Group created");
      setGroupName("");
      setGroupOpen(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const resetForm = () => {
    setForm({ barrel_id: "", type: "", cooperage: "", toast: "", size_liters: "", variety: "", status: "Empty", fill_date: "", empty_date: "", barrel_group_id: "" });
  };

  const startEdit = (b: any) => {
    setForm({
      barrel_id: b.barrel_id || "", type: b.type || "", cooperage: b.cooperage || "",
      toast: b.toast || "", size_liters: b.size_liters?.toString() || "", variety: b.variety || "",
      status: b.status || "Empty", fill_date: b.fill_date || "", empty_date: b.empty_date || "",
      barrel_group_id: b.barrel_group_id || "",
    });
    setEditingId(b.id);
    setAddOpen(true);
  };

  const filtered = barrels.filter((b: any) => {
    if (filterStatus !== "all" && b.status !== filterStatus) return false;
    if (filterVariety && !(b.variety || "").toLowerCase().includes(filterVariety.toLowerCase())) return false;
    return true;
  });

  const statusColor = (s: string) => {
    switch (s) {
      case "Full": return "bg-primary/10 text-primary";
      case "Partial": return "bg-secondary/20 text-secondary";
      case "In Use": return "bg-blue-100 text-blue-800";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const barrelFormContent = (
    <div className="space-y-4 mt-2">
      <div><Label>Barrel ID *</Label><Input value={form.barrel_id} onChange={(e) => setForm({ ...form, barrel_id: e.target.value })} placeholder="e.g. FR-001" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Type</Label>
          <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
            <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
            <SelectContent>{BARREL_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Cooperage</Label><Input value={form.cooperage} onChange={(e) => setForm({ ...form, cooperage: e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Toast</Label>
          <Select value={form.toast} onValueChange={(v) => setForm({ ...form, toast: v })}>
            <SelectTrigger><SelectValue placeholder="Select toast" /></SelectTrigger>
            <SelectContent>{TOAST_LEVELS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Size (L)</Label><Input type="number" value={form.size_liters} onChange={(e) => setForm({ ...form, size_liters: e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Variety</Label><Input value={form.variety} onChange={(e) => setForm({ ...form, variety: e.target.value })} /></div>
        <div>
          <Label>Status</Label>
          <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{BARREL_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Fill Date</Label><Input type="date" value={form.fill_date} onChange={(e) => setForm({ ...form, fill_date: e.target.value })} /></div>
        <div><Label>Empty Date</Label><Input type="date" value={form.empty_date} onChange={(e) => setForm({ ...form, empty_date: e.target.value })} /></div>
      </div>
      <div>
        <Label>Barrel Group</Label>
        <Select value={form.barrel_group_id} onValueChange={(v) => setForm({ ...form, barrel_group_id: v })}>
          <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {groups.map((g: any) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <Button className="w-full min-h-[44px]" onClick={() => saveBarrel.mutate()} disabled={!form.barrel_id.trim() || saveBarrel.isPending}>
        {saveBarrel.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        {editingId ? "Update Barrel" : "Add Barrel"}
      </Button>
    </div>
  );

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto pb-24 md:pb-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-foreground">Barrel Inventory</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setGroupOpen(true)}>
            <FolderPlus className="h-4 w-4 mr-2" /> New Group
          </Button>
          <Button onClick={() => { resetForm(); setEditingId(null); setAddOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Add Barrel
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {BARREL_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Input
          placeholder="Filter by variety..."
          value={filterVariety}
          onChange={(e) => setFilterVariety(e.target.value)}
          className="w-[180px]"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed border-2 border-border">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-4 rounded-full bg-muted mb-4"><Wine className="h-10 w-10 text-muted-foreground" /></div>
            <h3 className="text-lg font-semibold mb-2">No barrels found</h3>
            <p className="text-muted-foreground mb-4">
              {barrels.length === 0 ? "Add your first barrel to get started" : "No barrels match your filters"}
            </p>
            {barrels.length === 0 && (
              <Button onClick={() => { resetForm(); setEditingId(null); setAddOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" /> Add Barrel
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Barrel ID</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="hidden sm:table-cell">Cooperage</TableHead>
                <TableHead className="hidden sm:table-cell">Toast</TableHead>
                <TableHead className="hidden md:table-cell">Size</TableHead>
                <TableHead className="hidden md:table-cell">Variety</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden lg:table-cell">Group</TableHead>
                <TableHead className="hidden lg:table-cell">Fill Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((b: any) => (
                <TableRow key={b.id} className="cursor-pointer hover:bg-muted/50" onClick={() => startEdit(b)}>
                  <TableCell className="font-medium">{b.barrel_id || "—"}</TableCell>
                  <TableCell>{b.type || "—"}</TableCell>
                  <TableCell className="hidden sm:table-cell">{b.cooperage || "—"}</TableCell>
                  <TableCell className="hidden sm:table-cell">{b.toast || "—"}</TableCell>
                  <TableCell className="hidden md:table-cell">{b.size_liters ? `${b.size_liters}L` : "—"}</TableCell>
                  <TableCell className="hidden md:table-cell">{b.variety || "—"}</TableCell>
                  <TableCell><Badge className={statusColor(b.status || "Empty")} variant="secondary">{b.status || "Empty"}</Badge></TableCell>
                  <TableCell className="hidden lg:table-cell">{b.barrel_groups?.name || "—"}</TableCell>
                  <TableCell className="hidden lg:table-cell">{b.fill_date || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add/Edit Barrel Dialog */}
      {isMobile ? (
        <Sheet open={addOpen} onOpenChange={setAddOpen}>
          <SheetContent side="bottom" className="pb-safe max-h-[90vh] overflow-y-auto">
            <SheetHeader><SheetTitle>{editingId ? "Edit Barrel" : "Add Barrel"}</SheetTitle></SheetHeader>
            {barrelFormContent}
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editingId ? "Edit Barrel" : "Add Barrel"}</DialogTitle></DialogHeader>
            {barrelFormContent}
          </DialogContent>
        </Dialog>
      )}

      {/* New Group Dialog */}
      <Dialog open={groupOpen} onOpenChange={setGroupOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Barrel Group</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div><Label>Group Name *</Label><Input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="e.g. Lot A Barrels" /></div>
            <Button className="w-full min-h-[44px]" onClick={() => createGroup.mutate()} disabled={!groupName.trim() || createGroup.isPending}>
              {createGroup.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Create Group
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
