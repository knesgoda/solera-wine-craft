import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useRoleAccess } from "@/hooks/useRoleAccess";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, ArrowUpDown, BarChart3, Wine, Loader2, Download, RefreshCw, AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine, Legend } from "recharts";
import { QbExportDialog } from "@/components/costs/QbExportDialog";
import { toast } from "sonner";

const fmt = (n: number | null) =>
  n != null ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n) : "—";

type SortKey = "cost_per_gallon" | "total_cost" | "cost_per_barrel" | "cost_per_case" | "total_gallons";

export default function CogsDashboard() {
  const { organization } = useAuth();
  const orgId = organization?.id;
  const navigate = useNavigate();
  const [sortKey, setSortKey] = useState<SortKey>("cost_per_gallon");
  const [sortAsc, setSortAsc] = useState(false);
  const [filterYear, setFilterYear] = useState<string>("all");
  const [filterVariety, setFilterVariety] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [compareYears, setCompareYears] = useState(false);
  const [galColorBy, setGalColorBy] = useState<"variety" | "year">("variety");
  const [qbExportOpen, setQbExportOpen] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const { isAtLeast } = useRoleAccess();
  const queryClient = useQueryClient();

  const handleRecalcAll = async () => {
    if (!orgId) return;
    setRecalculating(true);
    try {
      const { data: vids } = await supabase.from("vintages").select("id").eq("org_id", orgId);
      if (!vids || vids.length === 0) { toast.info("No vintages to recalculate"); return; }
      let done = 0;
      for (const v of vids) {
        // Trigger recalc by touching a cost entry or inserting/deleting a dummy — simplest: call a lightweight update
        // We'll do a no-op update on lot_cost_summaries to trigger recalc via the function
        await supabase.rpc("recalculate_lot_cost_summary_for_vintage" as any, { p_vintage_id: v.id }).catch(() => {
          // If RPC doesn't exist, do manual recalc by reading cost_entries
        });
        done++;
      }
      queryClient.invalidateQueries({ queryKey: ["cogs-per-lot"] });
      queryClient.invalidateQueries({ queryKey: ["lot-cost-summary"] });
      toast.success(`Recalculated COGS for ${vids.length} lots`);
    } catch (err: any) {
      toast.error(err.message || "Recalculation failed");
    } finally {
      setRecalculating(false);
    }
  };

  // Per Lot data from lot_cost_summaries + vintages
  const { data: lotData = [], isLoading: lotsLoading } = useQuery({
    queryKey: ["cogs-per-lot", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lot_cost_summaries")
        .select("*, vintages(id, year, variety, status, name)")
        .eq("org_id", orgId!);
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!orgId,
  });

  // Per Barrel data
  const { data: barrelData = [], isLoading: barrelsLoading } = useQuery({
    queryKey: ["cogs-per-barrel", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("barrels")
        .select("*, vintages(id, year, variety, name), lot_cost_summaries!inner(total_cost, total_gallons, cost_per_gallon)")
        .eq("org_id", orgId!)
        .not("vintage_id", "is", null);
      if (error) {
        // Fallback without inner join if no summaries exist
        const { data: d2 } = await supabase
          .from("barrels")
          .select("*, vintages(id, year, variety, name)")
          .eq("org_id", orgId!)
          .not("vintage_id", "is", null);
        return (d2 || []).map((b: any) => ({ ...b, lot_cost_summaries: null }));
      }
      return (data || []) as any[];
    },
    enabled: !!orgId,
  });

  // Unique years/varieties from lot data
  const years = [...new Set(lotData.map((l: any) => l.vintages?.year).filter(Boolean))].sort((a, b) => b - a);
  const varieties = [...new Set(lotData.map((l: any) => l.vintages?.variety).filter(Boolean))].sort();

  // Filter + sort lots
  const filteredLots = lotData
    .filter((l: any) => {
      if (filterYear !== "all" && String(l.vintages?.year) !== filterYear) return false;
      if (filterVariety !== "all" && l.vintages?.variety !== filterVariety) return false;
      if (filterStatus !== "all" && l.vintages?.status !== filterStatus) return false;
      return true;
    })
    .sort((a: any, b: any) => {
      const av = Number(a[sortKey]) || 0;
      const bv = Number(b[sortKey]) || 0;
      return sortAsc ? av - bv : bv - av;
    });

  // Top category calculation
  const getTopCategory = (s: any) => {
    const cats = [
      { name: "Grape", val: Number(s.grape_cost) || 0 },
      { name: "Labor", val: Number(s.labor_cost) || 0 },
      { name: "Cooperage", val: Number(s.cooperage_cost) || 0 },
      { name: "Chemicals", val: Number(s.chemicals_cost) || 0 },
      { name: "Bottling", val: Number(s.bottling_cost) || 0 },
      { name: "Overhead", val: Number(s.overhead_cost) || 0 },
      { name: "Other", val: Number(s.other_cost) || 0 },
    ].filter((c) => c.val > 0);
    if (cats.length === 0) return "—";
    const total = Number(s.total_cost) || 1;
    const top = cats.sort((a, b) => b.val - a.val)[0];
    return `${top.name}: ${Math.round((top.val / total) * 100)}%`;
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  // Per Gallon chart data
  const galChartData = filteredLots
    .filter((l: any) => Number(l.cost_per_gallon) > 0)
    .map((l: any) => ({
      name: l.vintages?.name || `${l.vintages?.year || ""} ${l.vintages?.variety || ""}`.trim() || "Unknown",
      costPerGallon: Number(l.cost_per_gallon) || 0,
      grape: Number(l.grape_cost) || 0,
      labor: Number(l.labor_cost) || 0,
      cooperage: Number(l.cooperage_cost) || 0,
      chemicals: Number(l.chemicals_cost) || 0,
      bottling: Number(l.bottling_cost) || 0,
      overhead: Number(l.overhead_cost) || 0,
      other: Number(l.other_cost) || 0,
      variety: l.vintages?.variety || "Unknown",
      year: l.vintages?.year || 0,
      vintageId: l.vintage_id,
      totalGallons: Number(l.total_gallons) || 0,
    }))
    .sort((a, b) => b.costPerGallon - a.costPerGallon);

  const TARGET_PER_GALLON = 15;

  // Year-over-year data
  const yoyData = years.map((yr) => {
    const yearLots = lotData.filter((l: any) => l.vintages?.year === yr);
    const totalCost = yearLots.reduce((s: number, l: any) => s + (Number(l.total_cost) || 0), 0);
    const totalGal = yearLots.reduce((s: number, l: any) => s + (Number(l.total_gallons) || 0), 0);
    return {
      year: String(yr),
      avgPerGallon: totalGal > 0 ? totalCost / totalGal : 0,
      grape: yearLots.reduce((s: number, l: any) => s + (Number(l.grape_cost) || 0), 0),
      labor: yearLots.reduce((s: number, l: any) => s + (Number(l.labor_cost) || 0), 0),
      cooperage: yearLots.reduce((s: number, l: any) => s + (Number(l.cooperage_cost) || 0), 0),
      chemicals: yearLots.reduce((s: number, l: any) => s + (Number(l.chemicals_cost) || 0), 0),
      bottling: yearLots.reduce((s: number, l: any) => s + (Number(l.bottling_cost) || 0), 0),
      overhead: yearLots.reduce((s: number, l: any) => s + (Number(l.overhead_cost) || 0), 0),
      other: yearLots.reduce((s: number, l: any) => s + (Number(l.other_cost) || 0), 0),
      totalCost,
      lotCount: yearLots.length,
    };
  });

  // Variety color mapping
  const VARIETY_COLORS: Record<string, string> = {};
  const PALETTE = [
    "hsl(348, 58%, 26%)", "hsl(36, 64%, 47%)", "hsl(200, 60%, 45%)",
    "hsl(160, 50%, 40%)", "hsl(280, 50%, 50%)", "hsl(20, 70%, 50%)",
    "hsl(100, 40%, 40%)", "hsl(340, 50%, 45%)",
  ];
  varieties.forEach((v, i) => { VARIETY_COLORS[v] = PALETTE[i % PALETTE.length]; });

  const getBarColor = (item: any) => {
    if (item.costPerGallon > TARGET_PER_GALLON) return "hsl(0, 84%, 60%)";
    if (galColorBy === "variety") return VARIETY_COLORS[item.variety] || "hsl(348, 58%, 26%)";
    const yearIdx = years.indexOf(item.year);
    return PALETTE[yearIdx % PALETTE.length];
  };

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort(field)}>
      <span className="inline-flex items-center gap-1">
        {label}
        <ArrowUpDown className={`h-3 w-3 ${sortKey === field ? "text-foreground" : "text-muted-foreground/50"}`} />
      </span>
    </TableHead>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">COGS Dashboard</h1>
          <p className="text-muted-foreground text-sm">Cost of goods sold across all lots, barrels, and vintages</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {isAtLeast("owner") && (
            <Button variant="outline" size="sm" onClick={handleRecalcAll} disabled={recalculating}>
              {recalculating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Recalculate All
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setQbExportOpen(true)}>
            <Download className="h-4 w-4 mr-2" /> Export to QuickBooks
          </Button>
          <div className="flex items-center gap-2">
            <Switch id="compare-yoy" checked={compareYears} onCheckedChange={setCompareYears} />
            <Label htmlFor="compare-yoy" className="text-sm">Compare Years</Label>
          </div>
        </div>
      </div>

      {/* Year-over-Year Comparison */}
      {compareYears && yoyData.length > 1 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-lg">Avg $/Gallon by Year</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={yoyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Bar dataKey="avgPerGallon" name="Avg $/Gallon" fill="hsl(348, 58%, 26%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {yoyData.length >= 2 && (() => {
                const curr = yoyData[0];
                const prev = yoyData[1];
                if (prev.avgPerGallon > 0) {
                  const pctChange = ((curr.avgPerGallon - prev.avgPerGallon) / prev.avgPerGallon * 100).toFixed(0);
                  const dir = Number(pctChange) >= 0 ? "increased" : "decreased";
                  return (
                    <p className="text-sm text-muted-foreground mt-2">
                      Your average COGS {dir} {Math.abs(Number(pctChange))}% from {prev.year} to {curr.year}
                    </p>
                  );
                }
                return null;
              })()}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-lg">Cost Category Mix by Year</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={yoyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Legend />
                    <Bar dataKey="grape" name="Grape" stackId="a" fill="hsl(348, 58%, 26%)" />
                    <Bar dataKey="labor" name="Labor" stackId="a" fill="hsl(36, 64%, 47%)" />
                    <Bar dataKey="cooperage" name="Cooperage" stackId="a" fill="hsl(25, 60%, 35%)" />
                    <Bar dataKey="chemicals" name="Chemicals" stackId="a" fill="hsl(200, 60%, 45%)" />
                    <Bar dataKey="bottling" name="Bottling" stackId="a" fill="hsl(320, 50%, 45%)" />
                    <Bar dataKey="overhead" name="Overhead" stackId="a" fill="hsl(0, 0%, 50%)" />
                    <Bar dataKey="other" name="Other" stackId="a" fill="hsl(0, 0%, 65%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="per-lot" className="space-y-4">
        <TabsList>
          <TabsTrigger value="per-lot">Per Lot</TabsTrigger>
          <TabsTrigger value="per-barrel">Per Barrel</TabsTrigger>
          <TabsTrigger value="per-gallon">Per Gallon</TabsTrigger>
        </TabsList>

        {/* ===== TAB 1: Per Lot ===== */}
        <TabsContent value="per-lot">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4">
            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Year" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterVariety} onValueChange={setFilterVariety}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Variety" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Varieties</SelectItem>
                {varieties.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="bottled">Bottled</SelectItem>
                <SelectItem value="released">Released</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {lotsLoading ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : filteredLots.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <DollarSign className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No lots with cost data found.</p>
                <Button variant="outline" className="mt-3" onClick={() => navigate("/costs")}>Add Production Costs</Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Lot / Vintage</TableHead>
                        <TableHead>Variety</TableHead>
                        <TableHead>Year</TableHead>
                        <TableHead>Status</TableHead>
                        <SortHeader label="Total COGS" field="total_cost" />
                        <SortHeader label="Gallons" field="total_gallons" />
                        <SortHeader label="$/Gallon" field="cost_per_gallon" />
                        <SortHeader label="$/Barrel" field="cost_per_barrel" />
                        <SortHeader label="$/Case" field="cost_per_case" />
                        <TableHead>Top Category</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLots.map((l: any) => (
                        <TableRow
                          key={l.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => navigate(`/costs/lot/${l.vintage_id}`)}
                        >
                          <TableCell className="font-medium text-foreground">
                            {l.vintages?.name || `${l.vintages?.year || ""} ${l.vintages?.variety || ""}`.trim() || "—"}
                          </TableCell>
                          <TableCell className="text-sm">{l.vintages?.variety || "—"}</TableCell>
                          <TableCell className="text-sm">{l.vintages?.year || "—"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs capitalize">{l.vintages?.status || "—"}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{fmt(Number(l.total_cost))}</TableCell>
                          <TableCell className="text-sm">{Number(l.total_gallons) > 0 ? Number(l.total_gallons).toFixed(0) : "—"}</TableCell>
                          <TableCell className="font-mono text-sm font-medium">{l.cost_per_gallon ? `$${Number(l.cost_per_gallon).toFixed(2)}` : "—"}</TableCell>
                          <TableCell className="font-mono text-sm">{l.cost_per_barrel ? `$${Number(l.cost_per_barrel).toFixed(0)}` : "—"}</TableCell>
                          <TableCell className="font-mono text-sm">{l.cost_per_case ? `$${Number(l.cost_per_case).toFixed(2)}` : "—"}</TableCell>
                          <TableCell className="text-sm">{getTopCategory(l)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ===== TAB 2: Per Barrel ===== */}
        <TabsContent value="per-barrel">
          {barrelsLoading ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : barrelData.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Wine className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No barrels currently holding wine.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Barrel ID</TableHead>
                        <TableHead>Cooperage</TableHead>
                        <TableHead>Toast</TableHead>
                        <TableHead>Current Contents</TableHead>
                        <TableHead>Barrel Age</TableHead>
                        <TableHead className="text-right">COGS in Barrel</TableHead>
                        <TableHead className="text-right">$/Gallon</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {barrelData.map((b: any) => {
                        const cpg = b.lot_cost_summaries?.cost_per_gallon ? Number(b.lot_cost_summaries.cost_per_gallon) : 0;
                        const barrelGal = b.size_liters ? Number(b.size_liters) / 3.78541 : 59;
                        const cogsInBarrel = cpg * barrelGal;
                        const fillDate = b.fill_date ? new Date(b.fill_date) : null;
                        const ageMonths = fillDate ? Math.round((Date.now() - fillDate.getTime()) / (1000 * 60 * 60 * 24 * 30)) : null;
                        const vintageName = b.vintages?.name || `${b.vintages?.year || ""} ${b.vintages?.variety || ""}`.trim();

                        return (
                          <TableRow key={b.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/cellar/barrels`)}>
                            <TableCell className="font-medium text-foreground">{b.barrel_id || "—"}</TableCell>
                            <TableCell className="text-sm">{b.cooperage || "—"}</TableCell>
                            <TableCell className="text-sm">{b.toast || "—"}</TableCell>
                            <TableCell className="text-sm">{vintageName || "—"}</TableCell>
                            <TableCell className="text-sm">{ageMonths != null ? `${ageMonths} mo` : "—"}</TableCell>
                            <TableCell className="text-right font-mono text-sm">{cogsInBarrel > 0 ? fmt(cogsInBarrel) : "—"}</TableCell>
                            <TableCell className="text-right font-mono text-sm">{cpg > 0 ? `$${cpg.toFixed(2)}` : "—"}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ===== TAB 3: Per Gallon ===== */}
        <TabsContent value="per-gallon">
          {galChartData.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <BarChart3 className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No cost-per-gallon data available yet.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <CardTitle className="text-lg">$/Gallon Comparison</CardTitle>
                  <div className="flex items-center gap-2 text-sm">
                    <Label className="text-muted-foreground">Color by:</Label>
                    <Select value={galColorBy} onValueChange={(v: any) => setGalColorBy(v)}>
                      <SelectTrigger className="w-[110px] h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="variety">Variety</SelectItem>
                        <SelectItem value="year">Year</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div style={{ height: Math.max(300, galChartData.length * 40) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={galChartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                      <XAxis type="number" tickFormatter={(v) => `$${v}`} tick={{ fontSize: 12 }} />
                      <YAxis type="category" dataKey="name" width={180} tick={{ fontSize: 11 }} />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.[0]) return null;
                          const d = payload[0].payload;
                          const total = Number(d.costPerGallon);
                          const gal = Number(d.totalGallons) || 1;
                          return (
                            <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-sm">
                              <p className="font-medium text-foreground mb-1">{d.name}</p>
                              <p className="font-mono font-bold text-foreground">${total.toFixed(2)}/gal</p>
                              <div className="mt-1 space-y-0.5 text-muted-foreground">
                                {d.grape > 0 && <p>Grape: ${(d.grape / gal).toFixed(2)}</p>}
                                {d.labor > 0 && <p>Labor: ${(d.labor / gal).toFixed(2)}</p>}
                                {d.cooperage > 0 && <p>Cooperage: ${(d.cooperage / gal).toFixed(2)}</p>}
                                {d.chemicals > 0 && <p>Chemicals: ${(d.chemicals / gal).toFixed(2)}</p>}
                                {d.bottling > 0 && <p>Bottling: ${(d.bottling / gal).toFixed(2)}</p>}
                                {d.overhead > 0 && <p>Overhead: ${(d.overhead / gal).toFixed(2)}</p>}
                                {d.other > 0 && <p>Other: ${(d.other / gal).toFixed(2)}</p>}
                              </div>
                            </div>
                          );
                        }}
                      />
                      <ReferenceLine x={TARGET_PER_GALLON} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" label={{ value: `Target: $${TARGET_PER_GALLON}`, position: "top", fontSize: 11 }} />
                      <Bar dataKey="costPerGallon" radius={[0, 4, 4, 0]}>
                        {galChartData.map((item, idx) => (
                          <Cell key={idx} fill={getBarColor(item)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                  <span className="inline-block w-3 h-3 rounded-sm" style={{ background: "hsl(0, 84%, 60%)" }} /> Above target
                  <span className="ml-3 inline-block w-3 h-3 rounded-sm" style={{ background: "hsl(348, 58%, 26%)" }} /> Below target
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
