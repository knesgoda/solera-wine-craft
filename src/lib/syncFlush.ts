import { supabase } from "@/integrations/supabase/client";
import { getSyncQueueItems, clearSyncQueueItem } from "./syncQueue";
import { toast } from "sonner";

export async function flushSyncQueue(): Promise<number> {
  const items = await getSyncQueueItems();
  if (items.length === 0) return 0;

  let flushed = 0;
  for (const item of items) {
    try {
      if (item.operation === "insert") {
        const { error } = await supabase.from(item.table as any).insert(item.data as any);
        if (error) throw error;
      } else if (item.operation === "update") {
        const { id: recordId, ...rest } = item.data;

        // Timestamp-based conflict resolution: skip if server is newer
        const { data: serverRecord } = await supabase
          .from(item.table as any)
          .select("updated_at")
          .eq("id", recordId)
          .single();

        if (serverRecord?.updated_at && new Date(serverRecord.updated_at).getTime() > item.timestamp) {
          toast.warning(`Offline change to ${item.table} was skipped — a newer version exists`);
          await clearSyncQueueItem(item.id!);
          continue;
        }

        const { error } = await supabase.from(item.table as any).update(rest as any).eq("id", recordId);
        if (error) throw error;
      }
      await clearSyncQueueItem(item.id!);
      flushed++;
    } catch (err) {
      console.error("Sync failed for item", item.id, err);
    }
  }
  return flushed;
}
