import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TierGate } from "@/components/TierGate";
import { format } from "date-fns";
import { ScrollText } from "lucide-react";

const AuditLog = () => {
  const { organization } = useAuth();
  const orgId = organization?.id;

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["audit-logs", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("org_id", orgId!)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  return (
    <TierGate requiredTier="enterprise" featureName="Audit Log">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <ScrollText className="h-6 w-6" /> Audit Log
          </h1>
          <p className="text-muted-foreground">Track all actions across your organization.</p>
        </div>

        <Card className="border-none shadow-md">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Loading…</div>
            ) : logs.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No audit events recorded yet.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Record Type</TableHead>
                    <TableHead>Record ID</TableHead>
                    <TableHead>IP Address</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm whitespace-nowrap">
                        {format(new Date(log.created_at), "MMM d, h:mm a")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{log.action}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{log.record_type || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground font-mono">
                        {log.record_id ? log.record_id.slice(0, 8) : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{log.ip_address || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </TierGate>
  );
};

export default AuditLog;
