import { openDB, DBSchema } from "idb";

interface SyncQueueDB extends DBSchema {
  syncQueue: {
    key: number;
    value: {
      id?: number;
      table: string;
      operation: "insert" | "update";
      data: Record<string, any>;
      timestamp: number;
      orgId: string;
    };
  };
}

const dbPromise = openDB<SyncQueueDB>("solera-sync", 1, {
  upgrade(db) {
    db.createObjectStore("syncQueue", { keyPath: "id", autoIncrement: true });
  },
});

export async function addToSyncQueue(
  table: string,
  operation: "insert" | "update",
  data: Record<string, any>,
  orgId: string
) {
  const db = await dbPromise;
  await db.add("syncQueue", { table, operation, data, timestamp: Date.now(), orgId });
}

export async function getSyncQueueItems() {
  const db = await dbPromise;
  return db.getAll("syncQueue");
}

export async function clearSyncQueueItem(id: number) {
  const db = await dbPromise;
  await db.delete("syncQueue", id);
}

export async function getSyncQueueCount() {
  const db = await dbPromise;
  return db.count("syncQueue");
}
