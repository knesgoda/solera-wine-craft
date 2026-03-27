import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Download, FileArchive, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle, Clock, CalendarClock, ToggleLeft } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

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
  triggered_by?: string;
}

interface BackupSchedule {
  id: string;
  org_id: string;
  enabled: boolean;
  frequency: string;
  format: string;
  last_run_at: string | null;
  next_run_at: string | null;
}

export default function DataBackupSection() {
  const { profile } = useAuth();
  const [jobs, setJobs] = useState<BackupJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<"csv" | "xlsx">("csv");
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [cooldownMinutes, setCooldownMinutes] = useState(0);
  const [schedule, setSchedule] = useState<BackupSchedule | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);

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

  const fetchSchedule = useCallback(async () => {
    if (!profile?.org_id) return;
    const { data } = await supabase
      .from("backup_schedules")
      .select("*")
      .eq("org_id", profile.org_id)
      .single() as any;
    setSchedule(data || null);
  }, [profile?.org_id]);

  useEffect(() => { fetchJobs(); fetchSchedule(); }, [fetchJobs, fetchSchedule]);

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

  const handleToggleSchedule = async (enabled: boolean) => {
    if (!profile?.org_id) return;
    setScheduleLoading(true);
    try {
      if (schedule) {
        // Update existing
        const nextRunAt = enabled ? calcNextRun(schedule.frequency) : null;
        await supabase
          .from("backup_schedules")
          .update({ enabled, next_run_at: nextRunAt } as any)
          .eq("id", schedule.id);
      } else {
        // Create new
        const nextRunAt = enabled ? calcNextRun("weekly") : null;
        await supabase.from("backup_schedules").insert({
          org_id: profile.org_id,
          enabled,
          frequency: "weekly",
          format: "csv",
          next_run_at: nextRunAt,
        } as any);
      }
      await fetchSchedule();
      toast.success(enabled ? "Scheduled backups enabled" : "Scheduled backups disabled");
    } catch (err: any) {
      toast.error("Failed to update schedule");
    } finally {
      setScheduleLoading(false);
    }
  };

  const handleUpdateSchedule = async (field: "frequency" | "format", value: string) => {
    if (!schedule) return;
    setScheduleLoading(true);
    try {
      const updates: any = { [field]: value };
      if (field === "frequency" && schedule.enabled) {
        updates.next_run_at = calcNextRun(value);
      }
      await supabase.from("backup_schedules").update(updates).eq("id", schedule.id);
      await fetchSchedule();
      toast.success("Schedule updated");
    } catch {
      toast.error("Failed to update schedule");
    } finally {
      setScheduleLoading(false);
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

  const triggeredByLabel = (triggeredBy?: string) => {
    switch (triggeredBy) {
      case "scheduled": return "Scheduled";
      case "cancellation": return "Cancellation";
      default: return "Manual";
    }
  };

  const expiryLabel = (job: BackupJob) => {
    const tb = job.triggered_by || "manual";
    if (tb === "cancellation") return "90 days";
    if (tb === "scheduled") return "30 days";
    return "7 days";
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

        <Separator />

        {/* Scheduled Backups Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            <h4 className="text-sm font-semibold text-foreground">Scheduled Backups</h4>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="schedule-toggle" className="text-sm font-medium">
                Enable automatic backups
              </Label>
              <p className="text-xs text-muted-foreground">
                {schedule?.enabled
                  ? "Backup download links will be emailed to all organization administrators."
                  : "Enable scheduled backups to automatically receive a complete copy of your data."}
              </p>
            </div>
            <Switch
              id="schedule-toggle"
              checked={schedule?.enabled || false}
              onCheckedChange={handleToggleSchedule}
              disabled={scheduleLoading}
            />
          </div>

          {schedule?.enabled && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-lg bg-muted/30 border">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Frequency</Label>
                <Select
                  value={schedule.frequency}
                  onValueChange={(v) => handleUpdateSchedule("frequency", v)}
                  disabled={scheduleLoading}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly (every Monday)</SelectItem>
                    <SelectItem value="monthly">Monthly (1st of each month)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Format</Label>
                <Select
                  value={schedule.format}
                  onValueChange={(v) => handleUpdateSchedule("format", v)}
                  disabled={scheduleLoading}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csv">CSV</SelectItem>
                    <SelectItem value="xlsx">Excel (.xlsx)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {schedule.last_run_at && (
                <div className="col-span-full text-xs text-muted-foreground space-y-0.5">
                  <p>Last run: {formatDate(schedule.last_run_at)}</p>
                  {schedule.next_run_at && (
                    <p>Next scheduled: {formatDate(schedule.next_run_at)}</p>
                  )}
                </div>
              )}

              <p className="col-span-full text-xs text-muted-foreground">
                Download links expire after 30 days.
              </p>
            </div>
          )}
        </div>

        <Separator />

        {/* Export history */}
        {!loading && jobs.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-foreground">Export History</h4>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
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
                        <Badge variant="outline" className="text-xs">{triggeredByLabel(job.triggered_by)}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="uppercase text-xs">{job.format}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatBytes(job.file_size_bytes)}</TableCell>
                      <TableCell>
                        {job.status === "completed" && (
                          <Badge className="bg-primary/90 text-primary-foreground text-xs">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Completed
                          </Badge>
                        )}
                        {job.status === "failed" && (
                          <Badge variant="destructive" className="text-xs">
                            <AlertCircle className="h-3 w-3 mr-1" /> Failed
                          </Badge>
                        )}
                        {job.status === "expired" && (
                          <Badge variant="secondary" className="text-xs">Expired</Badge>
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
              Download links expire after 7 days (manual), 30 days (scheduled), or 90 days (cancellation).
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

function calcNextRun(frequency: string): string {
  const now = new Date();
  if (frequency === "weekly") {
    const day = now.getUTCDay();
    const daysUntilMonday = day === 0 ? 1 : (8 - day);
    const next = new Date(now);
    next.setUTCDate(now.getUTCDate() + daysUntilMonday);
    next.setUTCHours(2, 0, 0, 0);
    return next.toISOString();
  }
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 2, 0, 0)).toISOString();
}
