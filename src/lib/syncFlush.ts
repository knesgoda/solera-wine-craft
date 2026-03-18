import { supabase } from "@/integrations/supabase/client";
import { getSyncQueueItems, clearSyncQueueItem } from "./syncQueue";

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
        const { error } = await supabase.from(item.table as any).update(rest as any).eq("id", recordId);
        if (error) throw error;
      }
      await clearSyncQueueItem(item.id!);
      flushed++;
    } catch (err) {
      console.error("Sync failed for item", item.id, err);
      // Leave in queue for next retry
    }
  }
  return flushed;
}
