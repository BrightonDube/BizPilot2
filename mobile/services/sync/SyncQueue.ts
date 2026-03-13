/**
 * BizPilot Mobile POS — Sync Queue Service
 *
 * Manages the local queue of changes waiting to be pushed to the server.
 * Every create/update/delete on a syncable entity adds an entry here.
 *
 * Why a separate queue instead of scanning is_dirty flags?
 * With 10,000+ products, scanning every table for dirty records is O(n).
 * The queue is O(queue_size), which is typically much smaller.
 * It also preserves operation ordering — crucial for conflict resolution.
 */

import { database } from "@/db";
import SyncQueueItem from "@/db/models/SyncQueueItem";
import { Q } from "@nozbe/watermelondb";
import type { SyncAction } from "@/types";

/**
 * Add a change to the sync queue.
 *
 * @param entityType - Table name (e.g., "orders", "customers")
 * @param entityId - WatermelonDB record ID
 * @param action - "create" | "update" | "delete"
 * @param payload - JSON-serialized record data
 */
export async function enqueueChange(
  entityType: string,
  entityId: string,
  action: SyncAction,
  payload: Record<string, unknown>
): Promise<void> {
  await database.write(async () => {
    await database.get<SyncQueueItem>("sync_queue").create((record) => {
      record.entityType = entityType;
      record.entityId = entityId;
      record.action = action;
      record.payload = JSON.stringify(payload);
      record.attempts = 0;
      record.lastError = null;
      record.createdAt = Date.now();
      record.processedAt = null;
    });
  });
}

/**
 * Get all unprocessed queue entries, ordered by creation time.
 * Oldest first ensures causal ordering.
 */
export async function getPendingEntries(): Promise<SyncQueueItem[]> {
  return database
    .get<SyncQueueItem>("sync_queue")
    .query(
      Q.where("processed_at", null),
      Q.sortBy("created_at", Q.asc)
    )
    .fetch();
}

/**
 * Mark a queue entry as successfully processed.
 */
export async function markProcessed(entry: SyncQueueItem): Promise<void> {
  await database.write(async () => {
    await entry.update((record) => {
      record.processedAt = Date.now();
    });
  });
}

/**
 * Record a failed sync attempt with the error message.
 * Increments the attempt counter for backoff decisions.
 */
export async function markFailed(
  entry: SyncQueueItem,
  error: string
): Promise<void> {
  await database.write(async () => {
    await entry.update((record) => {
      record.attempts = record.attempts + 1;
      record.lastError = error;
    });
  });
}

/**
 * Count unprocessed entries — used for the pending badge.
 */
export async function getPendingCount(): Promise<number> {
  return database
    .get<SyncQueueItem>("sync_queue")
    .query(Q.where("processed_at", null))
    .fetchCount();
}

/**
 * Remove processed entries older than the given age.
 *
 * Why keep processed entries at all?
 * They serve as an audit log for debugging sync issues.
 * After 7 days, they're safe to purge.
 *
 * @param olderThanMs - Age threshold in milliseconds
 */
export async function purgeProcessed(olderThanMs: number): Promise<void> {
  const cutoff = Date.now() - olderThanMs;
  const old = await database
    .get<SyncQueueItem>("sync_queue")
    .query(
      Q.where("processed_at", Q.notEq(null)),
      Q.where("processed_at", Q.lt(cutoff))
    )
    .fetch();

  if (old.length > 0) {
    await database.write(async () => {
      await database.batch(...old.map((entry) => entry.prepareDestroyPermanently()));
    });
  }
}
