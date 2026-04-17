import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Camera, Upload, Loader2, ZoomIn, ZoomOut } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { HandwrittenReviewTable, type ExtractedRow, type ExtractedField } from "@/components/import/HandwrittenReviewTable";

export default function HandwrittenImport() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, organization } = useAuth();
  const orgId = profile?.org_id;

  const stateData = location.state as {
    sessionId?: string;
    extractionData?: { rows: any[] };
    imageUrl?: string;
    vintageId?: string;
  } | null;

  const [extractedRows, setExtractedRows] = useState<ExtractedRow[]>(() => {
    if (!stateData?.extractionData?.rows) return [];
    return stateData.extractionData.rows.map((r: any, i: number) => ({
      id: crypto.randomUUID(),
      ...r,
      status: "pending" as const,
    }));
  });

  const [imageUrl, setImageUrl] = useState<string | null>(stateData?.imageUrl || null);
  const [sessionId, setSessionId] = useState<string | null>(stateData?.sessionId || null);
  const [selectedVintageId, setSelectedVintageId] = useState<string>(stateData?.vintageId || "");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [zoom, setZoom] = useState(1);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: vintages = [] } = useQuery({
    queryKey: ["vintages-select", orgId],
    queryFn: async () => {
      const { data } = await supabase
        .from("vintages")
        .select("id, name, year, variety")
        .eq("org_id", orgId!)
        .order("year", { ascending: false });
      return data || [];
    },
    enabled: !!orgId,
  });

  const [signedImageUrl, setSignedImageUrl] = useState<string | null>(null);
  // Get signed URL for the image — refetch whenever imageUrl changes (e.g. on re-upload)
  useEffect(() => {
    if (!imageUrl) {
      setSignedImageUrl(null);
      return;
    }
    let cancelled = false;
    supabase.storage
      .from("handwritten-imports")
      .createSignedUrl(imageUrl, 3600)
      .then(({ data }) => {
        if (!cancelled && data?.signedUrl) setSignedImageUrl(data.signedUrl);
      });
    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  const handleUpload = async (file: File) => {
    if (!orgId || !profile) return;
    setUploading(true);
    try {
      const filePath = `${orgId}/${crypto.randomUUID()}-${file.name}`;
      const { error: uploadErr } = await supabase.storage.from("handwritten-imports").upload(filePath, file);
      if (uploadErr) throw uploadErr;

      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const { data: session, error: sessErr } = await supabase
        .from("handwritten_import_sessions")
        .insert({ org_id: orgId, created_by: profile.id, page_count: 1 } as any)
        .select("id")
        .single();
      if (sessErr) throw sessErr;

      const { data: extraction, error: extErr } = await supabase.functions.invoke("extract-handwritten-notes", {
        body: { imageBase64: base64, mimeType: file.type || "image/jpeg", orgId, sessionId: session.id },
      });
      if (extErr) throw extErr;

      setSessionId(session.id);
      setImageUrl(filePath);

      setExtractedRows(
        (extraction.rows || []).map((r: any) => ({
          id: crypto.randomUUID(),
          ...r,
          status: "pending" as const,
        }))
      );

      toast.success(`Extracted ${extraction.rows?.length || 0} rows`);
    } catch (err: any) {
      toast.error(err.message || "Extraction failed");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    const accepted = extractedRows.filter((r) => r.status === "accepted");
    if (accepted.length === 0) {
      toast.error("No accepted rows to import");
      return;
    }
    if (!selectedVintageId) {
      toast.error("Select a target vintage");
      return;
    }
    setSubmitting(true);
    try {
      const samples = accepted.map((row) => ({
        vintage_id: selectedVintageId,
        sampled_at: row.date?.value || new Date().toISOString().split("T")[0],
        brix: row.brix?.value ? parseFloat(row.brix.value) : null,
        ph: row.ph?.value ? parseFloat(row.ph.value) : null,
        ta: row.ta?.value ? parseFloat(row.ta.value) : null,
        temperature: row.temperature?.value ? parseFloat(row.temperature.value) : null,
        so2_free: row.so2_free?.value ? parseFloat(row.so2_free.value) : null,
        so2_total: row.so2_total?.value ? parseFloat(row.so2_total.value) : null,
        notes: row.notes?.value || null,
        import_source: "handwritten_photo",
      }));

      const { error } = await supabase.from("lab_samples").insert(samples as any);
      if (error) throw error;

      // Update session counts
      if (sessionId) {
        await supabase
          .from("handwritten_import_sessions")
          .update({
            rows_accepted: accepted.length,
            rows_rejected: extractedRows.filter((r) => r.status === "rejected").length,
          } as any)
          .eq("id", sessionId);
      }

      toast.success(`Imported ${accepted.length} lab samples`);
      navigate(selectedVintageId ? `/vintages/${selectedVintageId}` : "/data-import");
    } catch (err: any) {
      toast.error(err.message || "Import failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto pb-24 md:pb-6">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold text-foreground">Handwritten Notes Import</h1>
      </div>

      {!extractedRows.length && !uploading ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 gap-4">
            <Camera className="h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground text-center max-w-md">
              Upload a photo of your handwritten lab notebook page. Our AI will extract the data for you to review and import.
            </p>
            <div className="flex gap-3">
              <Button onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" /> Upload Image
              </Button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/heic,application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
              }}
            />
          </CardContent>
        </Card>
      ) : uploading ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Extracting data with AI…</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Image viewer */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Source Image</CardTitle>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}>
                      <ZoomOut className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setZoom((z) => Math.min(3, z + 0.25))}>
                      <ZoomIn className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
                      Re-upload
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-auto max-h-[70vh] rounded border bg-muted/30">
                  {signedImageUrl ? (
                    <img
                      src={signedImageUrl}
                      alt="Handwritten notes"
                      className="transition-transform origin-top-left"
                      style={{ transform: `scale(${zoom})` }}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">No image</div>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/heic,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload(f);
                  }}
                />
              </CardContent>
            </Card>
          </div>

          {/* Review table */}
          <div className="lg:col-span-3 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center gap-3">
                  <CardTitle className="text-sm">Target Vintage</CardTitle>
                  <Select value={selectedVintageId} onValueChange={setSelectedVintageId}>
                    <SelectTrigger className="w-60">
                      <SelectValue placeholder="Select vintage…" />
                    </SelectTrigger>
                    <SelectContent>
                      {vintages.map((v: any) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.year} {v.name} {v.variety ? `(${v.variety})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <HandwrittenReviewTable rows={extractedRows} setRows={setExtractedRows} />

                <div className="flex justify-end gap-3 mt-6">
                  <Button variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
                  <Button onClick={handleSubmit} disabled={submitting || !selectedVintageId}>
                    {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Import {extractedRows.filter((r) => r.status === "accepted").length} Samples
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
