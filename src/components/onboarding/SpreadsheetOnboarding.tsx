import { useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  FileSpreadsheet, Upload, ArrowRight, ArrowLeft, Table2, Lightbulb,
  CheckCircle2, Download, Grape, FlaskConical, BarChart3, Loader2,
} from "lucide-react";
import Papa from "papaparse";

// ── Sample data that ships with the guided experience ──────────────────────

const SAMPLE_VINTAGES = [
  { year: 2024, variety: "Pinot Noir", block: "Block A — Estate", status: "In Cellar", tons: 3.2, brix_at_harvest: 24.5 },
  { year: 2024, variety: "Chardonnay", block: "Block B — River Bench", status: "In Cellar", tons: 4.8, brix_at_harvest: 23.1 },
  { year: 2023, variety: "Syrah", block: "Block C — Hilltop", status: "Bottled", tons: 2.1, brix_at_harvest: 25.8 },
  { year: 2023, variety: "Pinot Noir", block: "Block A — Estate", status: "Bottled", tons: 3.5, brix_at_harvest: 24.0 },
];

const SAMPLE_LAB = [
  { vintage: "2024 Pinot Noir", date: "2024-10-15", brix: 24.5, ph: 3.42, ta: 6.8, va: 0.03 },
  { vintage: "2024 Chardonnay", date: "2024-09-28", brix: 23.1, ph: 3.35, ta: 7.1, va: 0.02 },
  { vintage: "2024 Pinot Noir", date: "2024-11-20", brix: -0.5, ph: 3.55, ta: 6.2, va: 0.04 },
  { vintage: "2023 Syrah", date: "2023-10-08", brix: 25.8, ph: 3.61, ta: 5.9, va: 0.05 },
];

const SAMPLE_CSV_CONTENT = `year,variety,block,status,tons_harvested,brix_at_harvest
2024,Pinot Noir,Block A — Estate,in_cellar,3.2,24.5
2024,Chardonnay,Block B — River Bench,in_cellar,4.8,23.1
2023,Syrah,Block C — Hilltop,bottled,2.1,25.8
2023,Pinot Noir,Block A — Estate,bottled,3.5,24.0`;

// ── Tooltip component ──────────────────────────────────────────────────────

function InlineTooltip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 p-3 rounded-lg bg-secondary/30 border border-secondary/50 text-sm">
      <Lightbulb className="h-4 w-4 text-gold mt-0.5 shrink-0" />
      <span className="text-muted-foreground">{children}</span>
    </div>
  );
}

// ── Steps ──────────────────────────────────────────────────────────────────

interface StepProps {
  onNext: () => void;
  onBack: () => void;
}

function StepWelcome({ onNext }: { onNext: () => void }) {
  return (
    <Card className="border-none shadow-xl">
      <CardHeader className="text-center pb-4">
        <div className="mx-auto p-3 rounded-full bg-primary/10 w-fit mb-3">
          <FileSpreadsheet className="h-8 w-8 text-primary" />
        </div>
        <CardTitle className="text-2xl font-display text-primary">
          Moving from Spreadsheets?
        </CardTitle>
        <CardDescription className="text-base">
          We'll get your data into Solera in under 5 minutes — no re-typing.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3">
          {[
            { icon: Table2, text: "See how your spreadsheet data maps to Solera" },
            { icon: FlaskConical, text: "Preview real wine data so you know what to expect" },
            { icon: Upload, text: "Import your own CSV or Excel file right now" },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3 p-3 rounded-lg border border-border">
              <div className="p-2 rounded-md bg-primary/10">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm text-foreground">{text}</span>
            </div>
          ))}
        </div>
        <InlineTooltip>
          Most wineries import vintages and lab data first. You can always add more modules later.
        </InlineTooltip>
      </CardContent>
      <div className="p-6 pt-2">
        <Button className="w-full" onClick={onNext}>
          Let's Go <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </Card>
  );
}

function StepPreviewData({ onNext, onBack }: StepProps) {
  const [activeTab, setActiveTab] = useState<"vintages" | "lab">("vintages");

  return (
    <Card className="border-none shadow-xl">
      <CardHeader className="text-center pb-4">
        <CardTitle className="text-2xl font-display text-primary">
          Here's What Your Data Will Look Like
        </CardTitle>
        <CardDescription>
          This is sample wine data — your data will look just like this after import.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={activeTab === "vintages" ? "default" : "outline"}
            onClick={() => setActiveTab("vintages")}
          >
            <Grape className="h-3.5 w-3.5 mr-1" /> Vintages
          </Button>
          <Button
            size="sm"
            variant={activeTab === "lab" ? "default" : "outline"}
            onClick={() => setActiveTab("lab")}
          >
            <FlaskConical className="h-3.5 w-3.5 mr-1" /> Lab Samples
          </Button>
        </div>

        <div className="border border-border rounded-lg overflow-x-auto">
          {activeTab === "vintages" ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="p-2 text-left font-medium text-muted-foreground">Year</th>
                  <th className="p-2 text-left font-medium text-muted-foreground">Variety</th>
                  <th className="p-2 text-left font-medium text-muted-foreground">Block</th>
                  <th className="p-2 text-left font-medium text-muted-foreground">Status</th>
                  <th className="p-2 text-right font-medium text-muted-foreground">Tons</th>
                  <th className="p-2 text-right font-medium text-muted-foreground">Brix</th>
                </tr>
              </thead>
              <tbody>
                {SAMPLE_VINTAGES.map((v, i) => (
                  <tr key={i} className="border-b border-border/50 last:border-0">
                    <td className="p-2 text-foreground">{v.year}</td>
                    <td className="p-2 text-foreground font-medium">{v.variety}</td>
                    <td className="p-2 text-muted-foreground">{v.block}</td>
                    <td className="p-2">
                      <Badge variant="outline" className="text-xs">{v.status}</Badge>
                    </td>
                    <td className="p-2 text-right text-foreground">{v.tons}</td>
                    <td className="p-2 text-right text-foreground">{v.brix_at_harvest}°</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="p-2 text-left font-medium text-muted-foreground">Vintage</th>
                  <th className="p-2 text-left font-medium text-muted-foreground">Date</th>
                  <th className="p-2 text-right font-medium text-muted-foreground">Brix</th>
                  <th className="p-2 text-right font-medium text-muted-foreground">pH</th>
                  <th className="p-2 text-right font-medium text-muted-foreground">TA</th>
                  <th className="p-2 text-right font-medium text-muted-foreground">VA</th>
                </tr>
              </thead>
              <tbody>
                {SAMPLE_LAB.map((l, i) => (
                  <tr key={i} className="border-b border-border/50 last:border-0">
                    <td className="p-2 text-foreground font-medium">{l.vintage}</td>
                    <td className="p-2 text-muted-foreground">{l.date}</td>
                    <td className="p-2 text-right text-foreground">{l.brix}</td>
                    <td className="p-2 text-right text-foreground">{l.ph}</td>
                    <td className="p-2 text-right text-foreground">{l.ta}</td>
                    <td className="p-2 text-right text-foreground">{l.va}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <InlineTooltip>
          Solera auto-maps your column headers to the right fields using AI. No manual config needed for most spreadsheets.
        </InlineTooltip>
      </CardContent>
      <div className="p-6 pt-2 flex gap-3">
        <Button variant="outline" onClick={onBack} className="flex-1">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <Button onClick={onNext} className="flex-1">
          Import My Data <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </Card>
  );
}

interface StepImportProps extends StepProps {
  onFinish: (hasFile: boolean) => void;
}

function StepImport({ onBack, onFinish }: StepImportProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rowCount, setRowCount] = useState(0);
  const [headers, setHeaders] = useState<string[]>([]);

  const processFile = useCallback((file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["csv", "tsv", "xlsx", "xls"].includes(ext || "")) {
      toast.error("Please upload a CSV, TSV, or Excel file.");
      return;
    }
    setFileName(file.name);
    if (ext === "csv" || ext === "tsv") {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => {
          setHeaders(result.meta.fields || []);
          setRowCount(result.data.length);
        },
        error: () => toast.error("Could not parse file"),
      });
    } else {
      toast.success(`${file.name} ready — we'll process it after setup.`);
      setRowCount(-1); // signal we have a file but no preview
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const downloadTemplate = () => {
    const blob = new Blob([SAMPLE_CSV_CONTENT], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "solera-vintage-template.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Template downloaded!");
  };

  return (
    <Card className="border-none shadow-xl">
      <CardHeader className="text-center pb-4">
        <CardTitle className="text-2xl font-display text-primary">
          Import Your Spreadsheet
        </CardTitle>
        <CardDescription>
          Drop your CSV or Excel file here, or download a template to get started.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
            isDragging
              ? "border-primary bg-primary/5"
              : fileName
                ? "border-primary bg-primary/5"
                : "border-border hover:border-secondary/50 hover:bg-muted/30"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.tsv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }}
          />
          {fileName ? (
            <>
              <CheckCircle2 className="h-8 w-8 text-primary" />
              <div className="text-center">
                <p className="font-medium text-foreground">{fileName}</p>
                {rowCount > 0 && (
                  <p className="text-sm text-muted-foreground">{rowCount} rows · {headers.length} columns detected</p>
                )}
              </div>
            </>
          ) : (
            <>
              <Upload className="h-8 w-8 text-muted-foreground" />
              <div className="text-center">
                <p className="font-medium text-foreground">Drop your file here</p>
                <p className="text-sm text-muted-foreground">CSV, TSV, or Excel · up to 20 MB</p>
              </div>
            </>
          )}
        </div>

        {/* Column preview */}
        {headers.length > 0 && (
          <div className="p-3 rounded-lg bg-muted/50 border border-border">
            <p className="text-xs font-medium text-muted-foreground mb-2">Detected columns:</p>
            <div className="flex flex-wrap gap-1.5">
              {headers.slice(0, 12).map((h) => (
                <Badge key={h} variant="secondary" className="text-xs">{h}</Badge>
              ))}
              {headers.length > 12 && (
                <Badge variant="outline" className="text-xs">+{headers.length - 12} more</Badge>
              )}
            </div>
          </div>
        )}

        {/* Template download */}
        <button
          onClick={downloadTemplate}
          className="flex items-center gap-2 text-sm text-primary hover:underline w-full justify-center py-2"
        >
          <Download className="h-4 w-4" /> Download a sample CSV template
        </button>

        <InlineTooltip>
          Don't worry about perfect formatting. Solera's AI mapper handles most column name variations automatically.
        </InlineTooltip>
      </CardContent>
      <div className="p-6 pt-2 flex gap-3">
        <Button variant="outline" onClick={onBack} className="flex-1">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <Button onClick={() => onFinish(!!fileName)} className="flex-1">
          {fileName ? "Finish Setup & Import" : "Skip — I'll Import Later"}
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </Card>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

interface Props {
  onComplete: (navigateTo: string) => void;
  onBack: () => void;
}

export function SpreadsheetOnboarding({ onComplete, onBack }: Props) {
  const { profile, refreshProfile } = useAuth();
  const [innerStep, setInnerStep] = useState(0); // 0=welcome, 1=preview, 2=import
  const [loading, setLoading] = useState(false);

  const handleFinish = async (hasFile: boolean) => {
    if (!profile?.org_id) {
      toast.error("Organization not found. Please try signing out and back in.");
      return;
    }
    setLoading(true);
    const { error } = await supabase
      .from("organizations")
      .update({
        tier: "small_boutique" as const,
        type: "winery",
        enabled_modules: ["vineyard_ops", "vintage_management", "cellar_management"],
        onboarding_completed: true,
      })
      .eq("id", profile.org_id);

    if (error) {
      toast.error("Failed to save settings");
      setLoading(false);
      return;
    }
    await refreshProfile();
    toast.success("Welcome to Solera!");
    onComplete(hasFile ? "/import" : "/dashboard");
  };

  // Progress dots: 4 total steps (step 1 of main + 3 inner)
  const totalSteps = 4;
  const currentStep = innerStep + 2; // step 1 was the operation type picker

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="flex items-center justify-center gap-2 mb-8">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={`h-2 rounded-full transition-all ${
              i + 1 <= currentStep ? "bg-primary w-16" : "bg-border w-8"
            }`}
          />
        ))}
      </div>

      {loading ? (
        <Card className="border-none shadow-xl">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Setting up your winery…</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {innerStep === 0 && <StepWelcome onNext={() => setInnerStep(1)} />}
          {innerStep === 1 && (
            <StepPreviewData
              onNext={() => setInnerStep(2)}
              onBack={() => setInnerStep(0)}
            />
          )}
          {innerStep === 2 && (
            <StepImport
              onNext={() => {}}
              onBack={() => setInnerStep(1)}
              onFinish={handleFinish}
            />
          )}
        </>
      )}
    </div>
  );
}
