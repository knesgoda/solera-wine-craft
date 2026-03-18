import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { Mapping } from "@/pages/DataImport";

interface Props {
  headers: string[];
  mappings: Mapping[];
  rows: Record<string, any>[];
  totalRows: number;
  duplicateStrategy: "skip" | "merge" | "replace";
  setDuplicateStrategy: (s: "skip" | "merge" | "replace") => void;
  onConfirm: () => void;
  onBack: () => void;
}

export function ImportPreview({ headers, mappings, rows, totalRows, duplicateStrategy, setDuplicateStrategy, onConfirm, onBack }: Props) {
  const mappedCols = mappings.filter((m) => m.target_table && m.target_field);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Import Preview</CardTitle>
        <p className="text-sm text-muted-foreground">
          Showing first {rows.length} of {totalRows} rows · {mappedCols.length} mapped columns
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Label>On duplicate:</Label>
          <Select value={duplicateStrategy} onValueChange={(v) => setDuplicateStrategy(v as any)}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="skip">Skip</SelectItem>
              <SelectItem value="merge">Merge</SelectItem>
              <SelectItem value="replace">Replace</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border max-h-[400px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                {mappedCols.map((m) => (
                  <TableHead key={m.source_column}>
                    <div className="text-xs text-muted-foreground">{m.source_column}</div>
                    <div className="text-xs font-medium">{m.target_table}.{m.target_field}</div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, i) => (
                <TableRow key={i}>
                  <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                  {mappedCols.map((m) => (
                    <TableCell key={m.source_column} className="max-w-[150px] truncate">
                      {row[m.source_column] ?? "—"}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack}>Back</Button>
          <Button onClick={onConfirm} className="min-h-[44px]">
            Import {totalRows} Rows
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
