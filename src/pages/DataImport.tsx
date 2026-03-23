import { useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileSpreadsheet, Database, BarChart3 } from "lucide-react";
import { ImportUploader } from "@/components/import/ImportUploader";
import { MappingReview } from "@/components/import/MappingReview";
import { ImportPreview } from "@/components/import/ImportPreview";
import { ImportProgress } from "@/components/import/ImportProgress";
import { ImportReport } from "@/components/import/ImportReport";
import { toast } from "sonner";

export type ImportStep = "upload" | "mapping" | "preview" | "importing" | "complete";
export type SourceType = "csv" | "innovint" | "vinnow";

export interface Mapping {
  source_column: string;
  target_table: string | null;
  target_field: string | null;
  confidence: string;
  overridden_by_user?: boolean;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: number;
  total: number;
}

export default function DataImport() {
  const { organization } = useAuth();
  const [sourceType, setSourceType] = useState<SourceType>("csv");
  const [step, setStep] = useState<ImportStep>("upload");
  const [headers, setHeaders] = useState<string[]>([]);
  const [allRows, setAllRows] = useState<Record<string, any>[]>([]);
  const [sampleRows, setSampleRows] = useState<Record<string, any>[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [isLoadingMapping, setIsLoadingMapping] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [duplicateStrategy, setDuplicateStrategy] = useState<"skip" | "merge" | "replace">("skip");

  const handleFileData = useCallback(async (parsedHeaders: string[], rows: Record<string, any>[]) => {
    setHeaders(parsedHeaders);
    setAllRows(rows);
    setSampleRows(rows.slice(0, 5));
    setStep("mapping");
    setIsLoadingMapping(true);

    try {
      const { data, error } = await supabase.functions.invoke("suggest-mapping", {
        body: { headers: parsedHeaders, sampleRows: rows.slice(0, 5), sourceType },
      });
      if (error) throw error;
      if (data?.mappings) {
        setMappings(data.mappings);
      } else {
        // Fallback: unmapped
        setMappings(parsedHeaders.map((h) => ({ source_column: h, target_table: null, target_field: null, confidence: "unmapped" })));
      }
    } catch (err: any) {
      toast.error("AI mapping failed, showing manual mapping");
      setMappings(parsedHeaders.map((h) => ({ source_column: h, target_table: null, target_field: null, confidence: "unmapped" })));
    } finally {
      setIsLoadingMapping(false);
    }
  }, [sourceType]);

  const handleConfirmMapping = async () => {
    // Save mappings
    try {
      const mappingRecords = mappings.map((m) => ({
        org_id: organization!.id,
        source_type: sourceType as any,
        source_column: m.source_column,
        target_table: m.target_table,
        target_field: m.target_field,
        confidence: m.confidence,
        overridden_by_user: m.overridden_by_user || false,
      }));
      await supabase.from("import_mappings").insert(mappingRecords as any);
    } catch { /* non-critical */ }
    setStep("preview");
  };

  const handleRunImport = async () => {
    setStep("importing");
    setImportProgress(10);

    try {
      // Create job
      const { data: job, error: jobErr } = await supabase
        .from("import_jobs")
        .insert({ org_id: organization!.id, source_type: sourceType as any, total_rows: allRows.length } as any)
        .select("id")
        .single();
      if (jobErr) throw jobErr;

      setImportProgress(30);

      const { data, error } = await supabase.functions.invoke("run-import", {
        body: {
          jobId: job.id,
          rows: allRows,
          mappings,
          orgId: organization!.id,
          duplicateStrategy,
        },
      });

      setImportProgress(100);

      if (error) throw error;
      setImportResult(data as ImportResult);
      setStep("complete");
      toast.success("Import complete!");
    } catch (err: any) {
      toast.error(err.message || "Import failed");
      setStep("preview");
    }
  };

  const handleReset = () => {
    setStep("upload");
    setHeaders([]);
    setAllRows([]);
    setSampleRows([]);
    setMappings([]);
    setImportResult(null);
    setImportProgress(0);
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto pb-24 md:pb-6">
      <h1 className="text-2xl font-bold text-foreground mb-6">Data Import</h1>

      <Tabs value={sourceType} onValueChange={(v) => { setSourceType(v as SourceType); handleReset(); }}>
        <TabsList className="w-full mb-6">
          <TabsTrigger value="csv" className="flex-1 gap-2">
            <FileSpreadsheet className="h-4 w-4" /> CSV / Excel
          </TabsTrigger>
          <TabsTrigger value="innovint" className="flex-1 gap-2">
            <Database className="h-4 w-4" /> Innovint
          </TabsTrigger>
          <TabsTrigger value="vinnow" className="flex-1 gap-2">
            <BarChart3 className="h-4 w-4" /> VinNow
          </TabsTrigger>
        </TabsList>

        <TabsContent value="csv">
          <SourceImport
            sourceType="csv"
            step={step}
            headers={headers}
            sampleRows={sampleRows}
            allRows={allRows}
            mappings={mappings}
            setMappings={setMappings}
            isLoadingMapping={isLoadingMapping}
            importProgress={importProgress}
            importResult={importResult}
            duplicateStrategy={duplicateStrategy}
            setDuplicateStrategy={setDuplicateStrategy}
            onFileData={handleFileData}
            onConfirmMapping={handleConfirmMapping}
            onRunImport={handleRunImport}
            onReset={handleReset}
            onBackToMapping={() => setStep("mapping")}
            acceptFormats=".csv,.xlsx,.xls,.tsv"
            description="Upload a CSV, Excel, or TSV file with your winery data"
          />
        </TabsContent>

        <TabsContent value="innovint">
          <SourceImport
            sourceType="innovint"
            step={step}
            headers={headers}
            sampleRows={sampleRows}
            allRows={allRows}
            mappings={mappings}
            setMappings={setMappings}
            isLoadingMapping={isLoadingMapping}
            importProgress={importProgress}
            importResult={importResult}
            duplicateStrategy={duplicateStrategy}
            setDuplicateStrategy={setDuplicateStrategy}
            onFileData={handleFileData}
            onConfirmMapping={handleConfirmMapping}
            onRunImport={handleRunImport}
            onReset={handleReset}
            onBackToMapping={() => setStep("mapping")}
            acceptFormats=".csv,.json"
            description="Upload your Innovint export file (.json or .csv)"
          />
        </TabsContent>

        <TabsContent value="vinnow">
          <SourceImport
            sourceType="vinnow"
            step={step}
            headers={headers}
            sampleRows={sampleRows}
            allRows={allRows}
            mappings={mappings}
            setMappings={setMappings}
            isLoadingMapping={isLoadingMapping}
            importProgress={importProgress}
            importResult={importResult}
            duplicateStrategy={duplicateStrategy}
            setDuplicateStrategy={setDuplicateStrategy}
            onFileData={handleFileData}
            onConfirmMapping={handleConfirmMapping}
            onRunImport={handleRunImport}
            onReset={handleReset}
            onBackToMapping={() => setStep("mapping")}
            acceptFormats=".csv"
            description="Upload your VinNow export CSV"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface SourceImportProps {
  sourceType: SourceType;
  step: ImportStep;
  headers: string[];
  sampleRows: Record<string, any>[];
  allRows: Record<string, any>[];
  mappings: Mapping[];
  setMappings: (m: Mapping[]) => void;
  isLoadingMapping: boolean;
  importProgress: number;
  importResult: ImportResult | null;
  duplicateStrategy: "skip" | "merge" | "replace";
  setDuplicateStrategy: (s: "skip" | "merge" | "replace") => void;
  onFileData: (headers: string[], rows: Record<string, any>[]) => void;
  onConfirmMapping: () => void;
  onRunImport: () => void;
  onReset: () => void;
  onBackToMapping: () => void;
  acceptFormats: string;
  description: string;
}

function SourceImport({
  sourceType, step, headers, sampleRows, allRows, mappings, setMappings,
  isLoadingMapping, importProgress, importResult, duplicateStrategy,
  setDuplicateStrategy, onFileData, onConfirmMapping, onRunImport, onReset,
  onBackToMapping, acceptFormats, description,
}: SourceImportProps) {
  return (
    <>
      {step === "upload" && (
        <ImportUploader
          accept={acceptFormats}
          description={description}
          onFileData={onFileData}
        />
      )}
      {step === "mapping" && (
        <MappingReview
          mappings={mappings}
          setMappings={setMappings}
          isLoading={isLoadingMapping}
          onConfirm={onConfirmMapping}
          onBack={onReset}
        />
      )}
      {step === "preview" && (
        <ImportPreview
          headers={headers}
          mappings={mappings}
          rows={allRows.slice(0, 10)}
          totalRows={allRows.length}
          duplicateStrategy={duplicateStrategy}
          setDuplicateStrategy={setDuplicateStrategy}
          onConfirm={onRunImport}
          onBack={onBackToMapping}
        />
      )}
      {step === "importing" && <ImportProgress progress={importProgress} />}
      {step === "complete" && importResult && (
        <ImportReport result={importResult} onReset={onReset} />
      )}
    </>
  );
}
