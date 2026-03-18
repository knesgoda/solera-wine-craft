import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface SyncLogsTableProps {
  integration: string;
}

export function SyncLogsTable({ integration }: SyncLogsTableProps) {
  const { profile } = useAuth();
  const orgId = profile?.org_id;

  const { data: logs } = useQuery({
    queryKey: ["sync-logs", integration, orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integration_sync_logs")
        .select("*")
        .eq("org_id", orgId!)
        .eq("integration", integration)
        .order("synced_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  if (!logs?.length) return <p className="text-sm text-muted-foreground py-4">No sync events yet.</p>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Records</TableHead>
          <TableHead>Errors</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {logs.map((log) => (
          <TableRow key={log.id}>
            <TableCell className="text-sm">{format(new Date(log.synced_at), "MMM d, h:mm a")}</TableCell>
            <TableCell className="text-sm capitalize">{log.sync_type}</TableCell>
            <TableCell className="text-sm">{log.records_synced}</TableCell>
            <TableCell className="text-sm">{log.errors}</TableCell>
            <TableCell>
              <Badge variant={log.status === "success" ? "default" : "destructive"}>
                {log.status}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
