import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Loader2, Sparkles, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { Mapping } from "@/pages/DataImport";

const targetOptions: Record<string, string[]> = {
  vintages: ["year", "name", "status", "harvest_date", "tons_harvested", "notes", "gallons", "cases_projected", "pick_date", "press_date", "winemaker_notes", "variety", "clone", "rootstock", "fermentation_start", "ml_complete", "bottling_target", "external_vintage_id", "external_lot_id"],
  lab_samples: ["vintage_name", "lot_name", "sampled_at", "brix", "ph", "ta", "va", "so2_free", "so2_total", "alcohol", "rs", "notes", "sampled_by", "gdd_cumulative", "block_name", "external_sample_id", "external_block_id"],
  blocks: ["name", "vineyard_name", "variety", "clone", "rootstock", "acres", "status", "lifecycle_stage", "soil_ph", "soil_texture", "soil_organic_matter", "row_spacing_ft", "vine_spacing_ft", "year_planted", "exposure", "elevation_ft", "irrigation", "drainage", "notes", "external_block_id"],
  barrels: ["barrel_id", "type", "cooperage", "toast", "size_liters", "variety", "status"],
  fermentation_vessels: ["name", "capacity_liters", "material", "vessel_type", "status", "location", "capacity_gallons", "notes", "temp_controlled", "current_fill_gal", "external_vessel_id"],
  ttb_additions: ["added_at", "addition_type", "ttb_code", "amount", "unit", "batch_size", "added_by"],
  inventory_skus: ["label", "variety", "vintage_year", "cases", "bottles", "price"],
  vineyards: ["name", "region", "acres", "notes"],
  tasks: ["title", "due_date", "status", "instructions", "category", "priority", "assigned_to_name", "external_task_id", "source_reference"],
  grower_contracts: ["external_contract_id", "grower_name", "source_vineyard_name", "ava", "variety", "clone", "rootstock", "contracted_tons", "price_per_ton", "contract_value", "vintage_year", "status", "approval_status", "delivery_date", "tons_delivered", "payment_due_date", "payment_status", "contract_type", "notes"],
  harvest_progress: ["external_progress_id", "block_id", "block_name", "variety", "clone", "rootstock", "vintage_year", "acres", "expected_tons", "tons_harvested", "harvest_complete", "pick_date", "brix_at_pick", "notes"],
  harvest_predictions: ["external_prediction_id", "block_id", "block_name", "variety", "clone", "rootstock", "vintage_year", "current_brix", "current_ph", "current_ta", "brix_per_day", "target_brix", "predicted_pick_date", "days_to_target", "gdd_at_prediction", "confidence", "last_updated", "notes"],
  pick_windows: ["external_window_id", "block_id", "block_name", "variety", "clone", "rootstock", "current_brix", "target_brix_low", "target_brix_high", "current_ph", "target_ph_low", "target_ph_high", "current_ta", "brix_per_day", "days_to_window_open", "days_to_window_close", "window_open_date", "window_close_date", "window_status", "urgency", "notes"],
};

const allTargets = Object.entries(targetOptions).flatMap(([table, fields]) =>
  fields.map((f) => ({ value: `${table}.${f}`, label: `${table} → ${f}` }))
);

interface Props {
  mappings: Mapping[];
  setMappings: (m: Mapping[]) => void;
  isLoading: boolean;
  onConfirm: () => void;
  onBack: () => void;
}

const confBadge = (c: string) => {
  if (c === "high") return <Badge className="bg-green-100 text-green-800">High</Badge>;
  if (c === "medium") return <Badge className="bg-secondary/20 text-secondary">Medium</Badge>;
  return <Badge variant="outline">Unmapped</Badge>;
};

// Detect validation warnings based on current mappings
function getValidationWarnings(mappings: Mapping[]): string[] {
  const warnings: string[] = [];
  const mappedTables = new Set(mappings.filter(m => m.target_table).map(m => m.target_table!));

  // Blocks must have vineyard reference
  if (mappedTables.has("blocks")) {
    const hasVineyard = mappings.some(m => m.target_table === "blocks" && (m.target_field === "vineyard_name" || m.target_field === "vineyard_id"));
    if (!hasVineyard) {
      warnings.push("Blocks import requires a vineyard name or ID. Map a column to blocks → vineyard_name.");
    }
  }

  // Lab samples must have vintage or block reference
  if (mappedTables.has("lab_samples")) {
    const hasVintageRef = mappings.some(m =>
      m.target_table === "lab_samples" &&
      (m.target_field === "vintage_name" || m.target_field === "lot_name" || m.target_field === "block_name" || m.target_field === "external_block_id")
    );
    if (!hasVintageRef) {
      warnings.push("Lab samples require a vintage/lot name, block name, or block ID. Map a column to lab_samples → vintage_name, lot_name, block_name, or external_block_id.");
    }
  }

  // Check for mappings split across many unrelated tables
  if (mappedTables.size > 2) {
    warnings.push(`Mappings target ${mappedTables.size} different tables (${[...mappedTables].join(", ")}). This may indicate misrouted columns — review carefully.`);
  }

  return warnings;
}

export function MappingReview({ mappings, setMappings, isLoading, onConfirm, onBack }: Props) {
  const updateMapping = (idx: number, value: string) => {
    const updated = [...mappings];
    if (value === "unmapped") {
      updated[idx] = { ...updated[idx], target_table: null, target_field: null, confidence: "unmapped", overridden_by_user: true };
    } else {
      const [table, field] = value.split(".");
      updated[idx] = { ...updated[idx], target_table: table, target_field: field, confidence: "high", overridden_by_user: true };
    }
    setMappings(updated);
  };

  const currentValue = (m: Mapping) => m.target_table && m.target_field ? `${m.target_table}.${m.target_field}` : "unmapped";

  // Detect target table for summary
  const targetTables = [...new Set(mappings.filter(m => m.target_table).map(m => m.target_table!))];
  const warnings = isLoading ? [] : getValidationWarnings(mappings);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-secondary" /> Field Mapping
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Review AI-suggested mappings and adjust as needed.
          {targetTables.length > 0 && (
            <span className="ml-1">
              Detected target{targetTables.length > 1 ? "s" : ""}: <strong>{targetTables.join(", ")}</strong>
            </span>
          )}
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex flex-col items-center py-12 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">AI is analyzing your columns…</p>
          </div>
        ) : (
          <>
            {warnings.length > 0 && (
              <div className="space-y-2 mb-4">
                {warnings.map((w, i) => (
                  <Alert key={i} variant="destructive" className="border-yellow-500 bg-yellow-50 text-yellow-800">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{w}</AlertDescription>
                  </Alert>
                ))}
              </div>
            )}
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source Column</TableHead>
                    <TableHead>Solera Field</TableHead>
                    <TableHead>Confidence</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mappings.map((m, i) => (
                    <TableRow key={m.source_column}>
                      <TableCell className="font-medium">{m.source_column}</TableCell>
                      <TableCell>
                        <Select value={currentValue(m)} onValueChange={(v) => updateMapping(i, v)}>
                          <SelectTrigger className="w-[260px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unmapped">— Unmapped —</SelectItem>
                            {allTargets.map((t) => (
                              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>{confBadge(m.confidence)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex justify-end mt-4">
              <Button onClick={onConfirm} className="min-h-[44px]">Confirm Mapping</Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
