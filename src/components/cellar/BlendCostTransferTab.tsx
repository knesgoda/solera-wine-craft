import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Loader2, DollarSign, Undo2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { reverseBlendCosts } from "@/lib/blendCostPropagation";
import { toast } from "sonner";

interface BlendCostTransferTabProps {
  trialId: string;
  targetVintageId: string | null;
}

export function BlendCostTransferTab({ trialId, targetVintageId }: BlendCostTransferTabProps) {
  const { profile, organization } = useAuth();
  const queryClient = useQueryClient();
  const [reverseDialogOpen, setReverseDialogOpen] = useState(false);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["blend-cost-transfers", trialId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cost_entries")
        .select("*, cost_categories(name, color), vintages!cost_entries_source_vintage_id_fkey(year, blocks(name))")
        .eq("blend_trial_id", trialId)
        .order("source_vintage_id")
        .order("effective_date", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!trialId,
  });

  const activeEntries = entries.filter((e: any) => e.status === "active");
  const totalActive = activeEntries.reduce((s: number, e: any) => s + Number(e.total_amount), 0);

  // Group by source vintage
  const grouped = (activeEntries as any[]).reduce((acc: Record<string, any[]>, e: any) => {
    const key = e.source_vintage_id || "unknown";
    if (!acc[key]) acc[key] = [];
    acc[key].push(e);
    return acc;
  }, {});

  const reverseMutation = useMutation({
    mutationFn: async () => {
      if (!targetVintageId || !profile?.id || !organization?.id) throw new Error("Missing context");
      return reverseBlendCosts(trialId, targetVintageId, profile.id, organization.id);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["blend-cost-transfers"] });
      queryClient.invalidateQueries({ queryKey: ["cost-entries"] });
      queryClient.invalidateQueries({ queryKey: ["lot-cost-summary"] });
      queryClient.invalidateQueries({ queryKey: ["vintage-costs"] });
      queryClient.invalidateQueries({ queryKey: ["cost-summary-ytd"] });
      toast.success(`Reversed ${result.voidedCount} cost entries ($${result.voidedAmount.toFixed(2)})`);
      setReverseDialogOpen(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-8">
        <DollarSign className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No costs have been transferred for this blend yet.</p>
        <p className="text-xs text-muted-foreground mt-1">Costs are transferred when the blend is finalized.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            {activeEntries.length} cost entries transferred • {Object.keys(grouped).length} source lot{Object.keys(grouped).length !== 1 ? "s" : ""}
          </p>
          <p className="text-lg font-bold text-foreground">{fmt(totalActive)}</p>
        </div>
        {activeEntries.length > 0 && (
          <Button variant="outline" size="sm" className="text-destructive" onClick={() => setReverseDialogOpen(true)}>
            <Undo2 className="h-4 w-4 mr-2" /> Reverse Cost Transfer
          </Button>
        )}
      </div>

      {/* Grouped by source */}
      {Object.entries(grouped).map(([vintageId, groupEntries]: [string, any[]]) => {
        const sourceName = groupEntries[0]?.vintages?.year
          ? `${groupEntries[0].vintages.year} ${groupEntries[0].vintages.blocks?.name || ""}`.trim()
          : "Unknown Source";
        const groupTotal = groupEntries.reduce((s: number, e: any) => s + Number(e.total_amount), 0);
        const ratio = groupEntries[0]?.transfer_ratio;

        return (
          <Card key={vintageId}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  {sourceName}
                  {ratio && <Badge variant="outline" className="ml-2 text-xs">{(ratio * 100).toFixed(0)}% of blend</Badge>}
                </CardTitle>
                <span className="font-mono font-medium text-sm">{fmt(groupTotal)}</span>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupEntries.map((e: any) => (
                    <TableRow key={e.id} className={e.status === "voided" ? "opacity-50" : ""}>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5 text-sm">
                          {e.cost_categories?.color && <span className="h-2 w-2 rounded-full" style={{ background: e.cost_categories.color }} />}
                          {e.cost_categories?.name}
                        </span>
                      </TableCell>
                      <TableCell className={cn("text-sm max-w-[200px] truncate", e.status === "voided" && "line-through")}>
                        {e.description}
                      </TableCell>
                      <TableCell className={cn("text-right font-mono text-sm", e.status === "voided" && "line-through")}>
                        {fmt(Number(e.total_amount))}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("text-xs capitalize",
                          e.status === "active" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" :
                          "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                        )}>{e.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}

      {/* Voided entries (if any) */}
      {entries.some((e: any) => e.status === "voided") && (
        <p className="text-xs text-muted-foreground text-center">
          {entries.filter((e: any) => e.status === "voided").length} voided entries not shown in totals
        </p>
      )}

      {/* Reverse dialog */}
      <AlertDialog open={reverseDialogOpen} onOpenChange={setReverseDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reverse Cost Transfer?</AlertDialogTitle>
            <AlertDialogDescription>
              This will void all {activeEntries.length} cost entries transferred by this blend. The target lot's COGS will decrease by {fmt(totalActive)}. Source lot costs are not affected. This does NOT undo the physical blend.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={reverseMutation.isPending}
              onClick={() => reverseMutation.mutate()}
            >
              {reverseMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Reverse Costs
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
