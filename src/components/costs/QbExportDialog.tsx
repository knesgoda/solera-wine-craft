import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Eye, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";

interface QbExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QbExportDialog({ open, onOpenChange }: QbExportDialogProps) {
  const { profile, organization } = useAuth();
  const orgId = organization?.id || profile?.org_id;
  const [startDate, setStartDate] = useState(format(new Date(new Date().getFullYear(), 0, 1), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [vintageFilter, setVintageFilter] = useState("all");
  const [exportFormat, setExportFormat] = useState<"csv" | "iif">("csv");
  const [showPreview, setShowPreview] = useState(false);
  const [exporting, setExporting] = useState(false);

  const { data: vintages = [] } = useQuery({
    queryKey: ["vintages-for-export", orgId],
    queryFn: async () => {
      const { data } = await supabase.from("vintages").select("id, year, variety, name").eq("org_id", orgId!).order("year", { ascending: false });
      return data || [];
    },
    enabled: !!orgId && open,
  });

  const { data: exportData = [], isLoading } = useQuery({
    queryKey: ["qb-export-data", orgId, startDate, endDate, vintageFilter],
    queryFn: async () => {
      let query = supabase
        .from("cost_entries")
        .select("*, cost_categories(name, qb_account_name, color), vintages(year, variety, name), weigh_tags(grower_id, growers(name))")
        .eq("org_id", orgId!)
        .eq("status", "active" as any)
        .gte("effective_date", startDate)
        .lte("effective_date", endDate)
        .order("effective_date");
      if (vintageFilter !== "all") query = query.eq("vintage_id", vintageFilter);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!orgId && open && showPreview,
  });

  const getVendor = (entry: any) => {
    if (entry.weigh_tags?.growers?.name) return entry.weigh_tags.growers.name;
    if (entry.notes && entry.method === "ad_hoc") return entry.notes;
    return "";
  };

  const getLotName = (entry: any) => {
    const v = entry.vintages;
    if (!v) return "";
    return v.name || `${v.year || ""} ${v.variety || ""}`.trim();
  };

  const generateCSV = () => {
    const headers = ["DATE", "ACCNT", "NAME", "MEMO", "AMOUNT", "CLASS"];
    const rows = exportData.map((e: any) => [
      format(parseISO(e.effective_date), "MM/dd/yyyy"),
      e.cost_categories?.qb_account_name || e.cost_categories?.name || "",
      getVendor(e),
      (e.description || "").replace(/"/g, '""'),
      Number(e.total_amount).toFixed(2),
      getLotName(e),
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.map(c => `"${c}"`).join(","))].join("\n");
    return csv;
  };

  const generateIIF = () => {
    const lines = ["!TRNS\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tMEMO\tCLASS", "!SPL\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tMEMO\tCLASS", "!ENDTRNS"];
    for (const e of exportData) {
      const date = format(parseISO(e.effective_date), "MM/dd/yyyy");
      const acct = e.cost_categories?.qb_account_name || e.cost_categories?.name || "";
      const name = getVendor(e);
      const amount = Number(e.total_amount).toFixed(2);
      const memo = (e.description || "").replace(/\t/g, " ");
      const cls = getLotName(e);
      lines.push(`TRNS\tCHECK\t${date}\tAccounts Payable\t${name}\t-${amount}\t${memo}\t${cls}`);
      lines.push(`SPL\tCHECK\t${date}\t${acct}\t${name}\t${amount}\t${memo}\t${cls}`);
      lines.push("ENDTRNS");
    }
    return lines.join("\n");
  };

  const handleExport = () => {
    setExporting(true);
    try {
      const content = exportFormat === "csv" ? generateCSV() : generateIIF();
      const blob = new Blob([content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `solera-costs-${startDate}-to-${endDate}.${exportFormat}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${exportData.length} entries as ${exportFormat.toUpperCase()}`);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Export to QuickBooks</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Start Date</Label>
              <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setShowPreview(false); }} />
            </div>
            <div className="space-y-1.5">
              <Label>End Date</Label>
              <Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setShowPreview(false); }} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Vintage / Lot</Label>
              <Select value={vintageFilter} onValueChange={(v) => { setVintageFilter(v); setShowPreview(false); }}>
                <SelectTrigger><SelectValue placeholder="All Lots" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Lots</SelectItem>
                  {vintages.map((v: any) => (
                    <SelectItem key={v.id} value={v.id}>{v.name || `${v.year} ${v.variety || ""}`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Format</Label>
              <Select value={exportFormat} onValueChange={(v: any) => setExportFormat(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV (QuickBooks Online)</SelectItem>
                  <SelectItem value="iif">IIF (QuickBooks Desktop)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button variant="outline" onClick={() => setShowPreview(true)} disabled={isLoading}>
            <Eye className="h-4 w-4 mr-2" /> Preview
          </Button>

          {showPreview && (
            <div className="border border-border rounded-lg overflow-x-auto max-h-[300px] overflow-y-auto">
              {isLoading ? (
                <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : exportData.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4 text-center">No entries match the selected filters.</p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground p-2">{exportData.length} entries (showing first 10)</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">DATE</TableHead>
                        <TableHead className="text-xs">ACCNT</TableHead>
                        <TableHead className="text-xs">NAME</TableHead>
                        <TableHead className="text-xs">MEMO</TableHead>
                        <TableHead className="text-xs text-right">AMOUNT</TableHead>
                        <TableHead className="text-xs">CLASS</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {exportData.slice(0, 10).map((e: any) => (
                        <TableRow key={e.id}>
                          <TableCell className="text-xs whitespace-nowrap">{format(parseISO(e.effective_date), "MM/dd/yy")}</TableCell>
                          <TableCell className="text-xs">{e.cost_categories?.qb_account_name || e.cost_categories?.name}</TableCell>
                          <TableCell className="text-xs truncate max-w-[100px]">{getVendor(e)}</TableCell>
                          <TableCell className="text-xs truncate max-w-[150px]">{e.description}</TableCell>
                          <TableCell className="text-xs text-right font-mono">${Number(e.total_amount).toFixed(2)}</TableCell>
                          <TableCell className="text-xs truncate max-w-[100px]">{getLotName(e)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleExport} disabled={exporting || (!showPreview || exportData.length === 0)}>
            {exporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
            Export {exportFormat.toUpperCase()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
