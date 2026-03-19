import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { ChevronDown, CheckCircle2, XCircle, AlertCircle, Clock, Wifi } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Props {
  api: (action: string, payload?: any) => Promise<any>;
}

const STATUS_BADGES: Record<string, { bg: string; text: string }> = {
  operational: { bg: "#22c55e", text: "Operational" },
  degraded: { bg: "#eab308", text: "Degraded" },
  down: { bg: "#ef4444", text: "Down" },
};

export function OperationsTab({ api }: Props) {
  const queryClient = useQueryClient();
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-operations"],
    queryFn: () => api("operations-data"),
  });

  const updateStatusMutation = useMutation({
    mutationFn: (payload: any) => api("admin-system-status-update", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-operations"] });
      toast.success("Status updated");
    },
  });

  const errorJobs = data?.errorJobs || [];
  const systemStatus = data?.systemStatus || [];
  const offlineSyncFailures = data?.offlineSyncFailures || [];

  return (
    <div className="space-y-8">
      {/* Import Error Queue */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: "#6B1B2A" }}>
          Import Error Queue
        </h2>
        <Card className="bg-white shadow-sm">
          <CardContent className="p-0">
            {isLoading ? <Skeleton className="h-48 w-full m-4" /> : errorJobs.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-600" />
                No import errors
              </div>
            ) : (
              <div>
                {errorJobs.map((job: any) => (
                  <Collapsible key={job.id} open={expandedJob === job.id} onOpenChange={(open) => setExpandedJob(open ? job.id : null)}>
                    <CollapsibleTrigger className="w-full flex items-center justify-between p-4 hover:bg-muted/30 border-b text-left">
                      <div className="flex items-center gap-3">
                        <XCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
                        <div>
                          <span className="font-medium text-sm">{job.orgName}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {job.source_type} · {new Date(job.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="destructive">{job.error_rows || job.errors?.length || 0} errors</Badge>
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-4 pb-4 bg-muted/10">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Row</TableHead>
                              <TableHead>Error</TableHead>
                              <TableHead>Data</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(job.errors || []).slice(0, 10).map((err: any) => (
                              <TableRow key={err.id}>
                                <TableCell>{err.row_number}</TableCell>
                                <TableCell className="text-xs text-red-700">{err.error_message}</TableCell>
                                <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                                  {err.source_data ? JSON.stringify(err.source_data).slice(0, 80) : "—"}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Offline Sync Failures */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: "#6B1B2A" }}>
          Offline Sync Failures
        </h2>
        <Card className="bg-white shadow-sm">
          <CardContent className="p-0">
            {isLoading ? <Skeleton className="h-32 w-full m-4" /> : offlineSyncFailures.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Wifi className="h-8 w-8 mx-auto mb-2 text-green-600" />
                No stale offline records
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Org</TableHead>
                    <TableHead>Record Type</TableHead>
                    <TableHead>Record ID</TableHead>
                    <TableHead>Queued At</TableHead>
                    <TableHead>Age</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {offlineSyncFailures.map((item: any) => (
                    <TableRow key={`${item.type}-${item.id}`}>
                      <TableCell className="font-medium">{item.orgName}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{item.type.replace("_", " ")}</Badge>
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">{item.id.slice(0, 8)}…</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(item.queuedAt).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          <Clock className="h-3 w-3 mr-1" />
                          {formatDistanceToNow(new Date(item.queuedAt), { addSuffix: false })}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </section>

      {/* System Health */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: "#6B1B2A" }}>
          System Health
        </h2>
        <div className="grid gap-3">
          {isLoading ? (
            [1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg" />)
          ) : (
            systemStatus.map((svc: any) => {
              const statusInfo = STATUS_BADGES[svc.status] || STATUS_BADGES.operational;
              return (
                <Card key={svc.id} className="bg-white shadow-sm">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {svc.status === "operational" ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : svc.status === "degraded" ? (
                        <AlertCircle className="h-5 w-5 text-yellow-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-600" />
                      )}
                      <div>
                        <p className="font-medium">{svc.service}</p>
                        {svc.notes && <p className="text-xs text-muted-foreground">{svc.notes}</p>}
                        <p className="text-xs text-muted-foreground">
                          Updated: {new Date(svc.updated_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select
                        value={svc.status}
                        onValueChange={(v) => updateStatusMutation.mutate({ id: svc.id, status: v, notes: svc.notes })}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="operational">Operational</SelectItem>
                          <SelectItem value="degraded">Degraded</SelectItem>
                          <SelectItem value="down">Down</SelectItem>
                        </SelectContent>
                      </Select>
                      <Badge style={{ background: statusInfo.bg, color: "#fff", border: "none" }}>
                        {statusInfo.text}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
