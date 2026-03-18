import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  X, Plus, Download, Save, FileText, CalendarIcon, GripVertical,
  Loader2, Trash2, ChevronRight, Filter, Database,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ── Field definitions ──────────────────────────────────────────────
interface FieldDef {
  key: string;
  label: string;
  category: string;
  table: string;
  column: string;
  type: "text" | "number" | "date";
}

const FIELD_CATALOG: FieldDef[] = [
  // Vintage
  { key: "v.year", label: "Year", category: "Vintage", table: "vintages", column: "year", type: "number" },
  { key: "v.status", label: "Status", category: "Vintage", table: "vintages", column: "status", type: "text" },
  { key: "v.harvest_date", label: "Harvest Date", category: "Vintage", table: "vintages", column: "harvest_date", type: "date" },
  { key: "v.tons_harvested", label: "Tons Harvested", category: "Vintage", table: "vintages", column: "tons_harvested", type: "number" },
  // Lab
  { key: "l.sampled_at", label: "Sampled At", category: "Lab", table: "lab_samples", column: "sampled_at", type: "date" },
  { key: "l.brix", label: "Brix", category: "Lab", table: "lab_samples", column: "brix", type: "number" },
  { key: "l.ph", label: "pH", category: "Lab", table: "lab_samples", column: "ph", type: "number" },
  { key: "l.ta", label: "TA", category: "Lab", table: "lab_samples", column: "ta", type: "number" },
  { key: "l.va", label: "VA", category: "Lab", table: "lab_samples", column: "va", type: "number" },
  { key: "l.so2_free", label: "Free SO₂", category: "Lab", table: "lab_samples", column: "so2_free", type: "number" },
  { key: "l.so2_total", label: "Total SO₂", category: "Lab", table: "lab_samples", column: "so2_total", type: "number" },
  { key: "l.alcohol", label: "Alcohol", category: "Lab", table: "lab_samples", column: "alcohol", type: "number" },
  { key: "l.rs", label: "RS", category: "Lab", table: "lab_samples", column: "rs", type: "number" },
  // Block
  { key: "b.name", label: "Block Name", category: "Block", table: "blocks", column: "name", type: "text" },
  { key: "b.variety", label: "Variety", category: "Block", table: "blocks", column: "variety", type: "text" },
  { key: "b.lifecycle_stage", label: "Lifecycle Stage", category: "Block", table: "blocks", column: "lifecycle_stage", type: "text" },
  { key: "b.acres", label: "Acres", category: "Block", table: "blocks", column: "acres", type: "number" },
  // Weather
  { key: "w.recorded_at", label: "Date", category: "Weather", table: "weather_readings", column: "recorded_at", type: "date" },
  { key: "w.temp_max_f", label: "High °F", category: "Weather", table: "weather_readings", column: "temp_max_f", type: "number" },
  { key: "w.temp_min_f", label: "Low °F", category: "Weather", table: "weather_readings", column: "temp_min_f", type: "number" },
  { key: "w.precip_inches", label: "Precip (in)", category: "Weather", table: "weather_readings", column: "precip_inches", type: "number" },
  { key: "w.gdd_cumulative", label: "GDD Cumulative", category: "Weather", table: "weather_readings", column: "gdd_cumulative", type: "number" },
  // Task
  { key: "t.title", label: "Task Title", category: "Task", table: "tasks", column: "title", type: "text" },
  { key: "t.due_date", label: "Due Date", category: "Task", table: "tasks", column: "due_date", type: "date" },
  { key: "t.status", label: "Task Status", category: "Task", table: "tasks", column: "status", type: "text" },
  { key: "t.assigned_to", label: "Assigned To", category: "Task", table: "tasks", column: "assigned_to", type: "text" },
  // Barrel
  { key: "br.barrel_id", label: "Barrel ID", category: "Barrel", table: "barrels", column: "barrel_id", type: "text" },
  { key: "br.type", label: "Barrel Type", category: "Barrel", table: "barrels", column: "type", type: "text" },
  { key: "br.cooperage", label: "Cooperage", category: "Barrel", table: "barrels", column: "cooperage", type: "text" },
  { key: "br.variety", label: "Barrel Variety", category: "Barrel", table: "barrels", column: "variety", type: "text" },
  { key: "br.status", label: "Barrel Status", category: "Barrel", table: "barrels", column: "status", type: "text" },
];

const CATEGORIES = [...new Set(FIELD_CATALOG.map((f) => f.category))];

const OPERATORS = [
  { value: "eq", label: "=" },
  { value: "gt", label: ">" },
  { value: "lt", label: "<" },
  { value: "gte", label: ">=" },
  { value: "lte", label: "<=" },
  { value: "ilike", label: "contains" },
];

interface ReportFilter {
  id: string;
  fieldKey: string;
  operator: string;
  value: string;
}

interface ReportConfig {
  fields: string[];
  filters: ReportFilter[];
  dateFrom?: string;
  dateTo?: string;
}

// ── Component ──────────────────────────────────────────────────────
export default function ReportsBuilder() {
  const { organization } = useAuth();
  const orgId = organization?.id;
  const qc = useQueryClient();

  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [filters, setFilters] = useState<ReportFilter[]>([]);
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [saveName, setSaveName] = useState("");
  const [saveOpen, setSaveOpen] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  // ── Saved reports ────────────────────────────────────────────────
  const { data: savedReports = [] } = useQuery({
    queryKey: ["saved-reports", orgId],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("saved_reports")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!orgId,
  });

  const saveMutation = useMutation({
    mutationFn: async (name: string) => {
      const config: ReportConfig = {
        fields: selectedFields,
        filters,
        dateFrom: dateFrom?.toISOString(),
        dateTo: dateTo?.toISOString(),
      };
      const { error } = await (supabase.from as any)("saved_reports").insert({
        org_id: orgId,
        name,
        config_json: config,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Report saved");
      setSaveOpen(false);
      setSaveName("");
      qc.invalidateQueries({ queryKey: ["saved-reports"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from as any)("saved_reports").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Report deleted");
      qc.invalidateQueries({ queryKey: ["saved-reports"] });
    },
  });

  const loadSavedReport = (config: ReportConfig) => {
    setSelectedFields(config.fields || []);
    setFilters(config.filters || []);
    setDateFrom(config.dateFrom ? new Date(config.dateFrom) : undefined);
    setDateTo(config.dateTo ? new Date(config.dateTo) : undefined);
  };

  // ── Determine which tables we need ───────────────────────────────
  const activeTables = useMemo(() => {
    const tables = new Set<string>();
    selectedFields.forEach((k) => {
      const f = FIELD_CATALOG.find((fd) => fd.key === k);
      if (f) tables.add(f.table);
    });
    return tables;
  }, [selectedFields]);

  // ── Data query ───────────────────────────────────────────────────
  const { data: reportData = [], isLoading: dataLoading } = useQuery({
    queryKey: ["report-data", selectedFields, filters, dateFrom?.toISOString(), dateTo?.toISOString(), orgId],
    queryFn: async () => {
      if (selectedFields.length === 0) return [];

      // Query each table separately, then join client-side
      const results: Record<string, any[]> = {};

      for (const table of activeTables) {
        const cols = FIELD_CATALOG.filter(
          (f) => selectedFields.includes(f.key) && f.table === table
        ).map((f) => f.column);

        // Add linking columns
        if (table === "lab_samples") cols.push("vintage_id");
        if (table === "blocks") cols.push("id", "vineyard_id");
        if (table === "vintages") cols.push("id", "block_id", "org_id");
        if (table === "weather_readings") cols.push("vineyard_id");
        if (table === "tasks") cols.push("id", "org_id");
        if (table === "barrels") cols.push("id", "org_id");

        const uniqueCols = [...new Set(cols)];
        let query = (supabase.from as any)(table).select(uniqueCols.join(",")).limit(50);

        // Apply filters for this table
        filters.forEach((fl) => {
          const fd = FIELD_CATALOG.find((f) => f.key === fl.fieldKey);
          if (!fd || fd.table !== table) return;
          const val = fd.type === "number" ? Number(fl.value) : fl.value;
          if (fl.operator === "eq") query = query.eq(fd.column, val);
          else if (fl.operator === "gt") query = query.gt(fd.column, val);
          else if (fl.operator === "lt") query = query.lt(fd.column, val);
          else if (fl.operator === "gte") query = query.gte(fd.column, val);
          else if (fl.operator === "lte") query = query.lte(fd.column, val);
          else if (fl.operator === "ilike") query = query.ilike(fd.column, `%${fl.value}%`);
        });

        // Date range for date fields
        if (dateFrom || dateTo) {
          const dateFields = FIELD_CATALOG.filter(
            (f) => selectedFields.includes(f.key) && f.table === table && f.type === "date"
          );
          dateFields.forEach((df) => {
            if (dateFrom) query = query.gte(df.column, dateFrom.toISOString());
            if (dateTo) query = query.lte(df.column, dateTo.toISOString());
          });
        }

        const { data, error } = await query;
        if (error) throw error;
        results[table] = data || [];
      }

      // If only one table, return directly
      const tableArr = [...activeTables];
      if (tableArr.length === 1) {
        return results[tableArr[0]].map((row) => {
          const mapped: Record<string, any> = {};
          selectedFields.forEach((k) => {
            const fd = FIELD_CATALOG.find((f) => f.key === k);
            if (fd && fd.table === tableArr[0]) mapped[k] = row[fd.column];
          });
          return mapped;
        });
      }

      // Multi-table: use the largest result set as base
      const primary = tableArr.sort(
        (a, b) => (results[b]?.length || 0) - (results[a]?.length || 0)
      )[0];

      return results[primary].slice(0, 50).map((row, idx) => {
        const mapped: Record<string, any> = {};
        selectedFields.forEach((k) => {
          const fd = FIELD_CATALOG.find((f) => f.key === k);
          if (!fd) return;
          if (fd.table === primary) {
            mapped[k] = row[fd.column];
          } else {
            const otherRows = results[fd.table] || [];
            const otherRow = otherRows[idx];
            mapped[k] = otherRow?.[fd.column] ?? "—";
          }
        });
        return mapped;
      });
    },
    enabled: selectedFields.length > 0 && !!orgId,
  });

  // ── Field management ─────────────────────────────────────────────
  const toggleField = (key: string) => {
    setSelectedFields((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const removeField = (key: string) => {
    setSelectedFields((prev) => prev.filter((k) => k !== key));
    setFilters((prev) => prev.filter((f) => f.fieldKey !== key));
  };

  const addFilter = () => {
    setFilters((prev) => [
      ...prev,
      { id: crypto.randomUUID(), fieldKey: selectedFields[0] || "", operator: "eq", value: "" },
    ]);
  };

  // ── Drag reorder ─────────────────────────────────────────────────
  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    const arr = [...selectedFields];
    const [moved] = arr.splice(dragIdx, 1);
    arr.splice(idx, 0, moved);
    setSelectedFields(arr);
    setDragIdx(idx);
  };
  const handleDragEnd = () => setDragIdx(null);

  // ── Export CSV ───────────────────────────────────────────────────
  const exportCsv = useCallback(() => {
    if (reportData.length === 0) return;
    const headers = selectedFields.map((k) => FIELD_CATALOG.find((f) => f.key === k)?.label || k);
    const rows = reportData.map((row: any) =>
      selectedFields.map((k) => {
        const v = row[k];
        return v === null || v === undefined ? "" : String(v);
      })
    );
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `solera-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [reportData, selectedFields]);

  // ── Export PDF ───────────────────────────────────────────────────
  const exportPdf = useCallback(() => {
    if (reportData.length === 0) return;
    const pw = window.open("", "_blank");
    if (!pw) { toast.error("Allow popups for PDF export"); return; }

    const headers = selectedFields.map((k) => FIELD_CATALOG.find((f) => f.key === k)?.label || k);
    const filterSummary = filters.length > 0
      ? filters.map((fl) => {
          const fd = FIELD_CATALOG.find((f) => f.key === fl.fieldKey);
          const op = OPERATORS.find((o) => o.value === fl.operator);
          return `${fd?.label || fl.fieldKey} ${op?.label || fl.operator} ${fl.value}`;
        }).join(", ")
      : "None";

    const tableRows = reportData.map((row: any) =>
      `<tr>${selectedFields.map((k) => `<td>${row[k] ?? "—"}</td>`).join("")}</tr>`
    ).join("");

    pw.document.write(`<!DOCTYPE html><html><head>
      <title>Solera Custom Report</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Source+Sans+3:wght@400;600&display=swap');
        body{font-family:'Source Sans 3',sans-serif;max-width:900px;margin:30px auto;padding:0 20px;color:#1a1a1a;font-size:12px}
        .hdr{border-bottom:2px solid hsl(348,58%,26%);padding-bottom:12px;margin-bottom:16px}
        .hdr h1{font-family:'Playfair Display',serif;font-size:22px;color:hsl(348,58%,26%);margin:0}
        .meta{font-size:11px;color:#666;margin-top:4px}
        table{width:100%;border-collapse:collapse;margin-top:12px}
        th{background:hsl(348,58%,26%);color:white;padding:6px 8px;text-align:left;font-size:11px}
        td{padding:5px 8px;border-bottom:1px solid #eee}
        tr:nth-child(even){background:#fafafa}
        .footer{margin-top:24px;border-top:1px solid #ddd;padding-top:8px;font-size:10px;color:#999}
        @media print{body{margin:10px}}
      </style>
    </head><body>
      <div class="hdr">
        <h1>Solera Custom Report</h1>
        <div class="meta">${organization?.name || "Winery"} — Generated ${format(new Date(), "MMMM d, yyyy")}</div>
        <div class="meta">Filters: ${filterSummary}${dateFrom ? ` | From: ${format(dateFrom, "MMM d, yyyy")}` : ""}${dateTo ? ` | To: ${format(dateTo, "MMM d, yyyy")}` : ""}</div>
        <div class="meta">${reportData.length} rows</div>
      </div>
      <table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${tableRows}</tbody></table>
      <div class="footer">Generated by Solera</div>
    </body></html>`);
    pw.document.close();
    setTimeout(() => pw.print(), 500);
  }, [reportData, selectedFields, filters, dateFrom, dateTo, organization]);

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Report Builder</h1>
          <p className="text-muted-foreground text-sm mt-1">Select fields, apply filters, preview and export</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        {/* ── Left Panel ─────────────────────────────────────────── */}
        <div className="space-y-4">
          {/* Field selector */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><Database className="h-4 w-4" /> Fields</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[320px]">
                {CATEGORIES.map((cat) => (
                  <div key={cat} className="px-3 pb-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 mt-2">{cat}</p>
                    <div className="flex flex-wrap gap-1">
                      {FIELD_CATALOG.filter((f) => f.category === cat).map((f) => (
                        <button
                          key={f.key}
                          onClick={() => toggleField(f.key)}
                          className={cn(
                            "text-xs px-2 py-1 rounded-md border transition-colors",
                            selectedFields.includes(f.key)
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-card text-foreground border-border hover:border-primary/50"
                          )}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Saved reports */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><FileText className="h-4 w-4" /> Saved Reports</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="max-h-[200px]">
                {savedReports.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-3">No saved reports yet</p>
                ) : (
                  savedReports.map((sr: any) => (
                    <div
                      key={sr.id}
                      className="flex items-center justify-between px-3 py-2 hover:bg-muted/50 cursor-pointer border-b border-border last:border-0"
                      onClick={() => loadSavedReport(sr.config_json as ReportConfig)}
                    >
                      <div className="flex items-center gap-2 text-sm min-w-0">
                        <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                        <span className="truncate">{sr.name}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(sr.id); }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* ── Right Panel ────────────────────────────────────────── */}
        <div className="space-y-4">
          {/* Selected columns + actions */}
          <Card>
            <CardContent className="pt-4 space-y-3">
              {/* Column chips */}
              <div className="flex flex-wrap gap-1.5 min-h-[32px]">
                {selectedFields.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Click fields on the left to add columns</p>
                ) : (
                  selectedFields.map((key, idx) => {
                    const fd = FIELD_CATALOG.find((f) => f.key === key);
                    return (
                      <Badge
                        key={key}
                        variant="secondary"
                        className="gap-1 cursor-grab active:cursor-grabbing select-none"
                        draggable
                        onDragStart={() => handleDragStart(idx)}
                        onDragOver={(e) => handleDragOver(e, idx)}
                        onDragEnd={handleDragEnd}
                      >
                        <GripVertical className="h-3 w-3 opacity-40" />
                        {fd?.label || key}
                        <button onClick={() => removeField(key)} className="ml-0.5 hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    );
                  })
                )}
              </div>

              <Separator />

              {/* Filters */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Filter className="h-3 w-3" /> Filters
                  </span>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={addFilter} disabled={selectedFields.length === 0}>
                    <Plus className="h-3 w-3 mr-1" /> Add Filter
                  </Button>
                </div>

                {filters.map((fl) => (
                  <div key={fl.id} className="flex items-center gap-2 flex-wrap">
                    <Select
                      value={fl.fieldKey}
                      onValueChange={(v) => setFilters((prev) => prev.map((f) => f.id === fl.id ? { ...f, fieldKey: v } : f))}
                    >
                      <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {selectedFields.map((k) => {
                          const fd = FIELD_CATALOG.find((f) => f.key === k);
                          return <SelectItem key={k} value={k}>{fd?.label || k}</SelectItem>;
                        })}
                      </SelectContent>
                    </Select>
                    <Select
                      value={fl.operator}
                      onValueChange={(v) => setFilters((prev) => prev.map((f) => f.id === fl.id ? { ...f, operator: v } : f))}
                    >
                      <SelectTrigger className="h-8 w-[80px] text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {OPERATORS.map((op) => <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input
                      value={fl.value}
                      onChange={(e) => setFilters((prev) => prev.map((f) => f.id === fl.id ? { ...f, value: e.target.value } : f))}
                      className="h-8 w-[120px] text-xs"
                      placeholder="Value..."
                    />
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setFilters((prev) => prev.filter((f) => f.id !== fl.id))}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>

              <Separator />

              {/* Date range + actions */}
              <div className="flex items-center gap-2 flex-wrap">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                      <CalendarIcon className="h-3 w-3" />
                      {dateFrom ? format(dateFrom, "MMM d") : "From"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>

                <span className="text-xs text-muted-foreground">→</span>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                      <CalendarIcon className="h-3 w-3" />
                      {dateTo ? format(dateTo, "MMM d") : "To"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dateTo} onSelect={setDateTo} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>

                <div className="flex-1" />

                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={exportCsv} disabled={reportData.length === 0}>
                  <Download className="h-3 w-3 mr-1" /> CSV
                </Button>
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={exportPdf} disabled={reportData.length === 0}>
                  <Download className="h-3 w-3 mr-1" /> PDF
                </Button>

                <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="h-8 text-xs" disabled={selectedFields.length === 0}>
                      <Save className="h-3 w-3 mr-1" /> Save
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Save Report</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <Input placeholder="Report name..." value={saveName} onChange={(e) => setSaveName(e.target.value)} />
                      <Button
                        className="w-full"
                        disabled={!saveName.trim() || saveMutation.isPending}
                        onClick={() => saveMutation.mutate(saveName.trim())}
                      >
                        {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Save Report
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>

          {/* Report preview table */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Preview</CardTitle>
                {reportData.length > 0 && (
                  <Badge variant="outline" className="text-[10px]">{reportData.length} rows</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {selectedFields.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground text-sm">
                  <Database className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  Select fields to build your report
                </div>
              ) : dataLoading ? (
                <div className="py-16 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></div>
              ) : reportData.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground text-sm">No data matches your criteria</div>
              ) : (
                <ScrollArea className="max-h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {selectedFields.map((k) => {
                          const fd = FIELD_CATALOG.find((f) => f.key === k);
                          return <TableHead key={k} className="text-xs whitespace-nowrap">{fd?.label || k}</TableHead>;
                        })}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportData.map((row: any, i: number) => (
                        <TableRow key={i}>
                          {selectedFields.map((k) => (
                            <TableCell key={k} className="text-xs whitespace-nowrap">
                              {row[k] === null || row[k] === undefined ? "—" : String(row[k])}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
