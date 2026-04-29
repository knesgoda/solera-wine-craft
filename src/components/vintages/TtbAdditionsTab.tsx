import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Download } from "lucide-react";
import { format, parseISO } from "date-fns";
import { NewAdditionDialog } from "@/components/vintages/NewAdditionDialog";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const typeLabels: Record<string, string> = {
  so2: "SO₂", yeast_nutrient: "Yeast Nutrient", enzyme: "Enzyme",
  fining_agent: "Fining Agent", acid: "Acid", other: "Other",
};

interface Props {
  vintageId: string;
  vintageYear: number;
  wineryName: string;
}

export function TtbAdditionsTab({ vintageId, vintageYear, wineryName }: Props) {
  const { organization } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: additions = [], isLoading } = useQuery({
    queryKey: ["ttb-additions", vintageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ttb_additions")
        .select("*")
        .eq("vintage_id", vintageId)
        .order("added_at", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!vintageId,
  });

  const exportPdf = () => {
    if (additions.length === 0) {
      toast.error("No additions to export");
      return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFontSize(16);
    doc.text("TTB Cellar Treatment / Additions Log", pageWidth / 2, 20, { align: "center" });
    doc.setFontSize(11);
    doc.text(wineryName, pageWidth / 2, 28, { align: "center" });
    doc.setFontSize(10);
    doc.text(`Vintage: ${vintageYear}`, 14, 38);

    const firstDate = format(parseISO(additions[0].added_at), "MM/dd/yyyy");
    const lastDate = format(parseISO(additions[additions.length - 1].added_at), "MM/dd/yyyy");
    doc.text(`Date Range: ${firstDate} – ${lastDate}`, 14, 44);

    const rows = additions.map((a: any) => [
      format(parseISO(a.added_at), "MM/dd/yyyy"),
      typeLabels[a.addition_type] || a.addition_type,
      a.ttb_code || "—",
      `${a.amount} ${a.unit}`,
      a.batch_size ? `${a.batch_size} gal` : "—",
      a.added_by || "—",
    ]);

    autoTable(doc, {
      startY: 50,
      head: [["Date", "Type", "TTB Code", "Amount", "Batch Size", "Added By"]],
      body: rows,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [107, 27, 42] },
    });

    doc.save(`TTB_Additions_${wineryName.replace(/\s+/g, "_")}_${vintageYear}.pdf`);
    toast.success("PDF downloaded");
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Additions Log</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportPdf} disabled={additions.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Export PDF
          </Button>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Add
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-center py-6 text-muted-foreground">Loading…</p>
      ) : additions.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No additions recorded yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>TTB Code</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Batch Size</TableHead>
                <TableHead>Added By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {additions.map((a: any) => (
                <TableRow key={a.id}>
                  <TableCell className="whitespace-nowrap">{format(parseISO(a.added_at), "MMM d, yyyy")}</TableCell>
                  <TableCell>{typeLabels[a.addition_type] || a.addition_type}</TableCell>
                  <TableCell>{a.ttb_code || "—"}</TableCell>
                  <TableCell>{a.amount} {a.unit}</TableCell>
                  <TableCell>{a.batch_size ? `${a.batch_size} gal` : "—"}</TableCell>
                  <TableCell>{a.added_by || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <NewAdditionDialog
        vintageId={vintageId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
