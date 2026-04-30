import { supabase } from "@/integrations/supabase/client";
import { getSyncQueueItems, clearSyncQueueItem } from "./syncQueue";
import { toast } from "sonner";

const ALLOWED_TABLES = ["tasks", "lab_samples", "fermentation_logs", "vineyard_notes"] as const;
const ALLOWED_OPERATIONS = ["insert", "update"] as const;

export async function flushSyncQueue(): Promise<number> {
  const items = await getSyncQueueItems();
  if (items.length === 0) return 0;

  let flushed = 0;
  for (const item of items) {
    if (!ALLOWED_TABLES.includes(item.table as any)) {
      console.warn("Sync rejected — table not in allowlist:", item);
      continue;
    }
    if (!ALLOWED_OPERATIONS.includes(item.operation as any)) {
      console.warn("Sync rejected — operation not in allowlist:", item);
      continue;
    }
    try {
      if (item.operation === "insert") {
        const { error } = await supabase.from(item.table as any).insert(item.data as any);
        if (error) throw error;
      } else if (item.operation === "update") {
        const { id: recordId, ...rest } = item.data;

        if (ALLOWED_TABLES.includes(item.table as any)) {
          // Timestamp-based conflict resolution: skip if server is newer
          const { data: serverRecord } = await (supabase
            .from(item.table as any)
            .select("updated_at")
            .eq("id", recordId)
            .single() as any);

          const serverUpdatedAt = (serverRecord as any)?.updated_at;
          if (serverUpdatedAt && new Date(serverUpdatedAt).getTime() > item.timestamp) {
            toast.warning(`Offline change to ${item.table} was skipped — a newer version exists`);
            await clearSyncQueueItem(item.id!);
            continue;
          }
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
