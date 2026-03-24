import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, ChevronDown, ChevronUp, Zap } from "lucide-react";
import { TierRangeBar } from "@/components/growers/TierRangeBar";

export interface MetricForm {
  id?: string;
  metric_name: string;
  metric_key: string;
  unit: string;
  direction: "higher_is_better" | "lower_is_better";
  weight: number;
  sort_order: number;
  tiers: TierForm[];
}

export interface TierForm {
  id?: string;
  tier_label: string;
  min_value: string;
  max_value: string;
  price_adjustment: string;
  is_reject: boolean;
  sort_order: number;
}

export interface GradingScaleForm {
  enabled: boolean;
  id?: string;
  name: string;
  description: string;
  is_template: boolean;
  metrics: MetricForm[];
}

const PRESETS: Array<{ name: string; key: string; unit: string; direction: "higher_is_better" | "lower_is_better" }> = [
  { name: "Brix", key: "brix", unit: "°Bx", direction: "higher_is_better" },
  { name: "MOG (%)", key: "mog", unit: "%", direction: "lower_is_better" },
  { name: "Total Acidity", key: "ta", unit: "g/L", direction: "lower_is_better" },
  { name: "pH", key: "ph", unit: "pH", direction: "lower_is_better" },
  { name: "Berry Size", key: "berry_size", unit: "mm", direction: "lower_is_better" },
];

function toSlug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

const emptyTier = (): TierForm => ({
  tier_label: "",
  min_value: "",
  max_value: "",
  price_adjustment: "0",
  is_reject: false,
  sort_order: 0,
});

const emptyMetric = (): MetricForm => ({
  metric_name: "",
  metric_key: "",
  unit: "",
  direction: "higher_is_better",
  weight: 1,
  sort_order: 0,
  tiers: [],
});

interface GradingScaleBuilderProps {
  scale: GradingScaleForm;
  onChange: (scale: GradingScaleForm) => void;
  templates: Array<{ id: string; name: string; grading_scale_metrics?: any[] }>;
}

export function GradingScaleBuilder({ scale, onChange, templates }: GradingScaleBuilderProps) {
  const [expandedMetric, setExpandedMetric] = useState<number | null>(0);

  const updateScale = (patch: Partial<GradingScaleForm>) => onChange({ ...scale, ...patch });

  const updateMetric = (idx: number, patch: Partial<MetricForm>) => {
    const metrics = [...scale.metrics];
    metrics[idx] = { ...metrics[idx], ...patch };
    updateScale({ metrics });
  };

  const addMetric = (preset?: typeof PRESETS[0]) => {
    const m = emptyMetric();
    if (preset) {
      m.metric_name = preset.name;
      m.metric_key = preset.key;
      m.unit = preset.unit;
      m.direction = preset.direction;
    }
    m.sort_order = scale.metrics.length;
    const metrics = [...scale.metrics, m];
    updateScale({ metrics });
    setExpandedMetric(metrics.length - 1);
  };

  const removeMetric = (idx: number) => {
    const metrics = scale.metrics.filter((_, i) => i !== idx);
    updateScale({ metrics });
    if (expandedMetric === idx) setExpandedMetric(null);
  };

  const addTier = (metricIdx: number) => {
    const metrics = [...scale.metrics];
    const t = emptyTier();
    t.sort_order = metrics[metricIdx].tiers.length;
    metrics[metricIdx] = { ...metrics[metricIdx], tiers: [...metrics[metricIdx].tiers, t] };
    updateScale({ metrics });
  };

  const updateTier = (metricIdx: number, tierIdx: number, patch: Partial<TierForm>) => {
    const metrics = [...scale.metrics];
    const tiers = [...metrics[metricIdx].tiers];
    tiers[tierIdx] = { ...tiers[tierIdx], ...patch };
    metrics[metricIdx] = { ...metrics[metricIdx], tiers };
    updateScale({ metrics });
  };

  const removeTier = (metricIdx: number, tierIdx: number) => {
    const metrics = [...scale.metrics];
    metrics[metricIdx] = { ...metrics[metricIdx], tiers: metrics[metricIdx].tiers.filter((_, i) => i !== tierIdx) };
    updateScale({ metrics });
  };

  const loadTemplate = (templateId: string) => {
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl || !tpl.grading_scale_metrics) return;
    const metrics: MetricForm[] = tpl.grading_scale_metrics.map((m: any, i: number) => ({
      metric_name: m.metric_name,
      metric_key: m.metric_key,
      unit: m.unit || "",
      direction: m.direction,
      weight: Number(m.weight) || 1,
      sort_order: i,
      tiers: (m.grading_scale_tiers || []).map((t: any, j: number) => ({
        tier_label: t.tier_label,
        min_value: t.min_value != null ? String(t.min_value) : "",
        max_value: t.max_value != null ? String(t.max_value) : "",
        price_adjustment: String(t.price_adjustment || 0),
        is_reject: t.is_reject || false,
        sort_order: j,
      })),
    }));
    updateScale({ name: tpl.name || scale.name, metrics });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Grading Scale</CardTitle>
          <div className="flex items-center gap-2">
            <Label htmlFor="enable-grading" className="text-sm">Enable Grading</Label>
            <Switch id="enable-grading" checked={scale.enabled} onCheckedChange={(v) => updateScale({ enabled: v })} />
          </div>
        </div>
      </CardHeader>

      {scale.enabled && (
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Scale Name *</Label>
              <Input value={scale.name} onChange={(e) => updateScale({ name: e.target.value })} placeholder="e.g. 2026 Cab Sauv Grading" />
            </div>
            {templates.length > 0 && (
              <div>
                <Label>Use Template</Label>
                <Select onValueChange={loadTemplate}>
                  <SelectTrigger><SelectValue placeholder="Clone from template…" /></SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="save-template"
              checked={scale.is_template}
              onCheckedChange={(v) => updateScale({ is_template: !!v })}
            />
            <Label htmlFor="save-template" className="text-sm">Save as reusable template</Label>
          </div>

          {/* Metrics */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm">Metrics</h4>
              <div className="flex gap-2">
                <Select onValueChange={(key) => { const p = PRESETS.find((pr) => pr.key === key); if (p) addMetric(p); }}>
                  <SelectTrigger className="w-36 h-8 text-xs">
                    <Zap className="mr-1 h-3 w-3" />
                    <SelectValue placeholder="Quick Add" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRESETS.map((p) => (
                      <SelectItem key={p.key} value={p.key}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" onClick={() => addMetric()}>
                  <Plus className="mr-1 h-3 w-3" /> Add Metric
                </Button>
              </div>
            </div>

            {scale.metrics.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6 border-2 border-dashed rounded-lg">
                No metrics added. Use Quick Add or click Add Metric.
              </p>
            )}

            {scale.metrics.map((metric, mi) => (
              <Card key={mi} className="border">
                <div
                  className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedMetric(expandedMetric === mi ? null : mi)}
                >
                  <div className="flex items-center gap-2">
                    {expandedMetric === mi ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    <span className="font-medium text-sm">
                      {metric.metric_name || "Unnamed Metric"}
                      {metric.unit && <span className="text-muted-foreground ml-1">({metric.unit})</span>}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {metric.direction === "higher_is_better" ? "↑ Higher is better" : "↓ Lower is better"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{metric.tiers.length} tiers</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive h-7 w-7 p-0"
                      onClick={(e) => { e.stopPropagation(); removeMetric(mi); }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {expandedMetric === mi && (
                  <CardContent className="pt-0 space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      <div>
                        <Label className="text-xs">Name *</Label>
                        <Input
                          value={metric.metric_name}
                          onChange={(e) => updateMetric(mi, { metric_name: e.target.value, metric_key: toSlug(e.target.value) })}
                          placeholder="e.g. Brix"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Key</Label>
                        <Input
                          value={metric.metric_key}
                          onChange={(e) => updateMetric(mi, { metric_key: e.target.value })}
                          placeholder="brix"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Unit</Label>
                        <Input value={metric.unit} onChange={(e) => updateMetric(mi, { unit: e.target.value })} placeholder="°Bx" />
                      </div>
                      <div>
                        <Label className="text-xs">Direction</Label>
                        <Select value={metric.direction} onValueChange={(v: any) => updateMetric(mi, { direction: v })}>
                          <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="higher_is_better">Higher is Better</SelectItem>
                            <SelectItem value="lower_is_better">Lower is Better</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Weight</Label>
                        <Input type="number" step="0.1" min="0" value={metric.weight} onChange={(e) => updateMetric(mi, { weight: parseFloat(e.target.value) || 1 })} />
                      </div>
                    </div>

                    {/* Tiers */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-xs font-semibold">Tiers</Label>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => addTier(mi)}>
                          <Plus className="mr-1 h-3 w-3" /> Add Tier
                        </Button>
                      </div>

                      {metric.tiers.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4 border border-dashed rounded">
                          Add at least 2 tiers to define grading ranges.
                        </p>
                      ) : (
                        <div className="rounded-md border overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs">Label</TableHead>
                                <TableHead className="text-xs">Min</TableHead>
                                <TableHead className="text-xs">Max</TableHead>
                                <TableHead className="text-xs">$/Adjustment</TableHead>
                                <TableHead className="text-xs">Reject</TableHead>
                                <TableHead className="text-xs w-8"></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {metric.tiers.map((tier, ti) => (
                                <TableRow key={ti}>
                                  <TableCell className="py-1">
                                    <Input className="h-8 text-sm" value={tier.tier_label} onChange={(e) => updateTier(mi, ti, { tier_label: e.target.value })} placeholder="Premium" />
                                  </TableCell>
                                  <TableCell className="py-1">
                                    <Input className="h-8 text-sm w-20" type="number" step="0.01" value={tier.min_value} onChange={(e) => updateTier(mi, ti, { min_value: e.target.value })} placeholder="—" />
                                  </TableCell>
                                  <TableCell className="py-1">
                                    <Input className="h-8 text-sm w-20" type="number" step="0.01" value={tier.max_value} onChange={(e) => updateTier(mi, ti, { max_value: e.target.value })} placeholder="—" />
                                  </TableCell>
                                  <TableCell className="py-1">
                                    <Input
                                      className="h-8 text-sm w-24"
                                      type="number"
                                      step="1"
                                      value={tier.price_adjustment}
                                      onChange={(e) => updateTier(mi, ti, { price_adjustment: e.target.value })}
                                      disabled={tier.is_reject}
                                    />
                                  </TableCell>
                                  <TableCell className="py-1">
                                    <Checkbox checked={tier.is_reject} onCheckedChange={(v) => updateTier(mi, ti, { is_reject: !!v })} />
                                  </TableCell>
                                  <TableCell className="py-1">
                                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => removeTier(mi, ti)}>
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}

                      {metric.tiers.length > 0 && (
                        <TierRangeBar
                          direction={metric.direction}
                          tiers={metric.tiers.map((t) => ({
                            tier_label: t.tier_label,
                            min_value: t.min_value ? parseFloat(t.min_value) : null,
                            max_value: t.max_value ? parseFloat(t.max_value) : null,
                            price_adjustment: parseFloat(t.price_adjustment) || 0,
                            is_reject: t.is_reject,
                          }))}
                        />
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
