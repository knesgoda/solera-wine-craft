import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Loader2, FileText } from "lucide-react";
import { SEOHead } from "@/components/SEOHead";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-green-100 text-green-800",
  fulfilled: "bg-blue-100 text-blue-800",
  cancelled: "bg-destructive/10 text-destructive",
  expired: "bg-amber-100 text-amber-800",
};

export default function GrowerContractList() {
  const { organization } = useAuth();
  const navigate = useNavigate();

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ["grower-contracts-all", organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grower_contracts")
        .select("*, growers(name)")
        .eq("org_id", organization!.id)
        .order("vintage_year", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!organization?.id,
  });

  return (
    <div className="space-y-6">
      <SEOHead title="Grower Contracts | Solera" description="Manage grape purchase contracts" />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Grower Contracts</h1>
          <p className="text-sm text-muted-foreground">All grape purchase agreements</p>
        </div>
        <Button onClick={() => navigate("/growers/contracts/new")}>
          <Plus className="mr-2 h-4 w-4" /> New Contract
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : contracts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-border rounded-lg">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No contracts yet</h3>
          <p className="text-muted-foreground text-sm mb-6 max-w-md">Create your first grape purchase contract.</p>
          <Button onClick={() => navigate("/growers/contracts/new")}><Plus className="mr-2 h-4 w-4" /> New Contract</Button>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contract #</TableHead>
                <TableHead>Grower</TableHead>
                <TableHead>Vintage</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Pricing</TableHead>
                <TableHead className="hidden sm:table-cell text-right">Base Price</TableHead>
                <TableHead className="text-right">Delivered Tons</TableHead>
                <TableHead className="text-right">Total Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contracts.map((c: any) => (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => navigate(`/growers/contracts/${c.id}`)}>
                  <TableCell className="font-medium">{c.contract_number || "—"}</TableCell>
                  <TableCell>{c.growers?.name || "—"}</TableCell>
                  <TableCell>{c.vintage_year}</TableCell>
                  <TableCell><Badge variant="secondary" className={STATUS_COLORS[c.status] || ""}>{c.status}</Badge></TableCell>
                  <TableCell className="hidden sm:table-cell">{c.pricing_unit === "per_ton" ? "Per Ton" : "Per Acre"}</TableCell>
                  <TableCell className="hidden sm:table-cell text-right">${Number(c.base_price_per_unit).toLocaleString()}</TableCell>
                  <TableCell className="text-right">{Number(c.total_delivered_tons).toFixed(2)}</TableCell>
                  <TableCell className="text-right">${Number(c.total_contract_value).toLocaleString("en-US", { minimumFractionDigits: 2 })}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
