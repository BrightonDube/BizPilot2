/**
 * BizPilot Mobile POS — Change Tracking Utility
 *
 * Automatically enqueues sync queue entries when local data changes.
 * Wraps WatermelonDB write operations to ensure every create/update/delete
 * is tracked for later sync to the server.
 *
 * Why automatic change tracking?
 * Manual sync queue management is error-prone. If a developer
 * creates an order but forgets to enqueue a sync entry, that order
 * will never reach the server. By wrapping all write operations
 * in tracked functions, we guarantee nothing is missed.
 *
 * Usage:
 * ```ts
 * import { trackedCreate, trackedUpdate, trackedDelete } from "./ChangeTracker";
 *
 * // Instead of: await database.write(() => collection.create(...))
 * await trackedCreate("orders", collection, (record) => {
 *   record.orderNumber = "ORD-001";
 *   // ...
 * });
 * ```
 */

import { database } from "@/db";
import { enqueueChange } from "./SyncQueue";
import { useSyncStore } from "@/stores/syncStore";
import { logger } from "@/utils/logger";
import type { Model, Collection } from "@nozbe/watermelondb";
import type { SyncAction } from "@/types";

// ---------------------------------------------------------------------------
// Tracked write operations
// ---------------------------------------------------------------------------

/**
 * Create a record with automatic sync queue tracking.
 *
 * @param entityType - The sync entity type (e.g., "orders", "products")
 * @param collection - The WatermelonDB collection to create in
 * @param builder - Builder function to populate the new record's fields
 * @returns The created record
 */
export async function trackedCreate<T extends Model>(
  entityType: string,
  collection: Collection<T>,
  builder: (record: T) => void
): Promise<T> {
  let createdRecord: T | null = null;

  await database.write(async () => {
    createdRecord = await collection.create((record) => {
      builder(record);
      // Mark as dirty — has local changes not yet synced
      (record as any).isDirty = true;
    });
  });

  if (!createdRecord) {
    throw new Error(`Failed to create ${entityType} record`);
  }

  // Enqueue for sync
  const payload = extractPayload(createdRecord);
  await enqueueChange(entityType, createdRecord.id, "create", payload);

  // Update pending count in UI
  useSyncStore.getState().incrementPending();

  logger.debug("sync", `Tracked create: ${entityType}`, {
    id: createdRecord.id,
  });

  return createdRecord;
}

/**
 * Update a record with automatic sync queue tracking.
 *
 * @param entityType - The sync entity type
 * @param record - The existing WatermelonDB record to update
 * @param updater - Updater function to modify the record's fields
 * @returns The updated record
 */
export async function trackedUpdate<T extends Model>(
  entityType: string,
  record: T,
  updater: (record: T) => void
): Promise<T> {
  await database.write(async () => {
    await record.update((r) => {
      updater(r);
      (r as any).isDirty = true;
      (r as any).updatedAt = Date.now();
    });
  });

  // Enqueue for sync
  const payload = extractPayload(record);
  await enqueueChange(entityType, record.id, "update", payload);

  useSyncStore.getState().incrementPending();

  logger.debug("sync", `Tracked update: ${entityType}`, {
    id: record.id,
  });

  return record;
}

/**
 * Delete a record with automatic sync queue tracking.
 *
 * @param entityType - The sync entity type
 * @param record - The WatermelonDB record to delete
 */
export async function trackedDelete<T extends Model>(
  entityType: string,
  record: T
): Promise<void> {
  const recordId = record.id;
  const remoteId = (record as any).remoteId;

  await database.write(async () => {
    await record.destroyPermanently();
  });

  // Only enqueue sync if the record has been synced to the server
  // (has a remote_id). Locally-created records that were never
  // synced don't need a server-side delete.
  if (remoteId) {
    await enqueueChange(entityType, recordId, "delete", {
      remote_id: remoteId,
    });

    useSyncStore.getState().incrementPending();
  }

  logger.debug("sync", `Tracked delete: ${entityType}`, {
    id: recordId,
    hadRemoteId: !!remoteId,
  });
}

// ---------------------------------------------------------------------------
// Batch tracked operations
// ---------------------------------------------------------------------------

/**
 * Perform multiple tracked writes in a single database transaction.
 * More efficient than individual tracked writes for bulk operations.
 *
 * @param operations - Array of operations to perform
 */
export async function trackedBatch(
  operations: Array<{
    type: SyncAction;
    entityType: string;
    record?: Model;
    collection?: Collection<any>;
    builder?: (record: any) => void;
    updater?: (record: any) => void;
  }>
): Promise<void> {
  const syncEntries: Array<{
    entityType: string;
    entityId: string;
    action: SyncAction;
    payload: Record<string, unknown>;
  }> = [];

  await database.write(async () => {
    for (const op of operations) {
      if (op.type === "create" && op.collection && op.builder) {
        const record = await op.collection.create((r: any) => {
          op.builder!(r);
          r.isDirty = true;
        });
        syncEntries.push({
          entityType: op.entityType,
          entityId: record.id,
          action: "create",
          payload: extractPayload(record),
        });
      } else if (op.type === "update" && op.record && op.updater) {
        await op.record.update((r: any) => {
          op.updater!(r);
          r.isDirty = true;
          r.updatedAt = Date.now();
        });
        syncEntries.push({
          entityType: op.entityType,
          entityId: op.record.id,
          action: "update",
          payload: extractPayload(op.record),
        });
      } else if (op.type === "delete" && op.record) {
        const remoteId = (op.record as any).remoteId;
        const recordId = op.record.id;
        await op.record.destroyPermanently();
        if (remoteId) {
          syncEntries.push({
            entityType: op.entityType,
            entityId: recordId,
            action: "delete",
            payload: { remote_id: remoteId },
          });
        }
      }
    }
  });

  // Enqueue all sync entries
  for (const entry of syncEntries) {
    await enqueueChange(
      entry.entityType,
      entry.entityId,
      entry.action,
      entry.payload
    );
  }

  // Update pending count
  if (syncEntries.length > 0) {
    const store = useSyncStore.getState();
    for (let i = 0; i < syncEntries.length; i++) {
      store.incrementPending();
    }
  }

  logger.info("sync", `Tracked batch of ${operations.length} operations`, {
    syncEntries: syncEntries.length,
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract a plain object payload from a WatermelonDB model.
 * Used to serialize the record data for the sync queue.
 */
function extractPayload(record: Model): Record<string, unknown> {
  const raw = (record as any)._raw ?? {};
  const payload: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(raw)) {
    // Skip WatermelonDB internal fields
    if (key.startsWith("_") || key === "id") continue;
    payload[key] = value;
  }

  return payload;
}
