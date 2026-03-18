import { WifiOff, RefreshCw } from "lucide-react";

interface Props {
  isOnline: boolean;
  pendingCount: number;
}

export function OfflineBanner({ isOnline, pendingCount }: Props) {
  if (isOnline && pendingCount === 0) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100]">
      {!isOnline && (
        <div className="bg-destructive text-destructive-foreground text-center py-1.5 px-4 text-sm font-medium flex items-center justify-center gap-2">
          <WifiOff className="h-4 w-4" />
          You're offline — changes will sync when reconnected
        </div>
      )}
      {pendingCount > 0 && isOnline && (
        <div className="bg-secondary text-secondary-foreground text-center py-1.5 px-4 text-sm font-medium flex items-center justify-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Syncing {pendingCount} pending change{pendingCount !== 1 ? "s" : ""}…
        </div>
      )}
    </div>
  );
}
