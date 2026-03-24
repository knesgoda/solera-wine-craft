import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Plus, Loader2, DollarSign, CalendarIcon, Eye, Ban, Pencil } from "lucide-react";
import { format, parseISO, startOfYear } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { SEOHead } from "@/components/SEOHead";
import { AddCostDialog } from "@/components/costs/AddCostDialog";

const STATUS_BADGE: Record<string, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  voided: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  transferred: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
};

const METHOD_LABELS: Record<string, string> = {
  apportioned: "Apportioned",
  transactional: "Transactional",
  ad_hoc: "Ad Hoc",
};

export default function CostOverview() {
  const { profile } = useAuth();
  const orgId = profile?.org_id;
  const queryClient = useQueryClient();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("active");
  const [methodFilter, setMethodFilter] = useState("all");
  const [vintageFilter, setVintageFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [voidingEntry, setVoidingEntry] = useState<any>(null);
  const [voidReason, setVoidReason] = useState("");
  const pageSize = 50;

  const { data: summaryData } = useQuery({
    queryKey: ["cost-summary-ytd", orgId],
    queryFn: async () => {
      const yearStart = format(startOfYear(new Date()), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("cost_entries")
        .select("total_amount, category_id, cost_categories(name)")
        .eq("org_id", orgId!)
        .eq("status", "active")
        .gte("effective_date", yearStart);
      if (error) throw error;

      let total = 0, grape = 0, nonGrape = 0;
      const vintageIds = new Set<string>();
      for (const e of data as any[]) {
        total += Number(e.total_amount);
        if (e.cost_categories?.name === "Grape Purchase") grape += Number(e.total_amount);
        else nonGrape += Number(e.total_amount);
      }

      const { count } = await supabase
        .from("cost_entries")
        .select("vintage_id", { count: "exact", head: true })
        .eq("org_id", orgId!)
        .eq("status", "active");

      return { total, grape, nonGrape, activeLots: count || 0 };
    },
    enabled: !!orgId,
  });

  const { data: vintages = [] } = useQuery({
    queryKey: ["vintages-list", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vintages")
        .select("id, year, blocks(name)")
        .eq("org_id", orgId!)
        .order("year", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!orgId,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["cost-categories", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cost_categories")
        .select("*")
        .eq("org_id", orgId!)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const { data: entriesData, isLoading } = useQuery({
    queryKey: ["cost-entries", orgId, statusFilter, methodFilter, vintageFilter, categoryFilter, page],
    queryFn: async () => {
      let query = supabase
        .from("cost_entries")
        .select("*, cost_categories(name, color), vintages(year, blocks(name))", { count: "exact" })
        .eq("org_id", orgId!)
        .order("effective_date", { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (statusFilter !== "all") query = query.eq("status", statusFilter as any);
      if (methodFilter !== "all") query = query.eq("method", methodFilter as any);
      if (vintageFilter !== "all") query = query.eq("vintage_id", vintageFilter);
      if (categoryFilter !== "all") query = query.eq("category_id", categoryFilter);

      const { data, error, count } = await query;
      if (error) throw error;
      return { entries: data as any[], total: count || 0 };
    },
    enabled: !!orgId,
  });

  const voidMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await supabase
        .from("cost_entries")
        .update({
          status: "voided" as any,
          voided_at: new Date().toISOString(),
          voided_by: profile?.id,
          void_reason: reason,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cost-entries"] });
      queryClient.invalidateQueries({ queryKey: ["cost-summary-ytd"] });
      toast.success("Cost entry voided");
      setVoidingEntry(null);
      setVoidReason("");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const entries = entriesData?.entries || [];
  const totalEntries = entriesData?.total || 0;
  const totalPages = Math.ceil(totalEntries / pageSize);

  const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  return (
    <div className="p-4 md:p-6 space-y-6 pb-24 md:pb-6">
      <SEOHead title="Production Costs | Solera" description="Track production costs per lot" />

      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-foreground">Production Costs</h1>
        <Button onClick={() => setAddDialogOpen(true)}><Plus className="h-4 w-4 mr-2" /> Add Cost</Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Costs (YTD)", value: fmt(summaryData?.total || 0) },
          { label: "Grape Costs (YTD)", value: fmt(summaryData?.grape || 0) },
          { label: "Non-Grape (YTD)", value: fmt(summaryData?.nonGrape || 0) },
          { label: "Active Lots", value: String(summaryData?.activeLots || 0) },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-lg font-bold text-foreground">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={vintageFilter} onValueChange={(v) => { setVintageFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="All Lots" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Lots</SelectItem>
            {vintages.map((v: any) => (
              <SelectItem key={v.id} value={v.id}>
                {v.year} {v.blocks?.name || ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Categories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={methodFilter} onValueChange={(v) => { setMethodFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Methods" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Methods</SelectItem>
            <SelectItem value="apportioned">Apportioned</SelectItem>
            <SelectItem value="transactional">Transactional</SelectItem>
            <SelectItem value="ad_hoc">Ad Hoc</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="voided">Voided</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-center">
            <DollarSign className="h-10 w-10 text-muted-foreground mb-4" />
            <p className="font-medium text-foreground mb-1">No production costs recorded yet.</p>
            <p className="text-sm text-muted-foreground mb-4">Add your first cost entry to start tracking COGS.</p>
            <Button onClick={() => setAddDialogOpen(true)}><Plus className="h-4 w-4 mr-2" /> Add Cost</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Lot/Vintage</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">$/Gal</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry: any) => (
                  <TableRow key={entry.id} className={entry.status === "voided" ? "opacity-60" : ""}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {format(parseISO(entry.effective_date), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-sm">
                      {entry.vintages?.year} {entry.vintages?.blocks?.name || ""}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-sm">
                        {entry.cost_categories?.color && (
                          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: entry.cost_categories.color }} />
                        )}
                        {entry.cost_categories?.name}
                      </span>
                    </TableCell>
                    <TableCell className={cn("text-sm max-w-[200px] truncate", entry.status === "voided" && "line-through")}>
                      {entry.description}
                    </TableCell>
                    <TableCell className="text-sm">{METHOD_LABELS[entry.method] || entry.method}</TableCell>
                    <TableCell className={cn("text-right font-mono text-sm", entry.status === "voided" && "line-through")}>
                      {fmt(Number(entry.total_amount))}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {entry.cost_per_gallon ? `$${Number(entry.cost_per_gallon).toFixed(2)}` : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-xs capitalize", STATUS_BADGE[entry.status])}>
                        {entry.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {entry.status === "active" && entry.method === "ad_hoc" && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {entry.status === "active" && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Void"
                            onClick={() => setVoidingEntry(entry)}>
                            <Ban className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, totalEntries)} of {totalEntries}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>Next</Button>
              </div>
            </div>
          )}
        </>
      )}

      <AddCostDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />

      {/* Void confirmation */}
      <AlertDialog open={!!voidingEntry} onOpenChange={(open) => { if (!open) { setVoidingEntry(null); setVoidReason(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void this cost entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This entry will be excluded from totals but kept for audit purposes. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <label className="text-sm font-medium text-foreground">Reason for voiding</label>
            <Textarea value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="Enter reason..." className="mt-1" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={!voidReason.trim() || voidMutation.isPending}
              onClick={() => voidingEntry && voidMutation.mutate({ id: voidingEntry.id, reason: voidReason })}
            >
              {voidMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Void Entry
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
