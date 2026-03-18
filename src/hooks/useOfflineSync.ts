import { useState, useEffect, useCallback } from "react";
import { getSyncQueueCount } from "@/lib/syncQueue";
import { flushSyncQueue } from "@/lib/syncFlush";
import { toast } from "sonner";

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);

  const refreshCount = useCallback(async () => {
    const count = await getSyncQueueCount();
    setPendingCount(count);
  }, []);

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      const flushed = await flushSyncQueue();
      if (flushed > 0) {
        toast.success(`Synced ${flushed} offline changes`);
      }
      refreshCount();
    };

    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial check
    refreshCount();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [refreshCount]);

  return { isOnline, pendingCount, refreshCount };
}
