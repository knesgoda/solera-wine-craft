import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FileText, Download, Loader2, Eye } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Props {
  api: (action: string, payload?: any) => Promise<any>;
}

export function PdfReportsTab({ api }: Props) {
  const [generatingStandup, setGeneratingStandup] = useState(false);
  const [generatingWeekly, setGeneratingWeekly] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingDoc, setPendingDoc] = useState<jsPDF | null>(null);
  const [pendingFilename, setPendingFilename] = useState("");

  const { data: dashData } = useQuery({
    queryKey: ["admin-dashboard-stats"],
    queryFn: () => api("dashboard-stats"),
  });

  const { data: mrrData } = useQuery({
    queryKey: ["admin-weekly-mrr"],
    queryFn: () => api("weekly-mrr"),
  });

  const { data: metricsData } = useQuery({
    queryKey: ["admin-metrics"],
    queryFn: () => api("admin-metrics-list"),
  });

  const showPreview = (doc: jsPDF, filename: string) => {
    const blobUrl = doc.output("bloburl") as unknown as string;
    setPreviewUrl(blobUrl);
    setPendingDoc(doc);
    setPendingFilename(filename);
    setPreviewOpen(true);
  };

  const handleDownload = () => {
    if (pendingDoc) {
      pendingDoc.save(pendingFilename);
    }
    setPreviewOpen(false);
    setPreviewUrl(null);
    setPendingDoc(null);
  };

  const generateStandupPdf = async () => {
    setGeneratingStandup(true);
    try {
      const doc = new jsPDF();
      const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

      doc.setFillColor(107, 27, 42);
      doc.rect(0, 0, 210, 30, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("Solera — Daily Standup Report", 15, 18);
      doc.setFontSize(10);
      doc.text(today, 195, 18, { align: "right" });

      doc.setTextColor(26, 26, 26);
      let y = 40;

      // Users & Growth
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(107, 27, 42);
      doc.text("Users & Growth", 15, y);
      y += 8;

      if (dashData) {
        const tierLabels: Record<string, string> = { hobbyist: "Hobbyist", small_boutique: "Pro", mid_size: "Growth", enterprise: "Enterprise" };
        autoTable(doc, {
          startY: y,
          head: [["Metric", "Value"]],
          body: [
            ["Total Organizations", String(dashData.totalOrgs)],
            ["New (24h)", `${dashData.newOrgs24h} (${dashData.newOrgs24hDelta >= 0 ? "+" : ""}${dashData.newOrgs24hDelta} vs prior)`],
            ["New (7d)", `${dashData.newOrgs7d} (${dashData.newOrgs7dDelta >= 0 ? "+" : ""}${dashData.newOrgs7dDelta} vs prior)`],
            ...Object.entries(dashData.tierCounts || {}).map(([tier, count]) => [
              `  ${tierLabels[tier] || tier}`, `${count} (${dashData.totalOrgs > 0 ? Math.round((count as number) / dashData.totalOrgs * 100) : 0}%)`
            ]),
          ],
          theme: "striped",
          headStyles: { fillColor: [107, 27, 42] },
          margin: { left: 15, right: 15 },
        });
        y = (doc as any).lastAutoTable.finalY + 10;
      }

      // Revenue
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(107, 27, 42);
      doc.text("Revenue", 15, y);
      y += 8;

      if (dashData?.revenue) {
        autoTable(doc, {
          startY: y,
          head: [["Metric", "Value"]],
          body: [
            ["Current MRR", `$${dashData.revenue.mrr}`],
            ["MRR Added (7d)", `$${dashData.revenue.mrrAdded7d}`],
            ["Churned MRR (7d)", `$${dashData.revenue.mrrChurned7d}`],
            ["Net New MRR (7d)", `$${dashData.revenue.mrrAdded7d - dashData.revenue.mrrChurned7d}`],
            ["Active Subscriptions", String(dashData.revenue.activeSubscriptions)],
            ["Failed Payments (7d)", String(dashData.revenue.failedPayments7d)],
          ],
          theme: "striped",
          headStyles: { fillColor: [107, 27, 42] },
          margin: { left: 15, right: 15 },
        });
        y = (doc as any).lastAutoTable.finalY + 10;
      }

      // Engagement
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(107, 27, 42);
      doc.text("Engagement", 15, y);
      y += 8;

      if (dashData) {
        autoTable(doc, {
          startY: y,
          head: [["Metric", "Value"]],
          body: [
            ["Active Orgs (24h)", String(dashData.activeOrgs24h)],
            ["Active Orgs (7d)", String(dashData.activeOrgs7d)],
            ["Total Lab Samples", String(dashData.totalLabSamples)],
            ["Tasks Completed", String(dashData.totalTasksCompleted)],
            ["Imports Completed", String(dashData.totalImportsCompleted)],
            ["Total Vintages", String(dashData.totalVintages)],
            ["Ask Solera (7d)", String(dashData.aiQueries7d)],
          ],
          theme: "striped",
          headStyles: { fillColor: [107, 27, 42] },
          margin: { left: 15, right: 15 },
        });
        y = (doc as any).lastAutoTable.finalY + 10;
      }

      // Alerts
      if (dashData?.alerts) {
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(107, 27, 42);
        doc.text("Alerts & Flags", 15, y);
        y += 8;

        autoTable(doc, {
          startY: y,
          head: [["Status", "Alert"]],
          body: dashData.alerts.map((a: any) => [a.icon, a.label]),
          theme: "striped",
          headStyles: { fillColor: [107, 27, 42] },
          margin: { left: 15, right: 15 },
        });
      }

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(128);
        doc.text("Confidential — Solera Internal | solera.vin", 105, 290, { align: "center" });
      }

      const dateStr = new Date().toISOString().slice(0, 10);
      showPreview(doc, `solera-standup-${dateStr}.pdf`);
    } finally {
      setGeneratingStandup(false);
    }
  };

  const generateWeeklyPdf = async () => {
    setGeneratingWeekly(true);
    try {
      // Fetch cohort + module data alongside existing data
      let engagementData: any = null;
      let analyticsData: any = null;
      try {
        [engagementData, analyticsData] = await Promise.all([
          api("engagement-stats"),
          api("product-analytics"),
        ]);
      } catch {}

      const doc = new jsPDF();
      const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

      doc.setFillColor(107, 27, 42);
      doc.rect(0, 0, 210, 30, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("Solera — Weekly Strategy Report", 15, 18);
      doc.setFontSize(10);
      doc.text(today, 195, 18, { align: "right" });

      let y = 40;
      doc.setTextColor(26, 26, 26);

      // MRR Trend table
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(107, 27, 42);
      doc.text("Revenue Trend", 15, y);
      y += 8;

      const weeks = mrrData?.weeks || [];
      if (weeks.length > 0) {
        autoTable(doc, {
          startY: y,
          head: [["Week", "MRR", "Pro", "Growth", "Enterprise"]],
          body: weeks.slice(-8).map((w: any) => [
            w.weekOf, `$${w.mrr}`, `$${w.mrr_small_boutique || 0}`, `$${w.mrr_mid_size || 0}`, `$${w.mrr_enterprise || 0}`,
          ]),
          theme: "striped",
          headStyles: { fillColor: [107, 27, 42] },
          margin: { left: 15, right: 15 },
        });
        y = (doc as any).lastAutoTable.finalY + 10;
      }

      // User Cohorts
      if (engagementData?.signupsByWeek?.length) {
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(107, 27, 42);
        doc.text("User Cohorts", 15, y);
        y += 8;

        const tierDist = engagementData.tierDistribution || [];
        autoTable(doc, {
          startY: y,
          head: [["Week", "New Signups", "Hobbyist", "Pro", "Growth", "Enterprise"]],
          body: engagementData.signupsByWeek.map((w: any, i: number) => {
            const td = tierDist[i] || {};
            return [w.weekOf, String(w.signups), String(td.Hobbyist || 0), String(td.Pro || 0), String(td.Growth || 0), String(td.Enterprise || 0)];
          }),
          theme: "striped",
          headStyles: { fillColor: [107, 27, 42] },
          margin: { left: 15, right: 15 },
        });
        y = (doc as any).lastAutoTable.finalY + 10;
      }

      // Module Adoption
      if (analyticsData?.modules?.length) {
        if (y > 240) { doc.addPage(); y = 20; }
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(107, 27, 42);
        doc.text("Module Adoption", 15, y);
        y += 8;

        autoTable(doc, {
          startY: y,
          head: [["Module", "Adoption %"]],
          body: analyticsData.modules.map((m: any) => [m.name, `${m.adoption}%`]),
          theme: "striped",
          headStyles: { fillColor: [107, 27, 42] },
          margin: { left: 15, right: 15 },
        });
        y = (doc as any).lastAutoTable.finalY + 10;
      }

      // Search Console
      const metrics = metricsData?.metrics || [];
      if (metrics.length > 0) {
        if (y > 240) { doc.addPage(); y = 20; }
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(107, 27, 42);
        doc.text("Search Console", 15, y);
        y += 8;

        autoTable(doc, {
          startY: y,
          head: [["Week", "Clicks", "Impressions", "Avg Position"]],
          body: metrics.slice(0, 8).map((m: any) => [
            m.week_of, String(m.sc_clicks), String(m.sc_impressions), String(m.sc_avg_position),
          ]),
          theme: "striped",
          headStyles: { fillColor: [107, 27, 42] },
          margin: { left: 15, right: 15 },
        });
        y = (doc as any).lastAutoTable.finalY + 10;

        const latest = metrics[0];
        if (latest?.notes) {
          doc.setFontSize(14);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(107, 27, 42);
          doc.text("Strategic Notes", 15, y);
          y += 8;
          doc.setFontSize(10);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(26, 26, 26);
          const lines = doc.splitTextToSize(latest.notes, 180);
          doc.text(lines, 15, y);
        }
      }

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(128);
        doc.text("Confidential — Solera Internal | solera.vin", 105, 290, { align: "center" });
      }

      const dateStr = new Date().toISOString().slice(0, 10);
      showPreview(doc, `solera-weekly-${dateStr}.pdf`);
    } finally {
      setGeneratingWeekly(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl" style={{ background: "#6B1B2A15" }}>
                <FileText className="h-6 w-6" style={{ color: "#6B1B2A" }} />
              </div>
              <div>
                <CardTitle className="text-lg">Daily Standup PDF</CardTitle>
                <CardDescription>Dashboard stats, revenue, engagement, and alerts</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button
              size="lg"
              className="w-full"
              style={{ background: "#6B1B2A" }}
              onClick={generateStandupPdf}
              disabled={generatingStandup || !dashData}
            >
              {generatingStandup ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Eye className="h-4 w-4 mr-2" />}
              Preview & Download
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              Filename: solera-standup-{new Date().toISOString().slice(0, 10)}.pdf
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl" style={{ background: "#C8902A15" }}>
                <FileText className="h-6 w-6" style={{ color: "#C8902A" }} />
              </div>
              <div>
                <CardTitle className="text-lg">Weekly Strategy PDF</CardTitle>
                <CardDescription>Revenue trends, search console data, strategic notes</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button
              size="lg"
              className="w-full"
              style={{ background: "#C8902A" }}
              onClick={generateWeeklyPdf}
              disabled={generatingWeekly}
            >
              {generatingWeekly ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Eye className="h-4 w-4 mr-2" />}
              Preview & Download
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              Filename: solera-weekly-{new Date().toISOString().slice(0, 10)}.pdf
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Print Preview Modal */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>PDF Preview — {pendingFilename}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            {previewUrl && (
              <iframe
                src={previewUrl}
                className="w-full h-full border rounded-lg"
                title="PDF Preview"
              />
            )}
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Cancel</Button>
            <Button onClick={handleDownload} style={{ background: "#6B1B2A" }}>
              <Download className="h-4 w-4 mr-2" /> Download PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
