import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertTriangle, XCircle, RotateCcw } from "lucide-react";
import type { ImportResult } from "@/pages/DataImport";

interface Props {
  result: ImportResult;
  onReset: () => void;
}

export function ImportReport({ result, onReset }: Props) {
  const hasErrors = result.errors > 0;
  const allFailed = result.imported === 0 && result.errors > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          {allFailed ? (
            <><XCircle className="h-5 w-5 text-red-600" /> Import Failed</>
          ) : hasErrors ? (
            <><AlertTriangle className="h-5 w-5 text-yellow-600" /> Import Completed with Errors</>
          ) : (
            <><CheckCircle2 className="h-5 w-5 text-green-600" /> Import Complete</>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="text-center p-4 rounded-lg bg-muted">
            <p className="text-2xl font-bold font-display text-foreground">{result.total}</p>
            <p className="text-sm text-muted-foreground">Total Rows</p>
          </div>
          <div className="text-center p-4 rounded-lg bg-green-50">
            <p className="text-2xl font-bold font-display text-green-700">{result.imported}</p>
            <p className="text-sm text-green-600">Imported</p>
          </div>
          <div className="text-center p-4 rounded-lg bg-yellow-50">
            <p className="text-2xl font-bold font-display text-yellow-700">{result.skipped}</p>
            <p className="text-sm text-yellow-600 flex items-center justify-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Skipped
            </p>
          </div>
          <div className="text-center p-4 rounded-lg bg-red-50">
            <p className="text-2xl font-bold font-display text-red-700">{result.errors}</p>
            <p className="text-sm text-red-600 flex items-center justify-center gap-1">
              <XCircle className="h-3 w-3" /> Errors
            </p>
          </div>
        </div>

        {result.errorMessages && result.errorMessages.length > 0 && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-800 mb-2">Top errors:</p>
            <ul className="text-sm text-red-700 space-y-1">
              {result.errorMessages.slice(0, 5).map((msg, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-red-400">•</span>
                  <span>{msg}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-center pt-4">
          <Button variant="outline" onClick={onReset}>
            <RotateCcw className="h-4 w-4 mr-2" /> Import More Data
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
