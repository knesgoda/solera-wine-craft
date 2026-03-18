import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, CheckCircle2, Sparkles } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";

interface Props {
  vintageId: string;
}

export function AnomaliesTab({ vintageId }: Props) {
  const queryClient = useQueryClient();
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolveNotes, setResolveNotes] = useState("");

  const { data: anomalies = [], isLoading } = useQuery({
    queryKey: ["anomaly-flags", vintageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("anomaly_flags")
        .select("*")
        .eq("vintage_id", vintageId)
        .order("flagged_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const resolve = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const { error } = await supabase
        .from("anomaly_flags")
        .update({ resolved: true, notes: notes || null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["anomaly-flags", vintageId] });
      toast.success("Anomaly resolved");
      setResolvingId(null);
      setResolveNotes("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const unresolvedCount = anomalies.filter((a: any) => !a.resolved).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-foreground">Anomalies</h3>
          {unresolvedCount > 0 && (
            <Badge variant="destructive" className="text-xs">{unresolvedCount} unresolved</Badge>
          )}
        </div>
        <Badge variant="outline" className="text-[10px] gap-1">
          <Sparkles className="h-3 w-3" /> AI Detected
        </Badge>
      </div>

      {anomalies.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No anomalies detected for this vintage</p>
          </CardContent>
        </Card>
      )}

      {anomalies.map((a: any) => (
        <Card key={a.id} className={`border-l-4 ${a.resolved ? "border-l-green-500 opacity-60" : "border-l-destructive"}`}>
          <CardContent className="py-3 px-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  {a.resolved ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                  )}
                  <span className="font-medium text-foreground text-sm">{a.parameter}</span>
                  <Badge variant={a.resolved ? "secondary" : "destructive"} className="text-[10px]">
                    {a.resolved ? "Resolved" : "Active"}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground space-y-0.5 ml-6">
                  <p>Value: <span className="font-medium text-foreground">{a.value}</span>
                    {(a.expected_range_low != null || a.expected_range_high != null) && (
                      <span> (expected: {a.expected_range_low ?? "—"} – {a.expected_range_high ?? "—"})</span>
                    )}
                  </p>
                  <p>Flagged: {format(parseISO(a.flagged_at), "MMM d, yyyy h:mm a")}</p>
                  {a.notes && <p className="italic">Notes: {a.notes}</p>}
                </div>
              </div>

              {!a.resolved && (
                <div className="shrink-0">
                  {resolvingId === a.id ? (
                    <div className="space-y-2 w-48">
                      <Textarea
                        placeholder="Resolution notes..."
                        value={resolveNotes}
                        onChange={(e) => setResolveNotes(e.target.value)}
                        rows={2}
                        className="text-xs"
                      />
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setResolvingId(null)}>
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          className="text-xs h-7"
                          onClick={() => resolve.mutate({ id: a.id, notes: resolveNotes })}
                          disabled={resolve.isPending}
                        >
                          Resolve
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() => { setResolvingId(a.id); setResolveNotes(""); }}
                    >
                      Resolve
                    </Button>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
