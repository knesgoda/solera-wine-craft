import { useCallback, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, Loader2 } from "lucide-react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { toast } from "sonner";

interface Props {
  accept: string;
  description: string;
  onFileData: (headers: string[], rows: Record<string, any>[]) => void;
}

export function ImportUploader({ accept, description, onFileData }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const processFile = useCallback(async (file: File) => {
    setIsProcessing(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase();

      if (ext === "json") {
        const text = await file.text();
        const json = JSON.parse(text);
        const rows = Array.isArray(json) ? json : json.data || json.records || [json];
        if (rows.length === 0) throw new Error("No data found in JSON");
        const headers = Object.keys(rows[0]);
        onFileData(headers, rows);
        return;
      }

      if (ext === "xlsx" || ext === "xls") {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);
        if (rows.length === 0) throw new Error("No data found in spreadsheet");
        const headers = Object.keys(rows[0]);
        onFileData(headers, rows);
        return;
      }

      // CSV
      const text = await file.text();
      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.data.length === 0) { toast.error("No data found"); return; }
          const headers = results.meta.fields || Object.keys(results.data[0] as any);
          onFileData(headers, results.data as Record<string, any>[]);
        },
        error: (err: any) => toast.error(err.message),
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to parse file");
    } finally {
      setIsProcessing(false);
    }
  }, [onFileData]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  return (
    <Card
      className={`border-2 border-dashed transition-colors ${isDragging ? "border-primary bg-primary/5" : "border-border"}`}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
        {isProcessing ? (
          <>
            <Loader2 className="h-12 w-12 text-primary animate-spin" />
            <p className="text-muted-foreground">Processing file…</p>
          </>
        ) : (
          <>
            <div className="p-4 rounded-full bg-primary/10">
              <Upload className="h-8 w-8 text-primary" />
            </div>
            <div className="text-center">
              <p className="font-medium text-foreground">{description}</p>
              <p className="text-sm text-muted-foreground mt-1">Drag & drop or click to browse</p>
            </div>
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <FileSpreadsheet className="h-4 w-4 mr-2" /> Choose File
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept={accept}
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = ""; }}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
