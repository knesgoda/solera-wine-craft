import { useOutletContext, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Wine, FlaskConical, Activity } from "lucide-react";

export default function ClientDashboard() {
  const { clientUser } = useOutletContext<{ clientUser: any }>();
  const navigate = useNavigate();
  const clientOrgId = clientUser?.client_org_id;

  const { data: vintages = [] } = useQuery({
    queryKey: ["client-my-vintages", clientOrgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("vintages").select("*, blocks(name)").eq("client_org_id", clientOrgId).order("year", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!clientOrgId,
  });

  // Fetch latest lab sample for each vintage
  const { data: latestLabs = {} } = useQuery({
    queryKey: ["client-latest-labs", vintages.map((v: any) => v.id)],
    queryFn: async () => {
      const labs: Record<string, any> = {};
      for (const v of vintages) {
        const { data } = await supabase.from("lab_samples").select("brix, ph, so2_free, sampled_at").eq("vintage_id", v.id).order("sampled_at", { ascending: false }).limit(1).single();
        if (data) labs[v.id] = data;
      }
      return labs;
    },
    enabled: vintages.length > 0,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Welcome, {clientUser?.first_name || "Client"}</h1>
        <p className="text-muted-foreground">Overview of your vintages at the facility.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-none shadow-md"><CardContent className="p-4 flex items-center gap-3"><Wine className="h-8 w-8 text-primary" /><div><p className="text-2xl font-bold">{vintages.length}</p><p className="text-sm text-muted-foreground">Total Vintages</p></div></CardContent></Card>
        <Card className="border-none shadow-md"><CardContent className="p-4 flex items-center gap-3"><Activity className="h-8 w-8 text-primary" /><div><p className="text-2xl font-bold">{vintages.filter((v: any) => ["in_progress", "in_cellar"].includes(v.status)).length}</p><p className="text-sm text-muted-foreground">Active</p></div></CardContent></Card>
        <Card className="border-none shadow-md"><CardContent className="p-4 flex items-center gap-3"><FlaskConical className="h-8 w-8 text-primary" /><div><p className="text-2xl font-bold">{Object.keys(latestLabs).length}</p><p className="text-sm text-muted-foreground">With Lab Data</p></div></CardContent></Card>
      </div>

      <Card className="border-none shadow-md">
        <CardHeader><CardTitle className="font-display">My Vintages</CardTitle></CardHeader>
        <CardContent className="p-0">
          {vintages.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No vintages assigned to you yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Year</TableHead>
                  <TableHead>Block</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Brix</TableHead>
                  <TableHead>pH</TableHead>
                  <TableHead>Free SO₂</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vintages.map((v: any) => {
                  const lab = latestLabs[v.id];
                  return (
                    <TableRow key={v.id} className="cursor-pointer" onClick={() => navigate(`/client/vintages/${v.id}`)}>
                      <TableCell className="font-medium">{v.year}</TableCell>
                      <TableCell>{v.blocks?.name || "—"}</TableCell>
                      <TableCell><Badge variant="secondary" className="capitalize">{v.status}</Badge></TableCell>
                      <TableCell>{lab?.brix ?? "—"}</TableCell>
                      <TableCell>{lab?.ph ?? "—"}</TableCell>
                      <TableCell>{lab?.so2_free ?? "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
