import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";

interface Props {
  progress: number;
}

export function ImportProgress({ progress }: Props) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center py-16 gap-6">
        <Loader2 className="h-10 w-10 text-primary animate-spin" />
        <div className="w-full max-w-md space-y-2">
          <Progress value={progress} className="h-3" />
          <p className="text-center text-sm text-muted-foreground">Importing data… {progress}%</p>
        </div>
      </CardContent>
    </Card>
  );
}
