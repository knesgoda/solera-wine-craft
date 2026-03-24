import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, Scale } from "lucide-react";
import { SEOHead } from "@/components/SEOHead";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  graded: "bg-blue-100 text-blue-800",
  approved: "bg-green-100 text-green-800",
  disputed: "bg-destructive/10 text-destructive",
  paid: "bg-muted text-muted-foreground",
};

export default function GrowerIntake() {
  const { organization } = useAuth();

  const { data: weighTags = [], isLoading } = useQuery({
    queryKey: ["weigh-tags-all", organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weigh_tags")
        .select("*, growers(name), grower_contracts(contract_number), blocks(name)")
        .eq("org_id", organization!.id)
        .order("delivery_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!organization?.id,
  });

  return (
    <div className="space-y-6">
      <SEOHead title="Harvest Intake | Solera" description="Weigh tags and harvest intake" />
      <div>
        <h1 className="text-2xl font-display font-bold">Harvest Intake</h1>
        <p className="text-sm text-muted-foreground">Weigh tags and fruit grading history</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : weighTags.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-border rounded-lg">
          <Scale className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No weigh tags yet</h3>
          <p className="text-muted-foreground text-sm max-w-md">
            Weigh tags are created during harvest intake when fruit arrives at the winery.
          </p>
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
                <TableHead className="text-right hidden sm:table-cell">Final Price</TableHead>
                <TableHead className="text-right">Total Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {weighTags.map((wt: any) => (
                <TableRow key={wt.id}>
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
