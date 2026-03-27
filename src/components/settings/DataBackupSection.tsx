import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Download, FileArchive, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface BackupJob {
  id: string;
  status: string;
  format: string;
  file_url: string | null;
  file_size_bytes: number | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
  expires_at: string | null;
}

export default function DataBackupSection() {
  const { profile } = useAuth();
  const [jobs, setJobs] = useState<BackupJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<"csv" | "xlsx">("csv");
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [cooldownMinutes, setCooldownMinutes] = useState(0);

  const fetchJobs = useCallback(async () => {
    if (!profile?.org_id) return;
    const { data } = await supabase
      .from("backup_jobs")
      .select("*")
      .eq("org_id", profile.org_id)
      .order("created_at", { ascending: false })
      .limit(10) as any;
    setJobs(data || []);
    setLoading(false);
  }, [profile?.org_id]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  // Poll for active job status
  useEffect(() => {
    if (!activeJobId) return;
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("backup_jobs")
        .select("*")
        .eq("id", activeJobId)
        .single() as any;
      if (data) {
        if (data.status === "completed" || data.status === "failed") {
          setActiveJobId(null);
          setGenerating(false);
          fetchJobs();
          if (data.status === "completed") {
            toast.success("Your backup is ready for download!");
          } else {
            toast.error(data.error_message || "Backup generation failed. Please try again.");
          }
        }
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [activeJobId, fetchJobs]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("request-backup", {
        body: { format: selectedFormat },
      });
      if (error) throw error;
      if (data.error === "rate_limited") {
        setCooldownMinutes(data.minutesLeft);
        toast.error(data.message);
        setGenerating(false);
        return;
      }
      if (data.error) throw new Error(data.error);
      setActiveJobId(data.jobId);
      toast.info("Generating your backup...");
    } catch (err: any) {
      toast.error(err.message || "Failed to start backup");
      setGenerating(false);
    }
  };

  const formatBytes = (bytes: number | null) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  };

  const isExpired = (job: BackupJob) => {
    if (!job.expires_at) return true;
    return new Date(job.expires_at) < new Date();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileArchive className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Back Up Your Data</CardTitle>
        </div>
        <CardDescription>
          Download a complete copy of all your winery data. Your data is always yours.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Format selector + generate button */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
          <div className="flex gap-2">
            <Button
              variant={selectedFormat === "csv" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedFormat("csv")}
              disabled={generating}
            >
              <FileArchive className="h-4 w-4 mr-1.5" />
              Download as CSV
            </Button>
            <Button
              variant={selectedFormat === "xlsx" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedFormat("xlsx")}
              disabled={generating}
            >
              <FileSpreadsheet className="h-4 w-4 mr-1.5" />
              Download as Excel
            </Button>
          </div>
          <Button
            onClick={handleGenerate}
            disabled={generating || cooldownMinutes > 0}
            className="min-w-[160px]"
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : cooldownMinutes > 0 ? (
              <>
                <Clock className="h-4 w-4 mr-2" />
                Wait {cooldownMinutes}m
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Generate Backup
              </>
            )}
          </Button>
        </div>

        {/* Progress indicator */}
        {generating && (
          <div className="space-y-2 p-4 rounded-lg bg-muted/50 border">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Preparing your backup...
            </div>
            <Progress value={undefined} className="h-2" />
            <p className="text-xs text-muted-foreground">
              This may take up to a minute for large datasets.
            </p>
          </div>
        )}

        {/* Export history */}
        {!loading && jobs.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-foreground">Export History</h4>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Format</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Download</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell className="text-sm">{formatDate(job.created_at)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="uppercase text-xs">{job.format}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatBytes(job.file_size_bytes)}</TableCell>
                      <TableCell>
                        {job.status === "completed" && (
                          <Badge variant="default" className="bg-green-600 text-xs">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Completed
                          </Badge>
                        )}
                        {job.status === "failed" && (
                          <Badge variant="destructive" className="text-xs">
                            <AlertCircle className="h-3 w-3 mr-1" /> Failed
                          </Badge>
                        )}
                        {(job.status === "pending" || job.status === "processing") && (
                          <Badge variant="secondary" className="text-xs">
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Processing
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {job.status === "completed" && job.file_url && !isExpired(job) ? (
                          <Button variant="ghost" size="sm" asChild>
                            <a href={job.file_url} download>
                              <Download className="h-4 w-4" />
                            </a>
                          </Button>
                        ) : job.status === "completed" && isExpired(job) ? (
                          <span className="text-xs text-muted-foreground">Expired</span>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="text-xs text-muted-foreground">
              Download links are available for 7 days after generation.
            </p>
          </div>
        )}

        {/* Verification note */}
        <p className="text-xs text-muted-foreground border-t pt-3">
          Each backup includes a <code className="text-xs">manifest.json</code> file with row counts and SHA-256 checksums for every data file. Open it to verify your backup is complete and uncorrupted.
        </p>
      </CardContent>
    </Card>
  );
}
