import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Check, X, AlertTriangle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ExtractedField {
  value: any;
  confidence: number;
}

export interface ExtractedRow {
  id: string;
  date?: ExtractedField;
  block?: ExtractedField;
  variety?: ExtractedField;
  vintage_year?: ExtractedField;
  brix?: ExtractedField;
  ph?: ExtractedField;
  ta?: ExtractedField;
  temperature?: ExtractedField;
  vessel?: ExtractedField;
  so2_free?: ExtractedField;
  so2_total?: ExtractedField;
  notes?: ExtractedField;
  status: "pending" | "accepted" | "rejected";
}

const FIELD_KEYS = ["date", "block", "variety", "vintage_year", "brix", "ph", "ta", "temperature", "vessel", "notes"] as const;
const FIELD_LABELS: Record<string, string> = {
  date: "Date", block: "Block", variety: "Variety", vintage_year: "Vintage",
  brix: "Brix", ph: "pH", ta: "TA", temperature: "Temp", vessel: "Vessel", notes: "Notes",
};

function confidenceClass(confidence: number) {
  if (confidence >= 0.85) return "";
  if (confidence >= 0.70) return "bg-[hsl(50,100%,90%)]";
  return "bg-[hsl(0,100%,93%)]";
}

function ConfidenceIcon({ confidence }: { confidence: number }) {
  if (confidence >= 0.85) return null;
  if (confidence >= 0.70) return <AlertTriangle className="h-3 w-3 text-amber-500 inline ml-1" />;
  return <AlertCircle className="h-3 w-3 text-destructive inline ml-1" />;
}

interface Props {
  rows: ExtractedRow[];
  setRows: (rows: ExtractedRow[]) => void;
}

export function HandwrittenReviewTable({ rows, setRows }: Props) {
  const [editingCell, setEditingCell] = useState<{ rowId: string; field: string } | null>(null);

  const updateField = (rowId: string, field: string, value: string) => {
    setRows(rows.map((r) => {
      if (r.id !== rowId) return r;
      const existing = (r as any)[field] as ExtractedField | undefined;
      return { ...r, [field]: { value, confidence: existing?.confidence ?? 1.0 } };
    }));
    setEditingCell(null);
  };

  const setRowStatus = (rowId: string, status: "accepted" | "rejected") => {
    setRows(rows.map((r) => r.id === rowId ? { ...r, status } : r));
  };

  const hasRedCell = (row: ExtractedRow) =>
    FIELD_KEYS.some((k) => (row as any)[k]?.confidence < 0.70);

  const acceptAll = () => {
    setRows(rows.map((r) => r.status === "pending" && !hasRedCell(r) ? { ...r, status: "accepted" } : r));
  };

  const rejectAll = () => {
    setRows(rows.map((r) => ({ ...r, status: "rejected" })));
  };

  const accepted = rows.filter((r) => r.status === "accepted").length;
  const rejected = rows.filter((r) => r.status === "rejected").length;
  const pending = rows.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-muted-foreground">{rows.length} rows extracted</span>
        <span className="text-green-600 font-medium">{accepted} accepted</span>
        <span className="text-destructive font-medium">{rejected} rejected</span>
        <span className="text-muted-foreground">{pending} pending</span>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={acceptAll}>Accept All Valid</Button>
          <Button size="sm" variant="ghost" onClick={rejectAll}>Reject All</Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {FIELD_KEYS.map((k) => (
                <TableHead key={k} className="text-xs whitespace-nowrap">{FIELD_LABELS[k]}</TableHead>
              ))}
              <TableHead className="text-xs w-20">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.id}
                className={cn(
                  row.status === "rejected" && "opacity-40 line-through",
                  row.status === "accepted" && "bg-green-50/50 dark:bg-green-950/20"
                )}
              >
                {FIELD_KEYS.map((field) => {
                  const cell = (row as any)[field] as ExtractedField | undefined;
                  const isEditing = editingCell?.rowId === row.id && editingCell?.field === field;

                  return (
                    <TableCell
                      key={field}
                      className={cn("text-sm cursor-pointer", cell ? confidenceClass(cell.confidence) : "")}
                      onClick={() => row.status !== "rejected" && setEditingCell({ rowId: row.id, field })}
                    >
                      {isEditing ? (
                        <Input
                          defaultValue={cell?.value ?? ""}
                          autoFocus
                          className="h-7 text-sm w-24"
                          onBlur={(e) => updateField(row.id, field, e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && updateField(row.id, field, (e.target as HTMLInputElement).value)}
                        />
                      ) : (
                        <span>
                          {cell?.value ?? "—"}
                          {cell && <ConfidenceIcon confidence={cell.confidence} />}
                        </span>
                      )}
                    </TableCell>
                  );
                })}
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant={row.status === "accepted" ? "default" : "ghost"}
                      className="h-7 w-7"
                      onClick={() => setRowStatus(row.id, row.status === "accepted" ? "pending" as any : "accepted")}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant={row.status === "rejected" ? "destructive" : "ghost"}
                      className="h-7 w-7"
                      onClick={() => setRowStatus(row.id, row.status === "rejected" ? "pending" as any : "rejected")}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
