import { useOutletContext, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function ClientVintages() {
  const { clientUser } = useOutletContext<{ clientUser: any }>();
  const navigate = useNavigate();

  const { data: vintages = [] } = useQuery({
    queryKey: ["client-vintages-list", clientUser?.client_org_id],
    queryFn: async () => {
      const { data, error } = await supabase.from("vintages").select("*, blocks(name)").eq("client_org_id", clientUser.client_org_id).order("year", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!clientUser?.client_org_id,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-display font-bold text-foreground">My Vintages</h1>
      <Card className="border-none shadow-md">
        <CardContent className="p-0">
          {vintages.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No vintages assigned yet.</div>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Year</TableHead><TableHead>Block</TableHead><TableHead>Status</TableHead><TableHead>Harvest Date</TableHead></TableRow></TableHeader>
              <TableBody>
                {vintages.map((v: any) => (
                  <TableRow key={v.id} className="cursor-pointer" onClick={() => navigate(`/client/vintages/${v.id}`)}>
                    <TableCell className="font-medium">{v.year}</TableCell>
                    <TableCell>{v.blocks?.name || "—"}</TableCell>
                    <TableCell><Badge variant="secondary" className="capitalize">{v.status}</Badge></TableCell>
                    <TableCell className="text-sm">{v.harvest_date || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
