import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Scale, Plus } from "lucide-react";
import { SEOHead } from "@/components/SEOHead";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  graded: "bg-blue-100 text-blue-800",
  approved: "bg-green-100 text-green-800",
  disputed: "bg-destructive/10 text-destructive",
  paid: "bg-purple-100 text-purple-800",
};

export default function GrowerIntake() {
  const { organization } = useAuth();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState("all");
  const [growerFilter, setGrowerFilter] = useState("all");
  const [contractFilter, setContractFilter] = useState("all");
  const [blockFilter, setBlockFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: growers = [] } = useQuery({
    queryKey: ["growers-dropdown", organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("growers").select("id, name").eq("org_id", organization!.id).order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!organization?.id,
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ["contracts-dropdown", organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("grower_contracts").select("id, contract_number").eq("org_id", organization!.id).order("contract_number");
      if (error) throw error;
      return data;
    },
    enabled: !!organization?.id,
  });

  const { data: blocks = [] } = useQuery({
    queryKey: ["blocks-dropdown-intake", organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("blocks").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!organization?.id,
  });

  const { data: weighTags = [], isLoading } = useQuery({
    queryKey: ["weigh-tags-all", organization?.id, statusFilter, growerFilter, contractFilter, blockFilter, dateFrom, dateTo],
    queryFn: async () => {
      let query = supabase
        .from("weigh_tags")
        .select("*, growers(name), grower_contracts(contract_number), blocks(name)")
        .eq("org_id", organization!.id)
        .order("delivery_date", { ascending: false });

      if (statusFilter !== "all") query = query.eq("status", statusFilter as any);
      if (growerFilter !== "all") query = query.eq("grower_id", growerFilter);
      if (contractFilter !== "all") query = query.eq("contract_id", contractFilter);
      if (blockFilter !== "all") query = query.eq("block_id", blockFilter);
      if (dateFrom) query = query.gte("delivery_date", dateFrom);
      if (dateTo) query = query.lte("delivery_date", dateTo);

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!organization?.id,
  });

  return (
    <div className="space-y-6">
      <SEOHead title="Harvest Intake | Solera" description="Weigh tags and harvest intake" />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Harvest Intake</h1>
          <p className="text-sm text-muted-foreground">Weigh tags and fruit grading history</p>
        </div>
        <Button onClick={() => navigate("/growers/intake/new")}>
          <Plus className="mr-2 h-4 w-4" /> Record Delivery
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row flex-wrap gap-3">
        <div className="flex gap-2 items-end">
          <div>
            <Label className="text-xs">From</Label>
            <Input type="date" className="w-36 h-9" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">To</Label>
            <Input type="date" className="w-36 h-9" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>
        <Select value={growerFilter} onValueChange={setGrowerFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Grower" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Growers</SelectItem>
            {growers.map((g: any) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={contractFilter} onValueChange={setContractFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Contract" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Contracts</SelectItem>
            {contracts.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.contract_number}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="graded">Graded</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="disputed">Disputed</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
          </SelectContent>
        </Select>
        <Select value={blockFilter} onValueChange={setBlockFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Block" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Blocks</SelectItem>
            {blocks.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : weighTags.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-border rounded-lg">
          <Scale className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No deliveries recorded</h3>
          <p className="text-muted-foreground text-sm max-w-md mb-6">
            Record your first fruit delivery to start tracking harvest intake.
          </p>
          <Button onClick={() => navigate("/growers/intake/new")}>
            <Plus className="mr-2 h-4 w-4" /> Record Delivery
          </Button>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tag #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Grower</TableHead>
                <TableHead className="hidden sm:table-cell">Contract</TableHead>
                <TableHead className="hidden sm:table-cell">Block</TableHead>
                <TableHead className="text-right">Net Tons</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right hidden sm:table-cell">Final $/Ton</TableHead>
                <TableHead className="text-right">Total Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {weighTags.map((wt: any) => (
                <TableRow key={wt.id} className="cursor-pointer" onClick={() => navigate(`/growers/intake/${wt.id}`)}>
                  <TableCell className="font-medium">{wt.tag_number}</TableCell>
                  <TableCell>{wt.delivery_date}</TableCell>
                  <TableCell>{wt.growers?.name || "—"}</TableCell>
                  <TableCell className="hidden sm:table-cell">{wt.grower_contracts?.contract_number || "—"}</TableCell>
                  <TableCell className="hidden sm:table-cell">{wt.blocks?.name || "—"}</TableCell>
                  <TableCell className="text-right">{wt.net_tons != null ? Number(wt.net_tons).toFixed(2) : "—"}</TableCell>
                  <TableCell><Badge variant="secondary" className={STATUS_COLORS[wt.status] || ""}>{wt.status}</Badge></TableCell>
                  <TableCell className="text-right hidden sm:table-cell">
                    {wt.final_price_per_unit != null ? `$${Number(wt.final_price_per_unit).toLocaleString()}` : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {wt.total_value != null ? `$${Number(wt.total_value).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
