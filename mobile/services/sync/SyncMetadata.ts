/**
 * BizPilot Mobile POS — Sync Metadata Service
 *
 * Tracks per-entity sync timestamps and statistics.
 * Stored in the WatermelonDB "settings" table as key-value pairs.
 *
 * Why per-entity sync metadata?
 * Different entity types may sync at different frequencies and have
 * different last-sync timestamps (e.g., products sync every 5 min
 * but orders sync every 30 seconds). Per-entity tracking allows:
 * - Delta sync per entity (only fetch what's changed)
 * - Diagnostics (which entities haven't synced recently?)
 * - Recovery (force-resync a specific entity type)
 */

import { database } from "@/db";
import { Q } from "@nozbe/watermelondb";
import { logger } from "@/utils/logger";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EntitySyncMeta {
  /** Entity type name (e.g., "products", "orders") */
  entityType: string;
  /** Timestamp of the last successful pull for this entity */
  lastPullAt: number;
  /** Timestamp of the last successful push for this entity */
  lastPushAt: number;
  /** Total records pulled in the last sync */
  lastPullCount: number;
  /** Total records pushed in the last sync */
  lastPushCount: number;
  /** Total number of conflicts resolved for this entity (lifetime) */
  totalConflicts: number;
}

export interface SyncStats {
  /** Total syncs performed since app install */
  totalSyncs: number;
  /** Total push operations */
  totalPushes: number;
  /** Total pull operations */
  totalPulls: number;
  /** Timestamp of the very first sync */
  firstSyncAt: number | null;
  /** Timestamp of the most recent sync */
  lastSyncAt: number | null;
}

// ---------------------------------------------------------------------------
// Key format
// ---------------------------------------------------------------------------

const META_KEY_PREFIX = "sync_meta_";
const STATS_KEY = "sync_stats";

function metaKey(entityType: string): string {
  return `${META_KEY_PREFIX}${entityType}`;
}

// ---------------------------------------------------------------------------
// Read operations
// ---------------------------------------------------------------------------

/**
 * Get sync metadata for a specific entity type.
 */
export async function getEntityMeta(
  entityType: string
): Promise<EntitySyncMeta | null> {
  try {
    const settings = await database
      .get("settings")
      .query(Q.where("key", metaKey(entityType)))
      .fetch();

    if (settings.length === 0) return null;

    return JSON.parse((settings[0] as any).value) as EntitySyncMeta;
  } catch {
    return null;
  }
}

/**
 * Get sync metadata for all entity types.
 */
export async function getAllEntityMeta(): Promise<EntitySyncMeta[]> {
  try {
    const settings = await database
      .get("settings")
      .query(Q.where("key", Q.like(`${META_KEY_PREFIX}%`)))
      .fetch();

    return settings.map((s) => JSON.parse((s as any).value) as EntitySyncMeta);
  } catch {
    return [];
  }
}

/**
 * Get the last pull timestamp for a specific entity type.
 * Returns 0 if no sync has occurred (triggers a full pull).
 */
export async function getLastPullTimestamp(
  entityType: string
): Promise<number> {
  const meta = await getEntityMeta(entityType);
  return meta?.lastPullAt ?? 0;
}

/**
 * Get overall sync statistics.
 */
export async function getSyncStats(): Promise<SyncStats> {
  try {
    const settings = await database
      .get("settings")
      .query(Q.where("key", STATS_KEY))
      .fetch();

    if (settings.length === 0) {
      return {
        totalSyncs: 0,
        totalPushes: 0,
        totalPulls: 0,
        firstSyncAt: null,
        lastSyncAt: null,
      };
    }

    return JSON.parse((settings[0] as any).value) as SyncStats;
  } catch {
    return {
      totalSyncs: 0,
      totalPushes: 0,
      totalPulls: 0,
      firstSyncAt: null,
      lastSyncAt: null,
    };
  }
}

// ---------------------------------------------------------------------------
// Write operations
// ---------------------------------------------------------------------------

/**
 * Update sync metadata for a specific entity type after a sync cycle.
 */
export async function updateEntityMeta(
  entityType: string,
  update: Partial<
    Pick<EntitySyncMeta, "lastPullAt" | "lastPushAt" | "lastPullCount" | "lastPushCount">
  > & { conflictsResolved?: number }
): Promise<void> {
  try {
    const existing = await getEntityMeta(entityType);
    const meta: EntitySyncMeta = {
      entityType,
      lastPullAt: update.lastPullAt ?? existing?.lastPullAt ?? 0,
      lastPushAt: update.lastPushAt ?? existing?.lastPushAt ?? 0,
      lastPullCount: update.lastPullCount ?? existing?.lastPullCount ?? 0,
      lastPushCount: update.lastPushCount ?? existing?.lastPushCount ?? 0,
      totalConflicts:
        (existing?.totalConflicts ?? 0) + (update.conflictsResolved ?? 0),
    };

    await upsertSetting(metaKey(entityType), JSON.stringify(meta));

    logger.debug("sync", `Updated sync metadata for ${entityType}`, meta);
  } catch (error) {
    logger.error("sync", `Failed to update sync metadata for ${entityType}`, {
      error: error instanceof Error ? error.message : "Unknown",
    });
  }
}

/**
 * Record a completed sync cycle in the overall statistics.
 */
export async function recordSyncCycle(pushCount: number, pullCount: number): Promise<void> {
  try {
    const stats = await getSyncStats();
    const now = Date.now();

    const updated: SyncStats = {
      totalSyncs: stats.totalSyncs + 1,
      totalPushes: stats.totalPushes + pushCount,
      totalPulls: stats.totalPulls + pullCount,
      firstSyncAt: stats.firstSyncAt ?? now,
      lastSyncAt: now,
    };

    await upsertSetting(STATS_KEY, JSON.stringify(updated));

    logger.debug("sync", "Recorded sync cycle", updated);
  } catch (error) {
    logger.error("sync", "Failed to record sync cycle", {
      error: error instanceof Error ? error.message : "Unknown",
    });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Upsert a key-value pair in the settings table.
 * Creates the record if it doesn't exist, updates if it does.
 */
async function upsertSetting(key: string, value: string): Promise<void> {
  await database.write(async () => {
    const existing = await database
      .get("settings")
      .query(Q.where("key", key))
      .fetch();

    if (existing.length > 0) {
      await existing[0].update((record: any) => {
        record.value = value;
        record.updatedAt = Date.now();
      });
    } else {
      await database.get("settings").create((record: any) => {
        record.key = key;
        record.value = value;
        record.updatedAt = Date.now();
      });
    }
  });
}
